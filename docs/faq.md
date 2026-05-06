# FAQ

## Does PatchBridge call AI APIs?

No. PatchBridge generates prompts and lets you paste them into a trusted AI tool yourself.

## Does PatchBridge upload my project?

No. Scanning, prompt generation, patch parsing, and Git validation run locally.

## Can PatchBridge work outside Git repositories?

Patch preview can work, and `git apply` can check/apply patches in a plain folder when Git is installed. Git status, branch comparison, backup branches, and revert-oriented workflows require a Git repository.

## Can I include ignored files?

Yes. The scanner excludes common generated folders by default, but the scanner view has an option to show ignored folders for manual inclusion. Version-control metadata folders such as `.git` remain hard-blocked.

## Why require Git?

Git provides battle-tested unified-diff validation and application through `git apply --check` and `git apply`.

## Can I approve only some AI changes?

Yes. PatchBridge supports file-level and hunk-level approval. For normal text modifications and new text files, changed lines can also be rejected and PatchBridge rebuilds a filtered patch. Deleted files are intentionally limited to file-level approval because partial deletion previews can be misleading.

## Does the diff viewer include staged changes?

Yes. The working-tree comparison uses Git's `HEAD` comparison so staged and unstaged changes are shown against the last commit.

## What is not implemented yet?

See [ROADMAP.md](../ROADMAP.md). Planned improvements include richer syntax highlighting, more advanced line pairing in side-by-side view, and optional native packaging/signing automation.
