"use strict";

const assert = require("node:assert/strict");
const { test } = require("./harness.cjs");
const { sanitizeRelativePath } = require("../src/core/paths");
const { parseUnifiedDiff } = require("../src/core/patchParser");
const { validateParsedPatch } = require("../src/core/security");

test("sanitizes normal relative patch paths", () => {
  assert.deepEqual(sanitizeRelativePath("a/src/index.js"), { ok: true, path: "src/index.js" });
});

test("blocks absolute and traversal patch paths", () => {
  assert.equal(sanitizeRelativePath("../secret.txt").ok, false);
  assert.equal(sanitizeRelativePath("C:/Users/example/secret.txt").ok, false);
  assert.equal(sanitizeRelativePath("/tmp/secret.txt").ok, false);
});

test("blocks version-control metadata patch paths", () => {
  assert.equal(sanitizeRelativePath(".git/config").ok, false);
  assert.equal(sanitizeRelativePath("src/.Git/hooks/pre-commit").ok, false);
  assert.equal(sanitizeRelativePath(".hg/hgrc").ok, false);
});

test("patch security blocks traversal in parsed diffs", () => {
  const parsed = parseUnifiedDiff(`diff --git a/../secret.txt b/../secret.txt
--- a/../secret.txt
+++ b/../secret.txt
@@ -1,1 +1,1 @@
-old
+new
`);
  const security = validateParsedPatch(process.cwd(), parsed);
  assert.equal(security.ok, false);
  assert.match(security.errors.join("\n"), /Path traversal/);
});
