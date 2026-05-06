"use strict";

const assert = require("node:assert/strict");
const { test } = require("./harness.cjs");
const { applyFilePatch } = require("../src/core/patchPreview");
const { parseUnifiedDiff } = require("../src/core/patchParser");

test("builds before and after content for a modified file patch", () => {
  const parsed = parseUnifiedDiff(`diff --git a/src/example.js b/src/example.js
--- a/src/example.js
+++ b/src/example.js
@@ -1,3 +1,4 @@
 const value = 1;
-console.log(value);
+console.log(value + 1);
+console.log("patched");
 export default value;
`);
  const result = applyFilePatch("const value = 1;\nconsole.log(value);\nexport default value;\n", parsed.files[0]);
  assert.deepEqual(result.errors, []);
  assert.equal(result.after, "const value = 1;\nconsole.log(value + 1);\nconsole.log(\"patched\");\nexport default value;\n");
});

test("reports preview errors when hunk context does not match", () => {
  const parsed = parseUnifiedDiff(`diff --git a/src/example.js b/src/example.js
--- a/src/example.js
+++ b/src/example.js
@@ -1,1 +1,1 @@
-old
+new
`);
  const result = applyFilePatch("different\n", parsed.files[0]);
  assert.match(result.errors.join("\n"), /expected/);
});
