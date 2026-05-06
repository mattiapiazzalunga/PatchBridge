# Competitor Research

Research date: May 6, 2026.

PatchBridge focuses on a narrow workflow that most adjacent tools only partially cover: local project scan, AI prompt generation, imported patch validation, granular approval, and safe application.

## Feature Matrix

| Tool | License / openness | Relevant strengths | Limitations for PatchBridge users | Ideas adopted |
| --- | --- | --- | --- | --- |
| [Aider](https://github.com/Aider-AI/aider) | Apache-2.0 | Maps codebases, supports many LLMs, integrates with Git, and supports copy/paste workflows for web chat. | Terminal-first agent that edits directly; not a visual patch approval workbench. | Codebase context awareness, Git-native safety, and copy/paste handoff support. |
| [SourceGit](https://github.com/sourcegit-scm/sourcegit) | MIT | Cross-platform Git GUI with diff, branch diff, file history, command logs, and save/apply patch features. | Broad Git client, not AI-prompt or AI-patch focused. | Familiar file tree, clear Git status, patch apply UX, and command log visibility. |
| [ECA](https://eca.dev/) | Open source | Editor-agnostic AI assistant with chat, rewrite, context attachment, accept/reject diff, multi-model support, and local configuration. | Editor-integrated workflow; patch import/apply review is not the central product. | Explicit context attachment, model target switching, and accept/reject diff ergonomics. |
| [GitWand](https://gitwand.devlint.fr/) | MIT | Native Tauri Git client, hunk-level and line-level staging, side-by-side diff, deterministic conflict classification, local MCP integration. | Conflict-resolution and full Git-client scope; less focused on AI prompt generation and patch handoff. | Hunk/line approval, side-by-side diff, local-first agent compatibility, and confidence-oriented review. |
| [LaReview](https://lareview.dev/) | Open source | Paste unified diff or PR URL, fetch locally through CLI tools, review plan, export feedback, and local context positioning. | Code-review feedback workbench, not a patch application tool. | Unified-diff paste/import workflow, local-first messaging, and guided review stages. |
| [Reviu](https://reviu.dev/) | Free local Git client | Real-time diff editor, inline/split diff layouts, hunk staging, conflict resolution, keyboard-first flow. | General Git review/commit app with pro forge features; no AI patch prompt handoff. | Inline/split diff toggle, precise hunk workflows, and review-before-commit mental model. |

## Implementation Choices

PatchBridge imports these ideas without copying code or assets:

- Local-first trust model: project files are only read locally and are never sent to an external API.
- Explicit source-context selection before prompt generation.
- Model-targeted prompts that demand a single Git unified diff and no Markdown wrapper.
- Patch validation before mutation using a dry check equivalent to `git apply --check`.
- Granular approval that can rebuild a filtered patch from approved files, hunks, and eligible lines.
- A guided flow for developers who do not want to assemble the workflow manually.

## Related Technical Sources

- Electron security guidance recommends current Electron versions, context isolation, renderer sandboxing, restrictive CSP, and careful `shell.openExternal` handling: <https://www.electronjs.org/docs/latest/tutorial/security>
- Electron context isolation guidance recommends exposing one narrow API per IPC action rather than raw IPC access: <https://www.electronjs.org/docs/latest/tutorial/context-isolation>
- Git documentation defines `git apply --check` as a way to check whether a patch applies without applying it: <https://git-scm.com/docs/git-apply>

## Dependency and Inspiration Notes

No proprietary code, branding, icons, screenshots, or assets from competitors are included. The app uses custom PatchBridge logo sources in `logos/logo.svg` and `logos/logo.png`.

PatchBridge itself is released into the public domain through the Unlicense. Runtime and build dependencies are open-source compatible:

- Electron: MIT license.
- electron-builder: MIT license.
- Node.js standard library modules for filesystem, path, child process, and OS integration.
