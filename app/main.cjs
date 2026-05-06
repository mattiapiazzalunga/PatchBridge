"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow, Menu, dialog, ipcMain, nativeImage, shell } = require("electron");
const { buildFilteredPatch, createDefaultApprovals } = require("../src/core/patchFilter");
const { checkRequirements } = require("../src/core/requirements");
const { generatePrompt } = require("../src/core/prompt");
const { getGitStatus, applyCheck, applyPatch, createBackupBranch, getDiff, reverseApplyCheck, reverseApplyPatch } = require("../src/core/git");
const { parseUnifiedDiff } = require("../src/core/patchParser");
const { buildPatchPreviews } = require("../src/core/patchPreview");
const { readSelectedFiles, scanProject } = require("../src/core/scanner");
const { validateParsedPatchFilesystem } = require("../src/core/security");

const ALLOWED_EXTERNAL_HOSTS = new Set([
  "brew.sh",
  "docs.github.com",
  "electronjs.org",
  "git-scm.com",
  "github.com",
  "mattiapiazzalunga.com",
  "nodejs.org",
  "www.mattiapiazzalunga.com",
]);

let mainWindow;
let trustedRendererUrl = "";

function appIcon() {
  return nativeImage.createFromPath(path.join(__dirname, "..", "logos", "logo.png"));
}

function createWindow() {
  const icon = appIcon();

  mainWindow = new BrowserWindow({
    autoHideMenuBar: true,
    backgroundColor: "#f7f9fc",
    height: 920,
    icon,
    minHeight: 560,
    minWidth: 390,
    show: false,
    title: "PatchBridge",
    width: 1440,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
      sandbox: true,
    },
  });

  const rendererPath = path.join(__dirname, "renderer", "index.html");
  trustedRendererUrl = pathToFileURL(rendererPath).toString();

  mainWindow.loadFile(rendererPath);
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url !== trustedRendererUrl) {
      event.preventDefault();
    }
  });
}

function assertTrustedSender(event) {
  const senderUrl = event.senderFrame && event.senderFrame.url ? event.senderFrame.url : "";
  if (senderUrl !== trustedRendererUrl) {
    throw new Error("Untrusted renderer blocked.");
  }
}

function registerHandler(channel, handler) {
  ipcMain.handle(channel, async (event, payload) => {
    assertTrustedSender(event);
    return handler(payload);
  });
}

async function parseAndSecure(root, patchText) {
  const parsed = parseUnifiedDiff(patchText);
  const security = root ? await validateParsedPatchFilesystem(root, parsed) : { affectedPaths: [], errors: [], ok: true, warnings: [] };
  return { parsed, security };
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  if (process.platform === "darwin") {
    app.dock.setIcon(appIcon());
  }
  createWindow();

  registerHandler("requirements:check", () => checkRequirements());

  registerHandler("links:open", async ({ url }) => {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !ALLOWED_EXTERNAL_HOSTS.has(parsed.hostname)) {
      throw new Error("External link is not in the PatchBridge allowlist.");
    }
    await shell.openExternal(url);
    return { ok: true };
  });

  registerHandler("project:selectFolder", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"],
      title: "Select a project folder",
    });
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
  });

  registerHandler("project:scan", ({ includeIgnored, root } = {}) => scanProject(root, { includeIgnored: Boolean(includeIgnored) }));
  registerHandler("project:readFiles", ({ root, paths }) => readSelectedFiles(root, paths));
  registerHandler("project:gitStatus", ({ root }) => getGitStatus(root));

  registerHandler("prompt:generate", ({ request, target, files }) => generatePrompt({ request, target, files }));

  registerHandler("patch:importFile", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      filters: [
        { extensions: ["patch", "diff"], name: "Patch files" },
        { extensions: ["*"], name: "All files" },
      ],
      properties: ["openFile"],
      title: "Import a patch or diff",
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    const filePath = result.filePaths[0];
    return {
      content: await fs.readFile(filePath, "utf8"),
      path: filePath,
    };
  });

  registerHandler("patch:parse", ({ patchText }) => {
    const parsed = parseUnifiedDiff(patchText);
    return {
      approvals: createDefaultApprovals(parsed),
      parsed,
    };
  });

  registerHandler("patch:buildFiltered", ({ parsedPatch, approvals }) => buildFilteredPatch(parsedPatch, approvals));

  registerHandler("patch:validate", async ({ root, patchText }) => {
    const { parsed, security } = await parseAndSecure(root, patchText);
    if (!parsed.isValidStructure || !security.ok) {
      return {
        applyCheck: { ok: false, stderr: "Patch structure or security validation failed.", stdout: "" },
        parsed,
        security,
      };
    }
    const applyResult = await applyCheck(root, patchText);
    return {
      applyCheck: applyResult,
      parsed,
      security,
    };
  });

  registerHandler("patch:preview", async ({ root, patchText }) => {
    const { parsed, security } = await parseAndSecure(root, patchText);
    if (!parsed.isValidStructure || !security.ok) {
      return {
        parsed,
        previews: [],
        security,
      };
    }
    return {
      parsed,
      previews: await buildPatchPreviews(root, parsed),
      security,
    };
  });

  registerHandler("patch:apply", async ({ createBackup, patchText, root }) => {
    const { parsed, security } = await parseAndSecure(root, patchText);
    if (!parsed.isValidStructure || !security.ok) {
      return {
        apply: { ok: false, stderr: "Patch structure or security validation failed.", stdout: "" },
        backup: null,
        parsed,
        security,
      };
    }

    const check = await applyCheck(root, patchText);
    if (!check.ok) {
      return { apply: check, backup: null, parsed, security };
    }

    let backup = null;
    if (createBackup) {
      backup = await createBackupBranch(root);
      if (!backup.ok) {
        return {
          apply: { ok: false, stderr: `Backup branch failed: ${backup.stderr}`, stdout: backup.stdout },
          backup,
          parsed,
          security,
        };
      }
    }

    const applied = await applyPatch(root, patchText);
    return {
      apply: applied,
      backup,
      parsed,
      security,
    };
  });

  registerHandler("patch:revert", async ({ patchText, root }) => {
    const { parsed, security } = await parseAndSecure(root, patchText);
    if (!parsed.isValidStructure || !security.ok) {
      return {
        apply: { ok: false, stderr: "Patch structure or security validation failed.", stdout: "" },
        check: null,
        parsed,
        security,
      };
    }
    const check = await reverseApplyCheck(root, patchText);
    if (!check.ok) {
      return { apply: check, check, parsed, security };
    }
    const applied = await reverseApplyPatch(root, patchText);
    return { apply: applied, check, parsed, security };
  });

  registerHandler("diff:load", async ({ mode, ref, root }) => {
    const result = await getDiff(root, mode, ref);
    return {
      diff: result.stdout,
      parsed: parseUnifiedDiff(result.stdout),
      result,
    };
  });
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
