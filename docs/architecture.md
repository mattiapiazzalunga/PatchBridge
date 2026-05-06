# Architecture

PatchBridge is an Electron desktop app with a small, testable Node core.

## Why Electron

The app needs cross-platform desktop filesystem access, folder selection, clipboard support, and controlled Git subprocesses. Electron gives a mature Windows/macOS/Linux packaging path while allowing the security-sensitive logic to stay in Node modules that can be tested without the desktop runtime.

Tauri was considered because it is lightweight and native, but it requires a Rust toolchain for development and build. PatchBridge currently favors the simplest reliable implementation for contributors using common JavaScript tooling.

## Process Model

- Main process: owns filesystem reads, patch imports, Git commands, external link opening, and dialogs.
- Preload script: exposes a narrow `window.patchbridge` API through `contextBridge`.
- Renderer: displays UI and sends structured requests. It has no Node integration.

## Core Modules

- `src/core/paths.js`: cross-platform path normalization and containment.
- `src/core/scanner.js`: recursive project scan, common ignore rules, optional ignored-folder expansion, binary detection, file size and token estimates.
- `src/core/prompt.js`: patch-only prompt generation for ChatGPT, Claude, Gemini, and generic LLMs.
- `src/core/patchParser.js`: Git unified diff parser.
- `src/core/patchFilter.js`: approval state and filtered patch reconstruction.
- `src/core/patchPreview.js`: before/after patch previews for text files.
- `src/core/security.js`: patch path validation and binary patch blocking.
- `src/core/git.js`: controlled `git` calls with fixed argument arrays and no shell execution.

## Data Flow

1. User selects a project folder.
2. Main process scans files and returns metadata.
3. Renderer tracks selected files and asks main process to read selected text files.
4. Prompt generator builds an editable prompt locally.
5. User imports or pastes AI-generated patch text.
6. Parser and security checks identify affected files and unsafe paths.
7. User approves files, hunks, or eligible lines.
8. PatchBridge can build before/after previews from the approved filtered patch.
9. Filtered patch is dry-checked with `git apply --check`.
10. On confirmation, main process applies the approved patch with `git apply`.

## Non-Goals for MVP

- No built-in AI provider calls.
- No automatic upload of source code.
- No arbitrary shell command execution.
- No custom merge engine.
