"use strict";

const assert = require("node:assert/strict");
const { test } = require("./harness.cjs");
const { COMMON_PATCH_CONTRACT, generatePrompt } = require("../src/core/prompt");

test("generated prompts include the required patch contract", () => {
  const result = generatePrompt({
    files: [{ content: "export const value = 1;\n", path: "src/value.js" }],
    request: "Change the value to 2.",
    target: "ChatGPT",
  });

  for (const line of COMMON_PATCH_CONTRACT) {
    assert.match(result.prompt, new RegExp(line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(result.prompt, /<file path="src\/value.js">/);
  assert.equal(result.target, "ChatGPT");
});

test("generated prompts escape file paths inside context tags", () => {
  const result = generatePrompt({
    files: [{ content: "content\n", path: 'src/"quoted<&>.js' }],
    request: "Keep path metadata parseable.",
    target: "Generic LLM",
  });

  assert.match(result.prompt, /<file path="src\/&quot;quoted&lt;&amp;&gt;\.js">/);
});
