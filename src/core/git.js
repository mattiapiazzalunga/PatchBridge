"use strict";

const childProcess = require("node:child_process");
const { normalizeRoot } = require("./paths");

function runGit(cwd, args, input = "", timeoutMs = 30000) {
  return new Promise((resolve) => {
    let child;
    try {
      child = childProcess.spawn("git", args, {
        cwd,
        shell: false,
        windowsHide: true,
      });
    } catch (error) {
      resolve({ code: 127, ok: false, stderr: error.message, stdout: "" });
      return;
    }
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill();
        resolve({ code: 124, ok: false, stderr: "Git command timed out.", stdout });
      }
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve({ code: 127, ok: false, stderr: error.message, stdout });
      }
    });
    child.on("close", (code) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve({ code, ok: code === 0, stderr, stdout });
      }
    });

    if (input) {
      child.stdin.write(input);
    }
    child.stdin.end();
  });
}

function parseGitVersion(output) {
  const match = /git version\s+(\d+)\.(\d+)\.(\d+)/i.exec(output || "");
  if (!match) {
    return null;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    raw: match[0].replace(/^git version\s+/i, ""),
  };
}

function isSupportedVersion(version, minimum = { major: 2, minor: 30, patch: 0 }) {
  if (!version) return false;
  if (version.major !== minimum.major) return version.major > minimum.major;
  if (version.minor !== minimum.minor) return version.minor > minimum.minor;
  return version.patch >= minimum.patch;
}

function validateDiffRef(ref) {
  const value = String(ref || "").trim();
  if (!value) {
    return { ok: false, stderr: "A branch or commit reference is required.", stdout: "", code: 2 };
  }
  if (value.startsWith("-")) {
    return { ok: false, stderr: "Branch or commit references cannot start with a dash.", stdout: "", code: 2 };
  }
  if (/[\0\r\n]/.test(value)) {
    return { ok: false, stderr: "Branch or commit references cannot contain control characters.", stdout: "", code: 2 };
  }
  if (value.length > 240) {
    return { ok: false, stderr: "Branch or commit reference is too long.", stdout: "", code: 2 };
  }
  return { ok: true, value };
}

async function checkGitAvailable(cwd = process.cwd()) {
  const result = await runGit(cwd, ["--version"], "", 10000);
  const version = parseGitVersion(result.stdout || result.stderr);
  return {
    installed: result.ok,
    supported: result.ok && isSupportedVersion(version),
    version,
    raw: (result.stdout || result.stderr).trim(),
  };
}

async function isGitRepository(rootPath) {
  const root = normalizeRoot(rootPath);
  const result = await runGit(root, ["rev-parse", "--is-inside-work-tree"], "", 10000);
  return result.ok && result.stdout.trim() === "true";
}

async function getGitStatus(rootPath) {
  const root = normalizeRoot(rootPath);
  const repository = await isGitRepository(root);
  if (!repository) {
    return {
      branch: "",
      clean: false,
      dirtyCount: 0,
      repository: false,
      untracked: [],
      untrackedCount: 0,
    };
  }

  const branch = await runGit(root, ["branch", "--show-current"], "", 10000);
  const status = await runGit(root, ["status", "--porcelain=v1", "-z"], "", 10000);
  const entries = status.stdout.split("\0").filter(Boolean);
  const untracked = [];
  const statusLines = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    statusLines.push(entry);
    if (entry.startsWith("?? ")) {
      untracked.push(entry.slice(3).trim().replace(/\\/g, "/"));
    }
    if ((entry.startsWith("R") || entry.startsWith("C")) && entries[index + 1]) {
      index += 1;
      statusLines.push(entries[index]);
    }
  }
  return {
    branch: branch.stdout.trim(),
    clean: statusLines.length === 0,
    dirtyCount: statusLines.length,
    repository: true,
    statusLines,
    untracked,
    untrackedCount: untracked.length,
  };
}

async function applyCheck(rootPath, patchText) {
  const root = normalizeRoot(rootPath);
  return runGit(root, ["apply", "--check", "--whitespace=nowarn", "-"], patchText, 30000);
}

async function applyPatch(rootPath, patchText) {
  const root = normalizeRoot(rootPath);
  return runGit(root, ["apply", "--whitespace=nowarn", "-"], patchText, 30000);
}

async function reverseApplyCheck(rootPath, patchText) {
  const root = normalizeRoot(rootPath);
  return runGit(root, ["apply", "--reverse", "--check", "--whitespace=nowarn", "-"], patchText, 30000);
}

async function reverseApplyPatch(rootPath, patchText) {
  const root = normalizeRoot(rootPath);
  return runGit(root, ["apply", "--reverse", "--whitespace=nowarn", "-"], patchText, 30000);
}

async function createBackupBranch(rootPath) {
  const root = normalizeRoot(rootPath);
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "-");
  const branchName = `patchbridge-backup-${stamp}`;
  const result = await runGit(root, ["branch", branchName], "", 30000);
  return { ...result, branchName };
}

async function getDiff(rootPath, mode, ref) {
  const root = normalizeRoot(rootPath);
  if (mode === "worktree") {
    return runGit(root, ["diff", "--no-ext-diff", "--src-prefix=a/", "--dst-prefix=b/", "HEAD", "--"], "", 30000);
  }
  if (mode === "branch" || mode === "commit") {
    const safeRef = validateDiffRef(ref);
    if (!safeRef.ok) {
      return safeRef;
    }
    return runGit(root, ["diff", "--no-ext-diff", safeRef.value, "--"], "", 30000);
  }
  return { code: 2, ok: false, stderr: `Unsupported diff mode: ${mode}`, stdout: "" };
}

module.exports = {
  applyCheck,
  applyPatch,
  checkGitAvailable,
  createBackupBranch,
  getDiff,
  getGitStatus,
  isGitRepository,
  isSupportedVersion,
  parseGitVersion,
  reverseApplyCheck,
  reverseApplyPatch,
  runGit,
  validateDiffRef,
};
