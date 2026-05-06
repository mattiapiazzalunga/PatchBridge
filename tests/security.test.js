"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { test } = require("./harness.cjs");
const { parseUnifiedDiff } = require("../src/core/patchParser");
const { validateParsedPatchFilesystem } = require("../src/core/security");

test("filesystem security validation blocks symlink patch targets when symlinks are supported", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "patchbridge-symlink-"));
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), "patchbridge-outside-"));
  const linkPath = path.join(root, "linked.txt");

  try {
    await fs.writeFile(path.join(outside, "linked.txt"), "old\n");
    await fs.symlink(path.join(outside, "linked.txt"), linkPath);
  } catch {
    assert.ok(true);
    return;
  }

  const parsed = parseUnifiedDiff(`diff --git a/linked.txt b/linked.txt
--- a/linked.txt
+++ b/linked.txt
@@ -1,1 +1,1 @@
-old
+new
`);
  const result = await validateParsedPatchFilesystem(root, parsed);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Symlink paths are blocked/);
});

test("filesystem security validation blocks patches that create symlinks", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "patchbridge-symlink-mode-"));
  const parsed = parseUnifiedDiff(`diff --git a/link.txt b/link.txt
new file mode 120000
index 0000000..1111111 120000
--- /dev/null
+++ b/link.txt
@@ -0,0 +1,1 @@
+../outside.txt
`);

  const result = await validateParsedPatchFilesystem(root, parsed);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Symlink patches are blocked/);
});
