"use strict";

const os = require("node:os");
const childProcess = require("node:child_process");

const MINIMUMS = {
  git: { major: 2, minor: 30, patch: 0 },
  node: { major: 22, minor: 12, patch: 0 },
  npm: { major: 10, minor: 0, patch: 0 },
};

const INSTALL_HELP = {
  darwin: {
    commands: ["xcode-select --install", "brew install git"],
    label: "macOS",
    links: [
      { label: "Git for macOS", url: "https://git-scm.com/download/mac" },
      { label: "Homebrew", url: "https://brew.sh/" },
    ],
  },
  linux: {
    commands: ["sudo apt install git", "sudo dnf install git", "sudo pacman -S git"],
    label: "Linux",
    links: [{ label: "Git for Linux", url: "https://git-scm.com/download/linux" }],
  },
  win32: {
    commands: ["winget install --id Git.Git -e", "choco install git"],
    label: "Windows",
    links: [{ label: "Git for Windows", url: "https://git-scm.com/download/win" }],
  },
};

const NODE_HELP = {
  darwin: {
    commands: ["brew install node"],
    label: "macOS",
    links: [{ label: "Node.js downloads", url: "https://nodejs.org/en/download" }],
  },
  linux: {
    commands: ["Use your distribution package manager or nvm to install Node.js 22.12+"],
    label: "Linux",
    links: [{ label: "Node.js downloads", url: "https://nodejs.org/en/download" }],
  },
  win32: {
    commands: ["winget install OpenJS.NodeJS.LTS"],
    label: "Windows",
    links: [{ label: "Node.js for Windows", url: "https://nodejs.org/en/download" }],
  },
};

function runCommand(command, args, cwd = process.cwd(), timeoutMs = 10000) {
  return new Promise((resolve) => {
    let child;
    try {
      child = childProcess.spawn(command, args, {
        cwd,
        shell: process.platform === "win32",
        windowsHide: true,
      });
    } catch (error) {
      resolve({ code: 127, ok: false, stderr: error.message, stdout: "" });
      return;
    }
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill();
        resolve({ code: 124, ok: false, stderr: `${command} command timed out.`, stdout });
      }
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve({ code: 127, ok: false, stderr: error.message, stdout });
      }
    });
    child.on("close", (code) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve({ code, ok: code === 0, stderr, stdout });
      }
    });
  });
}

function parseSemver(output) {
  const match = /v?(\d+)\.(\d+)\.(\d+)/i.exec(output || "");
  if (!match) {
    return null;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    raw: `${match[1]}.${match[2]}.${match[3]}`,
  };
}

function isVersionAtLeast(version, minimum) {
  if (!version) return false;
  if (version.major !== minimum.major) return version.major > minimum.major;
  if (version.minor !== minimum.minor) return version.minor > minimum.minor;
  return version.patch >= minimum.patch;
}

async function checkToolAvailable({ args, command, minimum }) {
  const result = await runCommand(command, args);
  const version = parseSemver(result.stdout || result.stderr);
  return {
    installed: result.ok,
    raw: (result.stdout || result.stderr).trim(),
    supported: result.ok && isVersionAtLeast(version, minimum),
    version,
  };
}

async function checkRequirements() {
  const platform = os.platform();
  const supportedPlatform = Object.prototype.hasOwnProperty.call(INSTALL_HELP, platform);
  const help = INSTALL_HELP[platform] || {
    commands: [],
    label: platform,
    links: [{ label: "Git downloads", url: "https://git-scm.com/downloads" }],
  };
  const nodeHelp = NODE_HELP[platform] || {
    commands: [],
    label: platform,
    links: [{ label: "Node.js downloads", url: "https://nodejs.org/en/download" }],
  };
  const git = await checkToolAvailable({ args: ["--version"], command: "git", minimum: MINIMUMS.git });
  const node = await checkToolAvailable({ args: ["--version"], command: "node", minimum: MINIMUMS.node });
  const npm = await checkToolAvailable({ args: ["--version"], command: "npm", minimum: MINIMUMS.npm });

  return {
    platform,
    requirements: [
      {
        critical: true,
        help: {
          commands: [],
          label: supportedPlatform ? help.label : platform,
          links: [{ label: "Supported platforms", url: "https://github.com/mattiapiazzalunga/PatchBridge#platform-support" }],
        },
        id: "platform",
        installed: supportedPlatform,
        message: supportedPlatform
          ? `${help.label} is supported.`
          : `PatchBridge supports Windows, macOS, and Linux. This platform was detected as ${platform}.`,
        name: "Supported operating system",
        supported: supportedPlatform,
        version: platform,
      },
      {
        critical: true,
        help,
        id: "git",
        installed: git.installed,
        message: git.installed
          ? git.supported
            ? `Git ${git.version.raw} is available.`
            : `Git ${git.version ? git.version.raw : "unknown"} is installed, but PatchBridge requires Git 2.30.0 or newer.`
          : "Git is required to validate and apply patches safely.",
        name: "Git command line tools",
        supported: git.supported,
        version: git.version ? git.version.raw : "",
      },
      {
        critical: false,
        help: nodeHelp,
        id: "node",
        installed: node.installed,
        message: node.installed
          ? node.supported
            ? `Node.js ${node.version.raw} is available.`
            : `Node.js ${node.version ? node.version.raw : "unknown"} is installed, but PatchBridge development startup requires Node.js 22.12.0 or newer.`
          : "Node.js is required when launching PatchBridge from the source checkout.",
        name: "Node.js runtime",
        supported: node.supported,
        version: node.version ? node.version.raw : "",
      },
      {
        critical: false,
        help: nodeHelp,
        id: "npm",
        installed: npm.installed,
        message: npm.installed
          ? npm.supported
            ? `npm ${npm.version.raw} is available.`
            : `npm ${npm.version ? npm.version.raw : "unknown"} is installed, but PatchBridge development startup requires npm 10.0.0 or newer.`
          : "npm is required to install dependencies before starting PatchBridge from source.",
        name: "npm package manager",
        supported: npm.supported,
        version: npm.version ? npm.version.raw : "",
      },
    ],
  };
}

module.exports = {
  INSTALL_HELP,
  MINIMUMS,
  NODE_HELP,
  checkRequirements,
  isVersionAtLeast,
  parseSemver,
};
