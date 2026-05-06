# PatchBridge

[![CI](https://github.com/mattiapiazzalunga/PatchBridge/actions/workflows/ci.yml/badge.svg)](https://github.com/mattiapiazzalunga/PatchBridge/actions/workflows/ci.yml)
[![Public Domain: Unlicense](https://img.shields.io/badge/public%20domain-Unlicense-blue.svg)](LICENSE)
[![Platforms](https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-2b88ff.svg)](#platform-support)
[![Release](https://img.shields.io/badge/release-0.1.0-lightgrey.svg)](CHANGELOG.md)

PatchBridge - Apply AI-generated patches safely.

Scan your project, generate AI-ready prompts, review diffs, and apply patches with confidence.

PatchBridge is a public-domain, local-first, cross-platform desktop app for developers who use AI tools that return `.patch` or `.diff` files. It helps you choose source context, generate model-specific patch prompts, validate AI-generated Git unified diffs, approve changes at file/hunk/line level, and apply only the approved patch to a local project.

## Highlights

- First-run setup wizard for Git availability and supported versions.
- Project scanner with common ignore rules, optional ignored-folder expansion, binary detection, source-file detection, file sizes, and token estimates.
- Prompt generator for ChatGPT, Claude, Gemini, and generic LLMs.
- Patch import by file or paste, unified-diff parsing, path safety checks, symlink-patch blocking, and `git apply --check` dry validation.
- Granular approval by file, hunk, and eligible changed lines, with filtered patch generation.
- Unified, side-by-side, and before/after views for imported patches and Git working tree comparisons.
- Guided Magic Flow from project selection to final patch application.
- The desktop app makes no automatic network calls and never uploads source files.
- Released into the public domain via the Unlicense so anyone can use, fork, publish, and improve it.

## Screenshots

Screenshot placeholders live in `docs/screenshots/`. Add release screenshots there and update the GitHub Pages landing page when UI changes materially.

## Platform Support

PatchBridge targets:

- Windows 10/11
- macOS 13 or newer
- Modern Linux desktop distributions with AppImage, deb, or rpm support

Runtime requirement:

- Git 2.30.0 or newer must be available on `PATH`.

Development requirements:

- Node.js 22.12 or newer
- npm 10 or newer
- Git 2.30.0 or newer

## Install for Development

Windows one-click startup:

Double-click `Launch PatchBridge.vbs` from the repository root. The launcher checks Git, Node.js, and npm, highlights missing or outdated requirements, runs `npm install`, and starts PatchBridge without opening a console. `npm install` may download development dependencies from the npm registry.

macOS startup:

Double-click `Launch PatchBridge.command`, or run it from Terminal. If macOS says it is not executable, run `chmod +x "Launch PatchBridge.command"` once.

Linux startup:

Run `./launch-patchbridge.sh`, or use `Launch PatchBridge.desktop` from a file manager that supports desktop launchers. If needed, run `chmod +x launch-patchbridge.sh "Launch PatchBridge.desktop"` once.

Manual startup:

```bash
npm install
npm start
```

The desktop app processes local files only. AI prompts may contain source code; paste them only into AI tools you trust.

## Build

Windows:

```powershell
npm install
npm run build:win
```

macOS:

```bash
npm install
npm run build:mac
```

Linux:

```bash
npm install
npm run build:linux
```

Artifacts are written to `release/`.

## Git Installation Help

Windows:

```powershell
winget install --id Git.Git -e
```

macOS:

```bash
xcode-select --install
# or
brew install git
```

Linux:

```bash
sudo apt install git
# or
sudo dnf install git
# or
sudo pacman -S git
```

Official downloads: <https://git-scm.com/downloads>

## Architecture

PatchBridge uses Electron with a sandboxed renderer, `contextIsolation`, disabled Node integration, and a narrow preload API. Core logic lives in `src/core/` as testable Node modules:

- `scanner.js`: local project scanning and prompt-safe file reads.
- `prompt.js`: model-targeted patch prompt construction.
- `patchParser.js`: Git unified-diff parser.
- `patchFilter.js`: file/hunk/line approval and filtered patch generation.
- `security.js` and `paths.js`: patch path validation and project containment.
- `git.js`: controlled Git subprocess calls with fixed argument lists.

See [docs/architecture.md](docs/architecture.md) and [docs/security.md](docs/security.md).

## Research

Before implementation, PatchBridge was compared with open-source and related tools including Aider, SourceGit, ECA, GitWand, LaReview, and Reviu. The feature matrix and adopted ideas are documented in [docs/research.md](docs/research.md). No competitor code, branding, icons, or assets were copied.

## Test

```bash
npm test
```

The current test suite covers path safety, symlink blocking, patch parsing, filtered patch generation, prompt contract text, scanner defaults, ignored-folder expansion, before/after previews, and Git command construction.

## Documentation

- [Build guide](docs/build.md)
- [Architecture](docs/architecture.md)
- [Security model](docs/security.md)
- [Magic Flow](docs/magic-flow.md)
- [Prompt guide](docs/prompt-guide.md)
- [Specification compliance review](docs/spec-compliance.md)
- [FAQ](docs/faq.md)
- [Roadmap](ROADMAP.md)

## Contributing

Contributions are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md), [ROADMAP.md](ROADMAP.md), and issues labeled `good first issue`.

## License

PatchBridge is released into the public domain under the [Unlicense](LICENSE).
