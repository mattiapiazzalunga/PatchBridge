# Prompt Guide

PatchBridge generates prompts that ask AI systems to return one Git unified diff. The required output contract is:

```text
Return ONLY a Git unified diff compatible with git apply.
Do not use Markdown.
Do not add explanations.
Include all modified files.
Use paths relative to the repository root.
Use at least 3 lines of context per hunk.
Do not include binary files.
Do not modify files that were not requested unless necessary.
```

## Targets

- ChatGPT: emphasizes final-answer-only patch output and private reasoning.
- Claude: uses explicit file-context framing and avoids XML/Markdown output wrappers.
- Gemini: emphasizes exact path handling and stable unified-diff syntax.
- Generic LLM: uses conservative, model-neutral instructions.

## Prompting References

PatchBridge prompt presets are based on public prompting guidance, adapted for patch-only output:

- OpenAI recommends clear instructions, relevant context, and explicit output formatting guidance: <https://platform.openai.com/docs/guides/prompt-engineering/strategy>
- Anthropic recommends using structured prompt sections and XML-style tags to separate context and instructions for Claude: <https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/use-xml-tags>
- Google recommends including context and details for Gemini, with important restrictions placed clearly in the prompt: <https://cloud.google.com/gemini/docs/discover/write-prompts>
- Google Vertex AI guidance describes prompt components such as task, system instructions, examples, and contextual information: <https://cloud.google.com/vertex-ai/generative-ai/docs/learn/prompts/introduction-prompt-design>

## Context Size

PatchBridge estimates prompt tokens with a conservative characters-per-token heuristic and warns when selected context exceeds common target thresholds. These are warnings, not guarantees; actual model limits vary by product, account, and release.

## Source Privacy

Generated prompts can contain proprietary source code. Review the generated prompt before copying it to any AI tool.
