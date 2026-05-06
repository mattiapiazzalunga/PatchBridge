# Build Guide

## Prerequisites

- Node.js 22.12+
- npm 10+
- Git 2.30+

Install dependencies:

```bash
npm install
```

Run locally:

```bash
npm start
```

Platform launchers:

- Windows: double-click `Launch PatchBridge.vbs`.
- macOS: double-click `Launch PatchBridge.command`. If needed, run `chmod +x "Launch PatchBridge.command"` once.
- Linux: run `./launch-patchbridge.sh`, or open `Launch PatchBridge.desktop` from a file manager that supports desktop launchers. If needed, run `chmod +x launch-patchbridge.sh "Launch PatchBridge.desktop"` once.

Each launcher checks Git, Node.js, and npm, highlights missing or outdated requirements, runs `npm install`, and starts the app. `npm install` may download development dependencies from the npm registry.

Run tests:

```bash
npm test
```

## Windows

```powershell
npm install
npm run build:win
```

Outputs:

- NSIS installer
- Portable executable

Git install options:

```powershell
winget install --id Git.Git -e
```

## macOS

```bash
npm install
npm run build:mac
```

Outputs:

- dmg
- zip

Git install options:

```bash
xcode-select --install
brew install git
```

Code signing and notarization are release-maintainer responsibilities.

## Linux

```bash
npm install
npm run build:linux
```

Outputs:

- AppImage
- deb
- rpm

Git install options:

```bash
sudo apt install git
sudo dnf install git
sudo pacman -S git
```
