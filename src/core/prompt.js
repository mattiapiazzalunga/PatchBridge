"use strict";

const COMMON_PATCH_CONTRACT = [
  "Return ONLY a Git unified diff compatible with git apply.",
  "Do not use Markdown.",
  "Do not add explanations.",
  "Include all modified files.",
  "Use paths relative to the repository root.",
  "Use at least 3 lines of context per hunk.",
  "Do not include binary files.",
  "Do not modify files that were not requested unless necessary.",
];

const TARGETS = {
  ChatGPT: {
    label: "ChatGPT",
    warningTokens: 120000,
    guidance: [
      "Think through the edit privately before producing the final answer.",
      "The final answer must be the diff only, with no code fences and no prose.",
      "Prefer small, focused hunks that preserve existing style and project structure.",
    ],
  },
  Claude: {
    label: "Claude",
    warningTokens: 180000,
    guidance: [
      "Treat the file blocks as source-of-truth context.",
      "Do not wrap the response in XML, Markdown, or explanatory text.",
      "Keep the patch surgical and avoid touching files outside the selected context unless essential.",
    ],
  },
  Gemini: {
    label: "Gemini",
    warningTokens: 900000,
    guidance: [
      "Prioritize exact path handling and stable unified-diff syntax.",
      "Avoid Markdown wrappers, summaries, or extra alternatives.",
      "Double-check that each hunk has enough context for git apply.",
    ],
  },
  "Generic LLM": {
    label: "Generic LLM",
    warningTokens: 60000,
    guidance: [
      "Use conservative, standards-compliant unified diff output.",
      "Avoid explanations, Markdown fences, and partial snippets.",
      "Keep edits minimal and compatible with git apply.",
    ],
  },
};

function estimatePromptTokens(text) {
  return Math.ceil(String(text || "").length / 4);
}

function normalizeTarget(target) {
  return TARGETS[target] ? target : "Generic LLM";
}

function escapeXmlAttribute(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function generatePrompt({ request, target = "Generic LLM", files = [] }) {
  const normalizedTarget = normalizeTarget(target);
  const targetConfig = TARGETS[normalizedTarget];
  const safeRequest = String(request || "").trim();

  const sections = [
    `You are helping modify a local software project. Target AI system: ${targetConfig.label}.`,
    "",
    "User requested modification:",
    safeRequest || "(No request was provided. Ask for clarification by returning no patch.)",
    "",
    "Critical output contract:",
    ...COMMON_PATCH_CONTRACT.map((line) => `- ${line}`),
    "",
    `${targetConfig.label}-specific guidance:`,
    ...targetConfig.guidance.map((line) => `- ${line}`),
    "",
    "Project context follows. File paths are relative to the repository root.",
  ];

  for (const file of files) {
    sections.push("");
    sections.push(`<file path="${escapeXmlAttribute(file.path)}">`);
    sections.push(file.content);
    sections.push("</file>");
  }

  sections.push("");
  sections.push("Return the patch now. The response must start with a diff header such as diff --git.");

  const prompt = sections.join("\n");
  const tokenEstimate = estimatePromptTokens(prompt);
  return {
    prompt,
    target: normalizedTarget,
    tokenEstimate,
    warningTokens: targetConfig.warningTokens,
    tooLarge: tokenEstimate > targetConfig.warningTokens,
  };
}

module.exports = {
  COMMON_PATCH_CONTRACT,
  TARGETS,
  escapeXmlAttribute,
  estimatePromptTokens,
  generatePrompt,
  normalizeTarget,
};
