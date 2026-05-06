# Security Policy

## Supported Versions

PatchBridge is pre-1.0. Security fixes are accepted for the latest released version and the `master` branch.

## Reporting a Vulnerability

Please do not open a public issue for a vulnerability. Use GitHub Security Advisories for the repository when available. Until a project-specific private contact is published, contact the maintainers through a trusted private channel before public disclosure.

Include:

- Affected version or commit.
- Operating system.
- Reproduction steps.
- Impact and likely exploitability.
- Any suggested fix.

## Scope

Security-sensitive areas include:

- Patch path validation.
- `git apply` invocation.
- External link allowlisting.
- Renderer/main IPC boundary.
- Project file scanning and prompt generation.

PatchBridge never intentionally uploads project files. Any behavior that sends source externally without explicit user action is considered a security issue.
