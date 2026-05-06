"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { test } = require("./harness.cjs");
const { readSelectedFiles, scanProject } = require("../src/core/scanner");

test("scanner ignores common build folders and excludes binary files by default", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "patchbridge-scan-"));
  await fs.mkdir(path.join(root, "src"), { recursive: true });
  await fs.mkdir(path.join(root, "node_modules", "pkg"), { recursive: true });
  await fs.writeFile(path.join(root, "src", "index.js"), "export const value = 1;\n");
  await fs.writeFile(path.join(root, "image.png"), Buffer.from([0, 1, 2, 3, 4, 5]));
  await fs.writeFile(path.join(root, "node_modules", "pkg", "index.js"), "ignored\n");

  const scan = await scanProject(root);
  assert.equal(scan.summary.sourceFiles, 1);
  assert.equal(scan.summary.binaryFiles, 1);
  assert.equal(scan.summary.includedByDefault, 1);

  const read = await readSelectedFiles(root, ["src/index.js", "image.png"]);
  assert.equal(read.files.length, 1);
  assert.match(read.warnings.join("\n"), /binary/);
});

test("scanner can include ignored folders for manual selection without traversing VCS metadata", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "patchbridge-ignored-"));
  await fs.mkdir(path.join(root, "node_modules", "pkg"), { recursive: true });
  await fs.mkdir(path.join(root, ".git", "objects"), { recursive: true });
  await fs.writeFile(path.join(root, "node_modules", "pkg", "index.js"), "export const ignored = true;\n");
  await fs.writeFile(path.join(root, ".git", "config"), "private\n");

  const defaultScan = await scanProject(root);
  const ignoredNode = defaultScan.tree.find((node) => node.name === "node_modules");
  assert.equal(ignoredNode.children.length, 0);

  const expandedScan = await scanProject(root, { includeIgnored: true });
  const expandedIgnoredNode = expandedScan.tree.find((node) => node.name === "node_modules");
  const hardIgnoredNode = expandedScan.tree.find((node) => node.name === ".git");
  const ignoredFile = expandedIgnoredNode.children[0].children[0];
  assert.equal(expandedIgnoredNode.children[0].name, "pkg");
  assert.equal(ignoredFile.ignored, true);
  assert.equal(ignoredFile.source, true);
  assert.equal(ignoredFile.readable, true);
  assert.equal(ignoredFile.includedByDefault, false);
  assert.equal(hardIgnoredNode.children.length, 0);
});

test("selected file reads skip symlink paths when symlinks are supported", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "patchbridge-readlink-"));
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), "patchbridge-readlink-outside-"));
  const linkPath = path.join(root, "linked.txt");

  try {
    await fs.writeFile(path.join(outside, "linked.txt"), "secret\n");
    await fs.symlink(path.join(outside, "linked.txt"), linkPath);
  } catch {
    assert.ok(true);
    return;
  }

  const read = await readSelectedFiles(root, ["linked.txt"]);
  assert.equal(read.files.length, 0);
  assert.match(read.warnings.join("\n"), /symlink/);
});
