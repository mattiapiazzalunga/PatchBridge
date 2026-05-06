"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const { EventEmitter } = require("node:events");
const { test } = require("./harness.cjs");
const { getDiff, getGitStatus, validateDiffRef } = require("../src/core/git");

function mockSpawn(callback) {
  const original = childProcess.spawn;
  childProcess.spawn = (command, args, options) => {
    const response = callback(command, args, options) || {};
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = {
      end() {},
      write() {},
    };
    child.kill = () => {};
    setImmediate(() => {
      if (response.stdout) child.stdout.emit("data", response.stdout);
      if (response.stderr) child.stderr.emit("data", response.stderr);
      child.emit("close", response.code || 0);
    });
    return child;
  };
  return () => {
    childProcess.spawn = original;
  };
}

test("worktree diff compares current working tree against HEAD", async () => {
  let seenArgs = null;
  const restore = mockSpawn((command, args) => {
    assert.equal(command, "git");
    seenArgs = args;
  });
  try {
    const diff = await getDiff(process.cwd(), "worktree");
    assert.equal(diff.ok, true);
    assert.deepEqual(seenArgs, ["diff", "--no-ext-diff", "--src-prefix=a/", "--dst-prefix=b/", "HEAD", "--"]);
  } finally {
    restore();
  }
});

test("git status parses untracked paths with spaces from porcelain z output", async () => {
  const calls = [];
  const restore = mockSpawn((command, args) => {
    calls.push(args);
    if (args[0] === "rev-parse") return { stdout: "true\n" };
    if (args[0] === "branch") return { stdout: "main\n" };
    if (args[0] === "status") return { stdout: "?? file with space.js\0 M src/app.js\0" };
    return { stdout: "" };
  });
  try {
    const status = await getGitStatus(process.cwd());
    assert.equal(status.repository, true);
    assert.equal(status.untrackedCount, 1);
    assert.deepEqual(status.untracked, ["file with space.js"]);
    assert.deepEqual(calls[2], ["status", "--porcelain=v1", "-z"]);
  } finally {
    restore();
  }
});

test("diff refs reject option-looking and control-character input", () => {
  assert.equal(validateDiffRef("main").ok, true);
  assert.equal(validateDiffRef("HEAD~1").ok, true);
  assert.equal(validateDiffRef("--output=patch.txt").ok, false);
  assert.equal(validateDiffRef("main\n--output=patch.txt").ok, false);
});
