"use strict";

const assert = require("node:assert/strict");
const { test } = require("./harness.cjs");
const { buildFilteredPatch, createDefaultApprovals } = require("../src/core/patchFilter");
const { parseUnifiedDiff } = require("../src/core/patchParser");

const PATCH = `diff --git a/src/example.js b/src/example.js
--- a/src/example.js
+++ b/src/example.js
@@ -1,3 +1,4 @@
 const value = 1;
-console.log(value);
+console.log(value + 1);
+console.log("patched");
 export default value;
`;

test("builds a filtered patch when one approved line is rejected", () => {
  const parsed = parseUnifiedDiff(PATCH);
  const approvals = createDefaultApprovals(parsed);
  const secondAddition = parsed.files[0].hunks[0].lines.filter((line) => line.type === "addition")[1];
  approvals.lines[secondAddition.id] = false;

  const result = buildFilteredPatch(parsed, approvals);
  assert.match(result.patch, /\+console\.log\(value \+ 1\);/);
  assert.doesNotMatch(result.patch, /patched/);
  assert.match(result.patch, /@@ -1,3 \+1,3 @@/);
});

test("omits files with no approved changes", () => {
  const parsed = parseUnifiedDiff(PATCH);
  const approvals = createDefaultApprovals(parsed);
  approvals.files[parsed.files[0].id] = false;

  const result = buildFilteredPatch(parsed, approvals);
  assert.equal(result.patch, "");
  assert.deepEqual(result.omitted, ["src/example.js"]);
});

test("allows line-level filtering for new files", () => {
  const parsed = parseUnifiedDiff(`diff --git a/src/new.js b/src/new.js
new file mode 100644
--- /dev/null
+++ b/src/new.js
@@ -0,0 +1,2 @@
+export const keep = true;
+export const drop = true;
`);
  const approvals = createDefaultApprovals(parsed);
  const drop = parsed.files[0].hunks[0].lines.find((line) => line.content.includes("drop"));
  approvals.lines[drop.id] = false;

  const result = buildFilteredPatch(parsed, approvals);
  assert.match(result.patch, /keep/);
  assert.doesNotMatch(result.patch, /drop/);
  assert.match(result.patch, /@@ -0,0 \+1,1 @@/);
});
