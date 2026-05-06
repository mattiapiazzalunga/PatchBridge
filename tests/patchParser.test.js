"use strict";

const assert = require("node:assert/strict");
const { test } = require("./harness.cjs");
const { parseUnifiedDiff } = require("../src/core/patchParser");

const SAMPLE_PATCH = `diff --git a/src/example.js b/src/example.js
index 1111111..2222222 100644
--- a/src/example.js
+++ b/src/example.js
@@ -1,3 +1,4 @@
 const value = 1;
-console.log(value);
+console.log(value + 1);
+console.log("patched");
 export default value;
`;

test("parses Git unified diff files, hunks, and line stats", () => {
  const parsed = parseUnifiedDiff(SAMPLE_PATCH);
  assert.equal(parsed.isValidStructure, true);
  assert.equal(parsed.files.length, 1);
  assert.equal(parsed.files[0].newPath, "src/example.js");
  assert.equal(parsed.stats.files, 1);
  assert.equal(parsed.stats.hunks, 1);
  assert.equal(parsed.stats.additions, 2);
  assert.equal(parsed.stats.deletions, 1);
});

test("reports non-diff text before a patch", () => {
  const parsed = parseUnifiedDiff(`Here is the patch:\n${SAMPLE_PATCH}`);
  assert.equal(parsed.isValidStructure, false);
  assert.match(parsed.errors[0].message, /Text before/);
});

test("parses quoted Git paths with spaces", () => {
  const parsed = parseUnifiedDiff(`diff --git "a/src/hello world.js" "b/src/hello world.js"
--- "a/src/hello world.js"
+++ "b/src/hello world.js"
@@ -1,1 +1,1 @@
-old
+new
`);
  assert.equal(parsed.isValidStructure, true);
  assert.equal(parsed.files[0].newPath, "src/hello world.js");
});

test("rejects hunks whose body does not match header counts", () => {
  const parsed = parseUnifiedDiff(`diff --git a/src/example.js b/src/example.js
--- a/src/example.js
+++ b/src/example.js
@@ -1,2 +1,2 @@
-old
+new
`);
  assert.equal(parsed.isValidStructure, false);
  assert.match(parsed.errors.map((error) => error.message).join("\n"), /Hunk line counts/);
});

test("records symlink file modes from patch headers", () => {
  const parsed = parseUnifiedDiff(`diff --git a/link.txt b/link.txt
new file mode 120000
index 0000000..1111111 120000
--- /dev/null
+++ b/link.txt
@@ -0,0 +1,1 @@
+target.txt
`);

  assert.equal(parsed.isValidStructure, true);
  assert.equal(parsed.files[0].isSymlink, true);
  assert.equal(parsed.files[0].newMode, "120000");
  assert.equal(parsed.files[0].indexMode, "120000");
});
