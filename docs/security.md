# Security Model

PatchBridge assumes patches are untrusted input.

## Local Processing

- Project files are never sent to external services by PatchBridge.
- The desktop app makes no network calls except opening allowlisted documentation, download, and creator links after the user clicks them.
- Generated prompts may contain source code. Users should paste prompts only into trusted AI tools.
- Source launchers run `npm install` before startup and may download development dependencies from the npm registry; this is separate from PatchBridge's project-file processing.

## Patch Safety

Before applying a patch, PatchBridge:

- Parses Git unified diff structure.
- Blocks binary patches.
- Blocks absolute paths.
- Blocks drive-letter paths such as `C:\...`.
- Blocks `../` path traversal.
- Blocks version-control metadata paths such as `.git`, `.hg`, and `.svn`.
- Resolves all patch paths inside the selected project folder.
- Blocks patch targets that pass through existing symbolic links.
- Blocks patches that create or modify symbolic links.
- Runs `git apply --check` before mutation.
- Warns on dirty Git worktrees.
- Warns when patches touch untracked files.
- Asks for confirmation before applying.
- Allows reverse apply only for the last patch applied in the current session, after a reverse dry check and explicit confirmation.

## Git Commands

PatchBridge only runs fixed Git commands:

- `git --version`
- `git rev-parse --is-inside-work-tree`
- `git branch --show-current`
- `git status --porcelain=v1 -z`
- `git diff ...` with user-provided refs rejected if they look like command options or contain control characters
- `git apply --check --whitespace=nowarn -`
- `git apply --whitespace=nowarn -`
- `git apply --reverse --check --whitespace=nowarn -`
- `git apply --reverse --whitespace=nowarn -`
- `git branch patchbridge-backup-...`

Commands are spawned without a shell and patch text is passed through stdin.

## Electron Hardening

- Renderer `nodeIntegration` is disabled.
- `contextIsolation` is enabled.
- Renderer sandboxing is enabled.
- A restrictive Content Security Policy is set.
- Raw IPC is not exposed to renderer code.
- External links are allowlisted.

## Reporting Vulnerabilities

See [SECURITY.md](../SECURITY.md).
