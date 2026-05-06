"use strict";

const assert = require("node:assert/strict");
const { test } = require("./harness.cjs");
const { isVersionAtLeast, parseSemver } = require("../src/core/requirements");

test("requirements parse plain and v-prefixed semantic versions", () => {
  assert.deepEqual(parseSemver("v22.12.0"), { major: 22, minor: 12, patch: 0, raw: "22.12.0" });
  assert.deepEqual(parseSemver("10.9.2"), { major: 10, minor: 9, patch: 2, raw: "10.9.2" });
  assert.equal(parseSemver("not a version"), null);
});

test("requirements compare minimum versions", () => {
  const minimum = { major: 22, minor: 12, patch: 0 };
  assert.equal(isVersionAtLeast({ major: 22, minor: 12, patch: 0 }, minimum), true);
  assert.equal(isVersionAtLeast({ major: 23, minor: 0, patch: 0 }, minimum), true);
  assert.equal(isVersionAtLeast({ major: 22, minor: 11, patch: 9 }, minimum), false);
});
