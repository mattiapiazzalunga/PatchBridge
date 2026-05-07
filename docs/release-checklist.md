# Release Checklist

- Update `CHANGELOG.md`.
- Confirm `LICENSE`, package metadata, README badges, and site footer all reflect the current public-domain license.
- Confirm `npm test` passes on Windows, macOS, and Linux runners.
- Build Windows, macOS, and Linux artifacts.
- Verify first-run setup wizard on a clean machine.
- Validate patch apply and backup branch behavior in a disposable repository.
- Capture screenshots and update `docs/screenshots/`.
- Review dependency versions and Electron security advisories.
- Tag release as `vX.Y.Z`.
- Publish GitHub Release with checksums.
- Enable GitHub Pages in repository settings with GitHub Actions as the source, then confirm deployment.
