# Specification Compliance Review

Review date: May 7, 2026.

This checklist maps the original product specification to the current implementation.

## Research and Inspiration

- Complete: competitor research matrix in `docs/research.md`.
- Complete: inspiration notes document Aider, SourceGit, ECA, GitWand, LaReview, and Reviu.
- Complete: no competitor code, branding, icons, screenshots, or proprietary assets are included.
- Complete: prompt presets cite public prompting references in `docs/prompt-guide.md`.

## Desktop App and Platforms

- Complete: Electron app runs on Windows, macOS, and Linux.
- Complete: filesystem and paths use Node `path` APIs plus explicit POSIX patch-path normalization.
- Complete: OS-specific build commands are documented in `README.md` and `docs/build.md`.
- Complete: setup wizard reports unsupported platforms and blocks critical requirements.

## Visual Style and Branding

- Complete: minimal Fluent-inspired UI with restrained brand accents in `app/renderer/styles.css`.
- Complete: app name and logo are present in desktop UI, docs, icon assets, and GitHub Pages.
- Complete: modern SVG renderer logo and PNG packaged icon sources are present in `logos/`.

## First-Run Setup

- Complete: first-run wizard checks Git availability and Git 2.30+ support.
- Complete: OS-specific install commands and official links are shown.
- Complete: user can re-check after installation.
- Complete: wizard overlay blocks patch workflows until critical checks pass.

## Project Scanner

- Complete: local folder selection and recursive scan.
- Complete: project tree with file/folder checkboxes.
- Complete: ignores `.git`, `node_modules`, `dist`, `build`, `.next`, `target`, `vendor`, and other common generated folders.
- Complete: source detection, binary detection, large-file handling, size display, character/token estimate, manual include/exclude, and optional ignored-folder expansion.
- Complete: prompt size warnings are shown against target-model thresholds.

## Prompt Generation

- Complete: user request input, target selector, editable generated prompt, copy action, and size estimate.
- Complete: targets are ChatGPT, Claude, Gemini, and Generic LLM.
- Complete: required Git unified diff output contract is enforced in every generated prompt.
- Complete: selected file contents are included with repository-relative paths.
- Complete: no network call is made to any AI provider.

## Patch Import, Validation, and Apply

- Complete: import `.patch`/`.diff` files and paste patch text manually.
- Complete: Git unified diff parser detects files, hunks, additions, deletions, quoted paths, binary patch markers, and malformed hunk counts.
- Complete: path safety blocks absolute paths, drive-letter paths, null bytes, and traversal.
- Complete: path safety blocks version-control metadata targets such as `.git`, `.hg`, and `.svn`.
- Complete: filesystem validation blocks existing symlink targets to prevent writes outside the selected folder.
- Complete: patch validation blocks symlink file modes before `git apply` can create or modify symlinks.
- Complete: dry validation uses `git apply --check`.
- Complete: apply requires validation and confirmation.
- Complete: controlled Git commands are spawned without a shell and patch text goes through stdin.
- Complete: dirty worktree and untracked-file warnings are shown.

## Granular Approval

- Complete: apply full approved patch by default.
- Complete: approve/reject all controls.
- Complete: file-level and hunk-level approval.
- Complete: line-level approval for modified text files and new text files where technically safe.
- Complete: deleted files are kept file-level to avoid misleading partial deletion patches.
- Complete: approved changes are rebuilt into a filtered patch before validation/apply.

## Diff Viewer

- Complete: working tree vs last Git commit includes staged and unstaged changes by comparing against `HEAD`.
- Complete: working tree vs selected branch, with option-looking and control-character refs rejected.
- Complete: working tree vs selected commit, with option-looking and control-character refs rejected.
- Complete: imported patch vs current project through before/after preview.
- Complete: imported patch unified and side-by-side views.
- Complete: file-level summary.
- Complete: failed patch paths and failed hunks are surfaced from `git apply --check` output where Git reports enough detail.

## Magic Flow

- Complete: all requested steps are represented in `app/renderer/app.js`.
- Complete: each step is also available independently through sidebar views.
- Complete: final recommendations send users to the diff viewer to inspect the working tree before committing.

## Security

- Complete: no arbitrary commands from patches.
- Complete: desktop app processing has no source uploads or automatic external network calls.
- Complete: external app links are user-clicked and allowlisted.
- Complete: patch paths are sanitized and resolved inside the selected project folder.
- Complete: symlink patch targets are blocked.
- Complete: backup branch creation is available for Git repositories.
- Complete: reverse apply is limited to the last applied session patch and requires confirmation plus reverse dry check.

## GitHub Readiness

- Complete: README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, CHANGELOG, ROADMAP, docs, issue templates, PR template, CI, Pages workflow, screenshot placeholders, icon placeholders, FAQ, architecture docs, build docs, good-first-issue suggestions, public-domain license text, and release checklist are present.
- Complete: GitHub Pages source lives in `site/`.
- Complete: test suite covers parser, scanner, prompt contract, approval filtering, preview generation, path safety, and Git diff command construction.
