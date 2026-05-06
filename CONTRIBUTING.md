# Contributing

Thanks for helping improve PatchBridge.

PatchBridge is public-domain software released under the Unlicense. Contributions should be offered on that same basis so the project stays easy to use, fork, publish, and maintain.

## Development Setup

```bash
npm install
npm test
npm start
```

## Working Principles

- Keep processing local by default.
- Do not add AI provider calls without an explicit privacy review.
- Do not execute arbitrary commands from patches or prompts.
- Prefer small, testable modules in `src/core/`.
- Add tests for scanner, parser, path safety, Git wrapper, or prompt changes.
- Keep UI calm, readable, and developer-focused.

## Good First Issues

- Add language-specific source extension detection tests.
- Improve diff rendering for renamed files.
- Add more prompt target presets.
- Improve scanner warnings for very large repositories.
- Add screenshot automation for release builds.

## Pull Requests

Before opening a PR:

- Run `npm test`.
- Update docs if user-facing behavior changed.
- Include screenshots for UI changes.
- Explain any security-sensitive changes.

## Commit Style

Use clear, descriptive commits. Conventional Commits are welcome but not required.
