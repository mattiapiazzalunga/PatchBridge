"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("patchbridge", {
  applyPatch: (payload) => ipcRenderer.invoke("patch:apply", payload),
  buildFilteredPatch: (payload) => ipcRenderer.invoke("patch:buildFiltered", payload),
  checkRequirements: () => ipcRenderer.invoke("requirements:check"),
  generatePrompt: (payload) => ipcRenderer.invoke("prompt:generate", payload),
  getGitStatus: (payload) => ipcRenderer.invoke("project:gitStatus", payload),
  importPatchFile: () => ipcRenderer.invoke("patch:importFile"),
  loadDiff: (payload) => ipcRenderer.invoke("diff:load", payload),
  openExternal: (payload) => ipcRenderer.invoke("links:open", payload),
  parsePatch: (payload) => ipcRenderer.invoke("patch:parse", payload),
  previewPatch: (payload) => ipcRenderer.invoke("patch:preview", payload),
  readProjectFiles: (payload) => ipcRenderer.invoke("project:readFiles", payload),
  revertPatch: (payload) => ipcRenderer.invoke("patch:revert", payload),
  scanProject: (payload) => ipcRenderer.invoke("project:scan", payload),
  selectProjectFolder: () => ipcRenderer.invoke("project:selectFolder"),
  validatePatch: (payload) => ipcRenderer.invoke("patch:validate", payload),
});
