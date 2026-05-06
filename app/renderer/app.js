"use strict";

const api = window.patchbridge;

const state = {
  approvals: null,
  diffParsed: null,
  diffView: "unified",
  failedPaths: new Set(),
  failedHunks: new Set(),
  filteredPatch: "",
  git: null,
  patchParsed: null,
  patchPreviews: null,
  projectRoot: "",
  lastAppliedPatch: "",
  lastAppliedRoot: "",
  promptResult: null,
  request: "",
  scan: null,
  selectedPaths: new Set(),
  target: "ChatGPT",
  validation: null,
  worktreeView: "unified",
};

const PROMPT_WARNING_TOKENS = {
  ChatGPT: 120000,
  Claude: 180000,
  Gemini: 900000,
  "Generic LLM": 60000,
};

const ICONS = {
  check: '<path d="m5 12 4 4 10-10"></path>',
  columns: '<rect x="3" y="4" width="8" height="16" rx="2"></rect><rect x="13" y="4" width="8" height="16" rx="2"></rect>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>',
  diff: '<path d="M6 3v12"></path><path d="m3 12 3 3 3-3"></path><path d="M18 21V9"></path><path d="m15 12 3-3 3 3"></path><path d="M10 6h4"></path><path d="M10 18h4"></path>',
  external: '<path d="M15 3h6v6"></path><path d="M10 14 21 3"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"></path>',
  help: '<circle cx="12" cy="12" r="10"></circle><path d="M9.1 9a3 3 0 1 1 5.8 1c-.5.8-1.2 1.2-1.9 1.7-.6.4-1 .8-1 1.6"></path><path d="M12 17h.01"></path>',
  import: '<path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><path d="M5 21h14"></path>',
  parse: '<path d="M8 4H6a2 2 0 0 0-2 2v3a3 3 0 0 1-2 3 3 3 0 0 1 2 3v3a2 2 0 0 0 2 2h2"></path><path d="M16 4h2a2 2 0 0 1 2 2v3a3 3 0 0 0 2 3 3 3 0 0 0-2 3v3a2 2 0 0 1-2 2h-2"></path>',
  play: '<path d="m8 5 11 7-11 7Z"></path>',
  preview: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"></path><circle cx="12" cy="12" r="3"></circle>',
  prompt: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"></path><path d="M8 9h8"></path><path d="M8 13h5"></path>',
  review: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"></path><path d="M14 2v6h6"></path><path d="m8 15 2 2 5-5"></path>',
  revert: '<path d="M3 7v6h6"></path><path d="M21 17a9 9 0 0 0-15-6.7L3 13"></path>',
  scan: '<path d="M4 7V5a1 1 0 0 1 1-1h2"></path><path d="M17 4h2a1 1 0 0 1 1 1v2"></path><path d="M20 17v2a1 1 0 0 1-1 1h-2"></path><path d="M7 20H5a1 1 0 0 1-1-1v-2"></path><path d="M7 12h10"></path>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"></path><path d="m9 12 2 2 4-4"></path>',
  spark: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"></path><path d="M5 3v4"></path><path d="M3 5h4"></path><path d="M19 17v4"></path><path d="M17 19h4"></path>',
  unified: '<path d="M5 6h14"></path><path d="M5 12h14"></path><path d="M5 18h14"></path>',
  workflow: '<path d="M6 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"></path><path d="M18 13a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"></path><path d="M9 8h4a5 5 0 0 1 5 5"></path><path d="m15 10 3 3 3-3"></path>',
  x: '<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>',
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function icon(name) {
  const paths = ICONS[name];
  if (!paths) return "";
  return `<span class="button-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">${paths}</svg></span>`;
}

function buttonContent(label, iconName) {
  return `${icon(iconName)}<span>${escapeHtml(label)}</span>`;
}

function decorateIconButtons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((element) => {
    if (element.querySelector(".button-icon")) return;
    element.insertAdjacentHTML("afterbegin", icon(element.dataset.icon));
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(value || 0);
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function showAlert(message, type = "info") {
  const alerts = $("#alerts");
  if (!alerts) return;
  const element = document.createElement("div");
  element.className = `alert ${type}`;
  element.textContent = message;
  alerts.appendChild(element);
  setTimeout(() => element.remove(), 7000);
}

function reportError(error, fallback = "Something went wrong.") {
  showAlert(error && error.message ? error.message : fallback, "error");
}

function setLog(message) {
  $("#validationLog").textContent = message || "";
}

function invalidatePrompt({ rerenderMagic = true } = {}) {
  state.promptResult = null;
  updateSelectedStats();
  if (rerenderMagic) {
    renderMagic();
  }
}

function invalidatePatchDerivedState({ keepParsed = false } = {}) {
  if (!keepParsed) {
    state.approvals = null;
    state.patchParsed = null;
  }
  state.failedPaths = new Set();
  state.failedHunks = new Set();
  state.filteredPatch = keepParsed ? state.filteredPatch : $("#patchInput").value;
  state.patchPreviews = null;
  state.validation = null;
  setLog("");
}

function setView(view) {
  $$(".nav-item").forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle("active", active);
    button.toggleAttribute("aria-current", active);
  });
  $$("[data-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === view));
  if (view === "magic") {
    renderMagic();
  }
}

function walkTree(nodes, visitor) {
  for (const node of nodes || []) {
    visitor(node);
    if (node.children) {
      walkTree(node.children, visitor);
    }
  }
}

function collectFileNodes() {
  const files = [];
  if (!state.scan) return files;
  walkTree(state.scan.tree, (node) => {
    if (node.type === "file") files.push(node);
  });
  return files;
}

function isPromptEligible(node) {
  return node && node.type === "file" && !node.binary && (!node.ignored || (state.scan && state.scan.options && state.scan.options.includeIgnored));
}

function selectedStats() {
  const stats = { files: 0, size: 0, tokens: 0 };
  for (const node of collectFileNodes()) {
    if (state.selectedPaths.has(node.path)) {
      stats.files += 1;
      stats.size += node.size || 0;
      stats.tokens += node.tokenEstimate || 0;
    }
  }
  return stats;
}

function renderProjectStatus() {
  const chip = $("#projectChip");
  if (!state.projectRoot) {
    chip.textContent = "No project selected";
    return;
  }
  const gitText = state.git
    ? state.git.repository
      ? `${state.git.branch || "detached"} · ${state.git.clean ? "clean" : `${state.git.dirtyCount} changed`} · ${state.git.untrackedCount || 0} untracked`
      : "not a Git repository"
    : "checking Git";
  chip.textContent = `${state.projectRoot} · ${gitText}`;
}

async function refreshGitStatus() {
  if (!state.projectRoot) {
    state.git = null;
    renderProjectStatus();
    return;
  }
  state.git = await api.getGitStatus({ root: state.projectRoot });
  renderProjectStatus();
  if (state.git && !state.git.repository) {
    showAlert("This folder is not a Git repository. Patch preview can still work, but branch comparison, backup branches, and Git status features are limited.", "warn");
  }
}

async function selectProject() {
  const root = await api.selectProjectFolder();
  if (!root) return;
  state.projectRoot = root;
  state.scan = null;
  state.selectedPaths = new Set();
  await refreshGitStatus();
  renderScanner();
  renderMagic();
  showAlert("Project folder selected. Scan it to build prompt context.", "info");
}

async function scanCurrentProject() {
  if (!state.projectRoot) {
    await selectProject();
    if (!state.projectRoot) return;
  }
  state.scan = await api.scanProject({ root: state.projectRoot, includeIgnored: $("#includeIgnoredScan").checked });
  state.selectedPaths = new Set();
  walkTree(state.scan.tree, (node) => {
    if (node.includedByDefault) {
      state.selectedPaths.add(node.path);
    }
  });
  renderScanner();
  renderMagic();
  showAlert("Project scan complete.", "info");
}

function computeDirectorySelection(node) {
  let total = 0;
  let selected = 0;
  walkTree(node.children || [], (child) => {
    if (isPromptEligible(child)) {
      total += 1;
      if (state.selectedPaths.has(child.path)) selected += 1;
    }
  });
  return { checked: total > 0 && selected === total, indeterminate: selected > 0 && selected < total, total };
}

function setNodeSelection(node, checked) {
  if (isPromptEligible(node)) {
    if (checked) state.selectedPaths.add(node.path);
    else state.selectedPaths.delete(node.path);
  }
  for (const child of node.children || []) {
    setNodeSelection(child, checked);
  }
}

function renderTreeNode(node) {
  const wrapper = document.createElement("div");
  wrapper.className = "tree-node";

  const row = document.createElement("div");
  row.className = "tree-row";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  if (node.type === "directory") {
    const dirState = computeDirectorySelection(node);
    checkbox.checked = dirState.checked;
    checkbox.indeterminate = dirState.indeterminate;
    checkbox.disabled = dirState.total === 0;
  } else {
    checkbox.checked = state.selectedPaths.has(node.path);
    checkbox.disabled = !isPromptEligible(node);
  }
  checkbox.addEventListener("change", () => {
    setNodeSelection(node, checkbox.checked);
    invalidatePrompt();
    renderScanner();
    renderMagic();
  });

  const name = document.createElement("div");
  name.className = "tree-name";
  name.textContent = node.type === "directory" ? `${node.name}/` : node.name;

  const meta = document.createElement("div");
  meta.className = "tree-meta";
  if (node.type === "file") {
    const flags = [];
    if (node.binary) flags.push("binary");
    if (node.large) flags.push("large");
    if (node.source) flags.push("source");
    if (node.ignored) flags.push("ignored");
    meta.textContent = `${formatBytes(node.size)} · ${formatNumber(node.tokenEstimate)} tok${flags.length ? ` · ${flags.join(", ")}` : ""}`;
  } else {
    meta.textContent = node.ignored ? "ignored" : "";
  }

  row.append(checkbox, name, meta);
  wrapper.append(row);

  if (node.children && node.children.length) {
    const children = document.createElement("div");
    children.className = "tree-children";
    node.children.forEach((child) => children.append(renderTreeNode(child)));
    wrapper.append(children);
  }

  return wrapper;
}

function renderScanner() {
  const tree = $("#treeContainer");
  const summary = $("#scannerSummary");
  const ignoreRules = $("#ignoreRules");

  if (!state.scan) {
    tree.className = "tree empty-state";
    tree.textContent = state.projectRoot ? "Scan the selected project to show files." : "Select a project folder to begin.";
    summary.innerHTML = "";
    ignoreRules.innerHTML = "";
    updateSelectedStats();
    return;
  }

  tree.className = "tree";
  tree.innerHTML = "";
  state.scan.tree.forEach((node) => tree.append(renderTreeNode(node)));

  const s = state.scan.summary;
  summary.innerHTML = [
    ["Files", s.files],
    ["Source", s.sourceFiles],
    ["Binary", s.binaryFiles],
    ["Large", s.largeFiles],
    ["Ignored", s.ignored],
    ["Default tokens", s.tokenEstimate],
  ]
    .map(([label, value]) => `<span class="stat">${label}: ${formatNumber(value)}</span>`)
    .join("");

  ignoreRules.innerHTML = state.scan.ignoreRules.map((rule) => `<span class="tag">${escapeHtml(rule)}</span>`).join("");
  updateSelectedStats();
}

function updateSelectedStats() {
  const stats = selectedStats();
  $("#selectedContextStats").textContent = `${formatNumber(stats.files)} files · ${formatNumber(stats.tokens)} tokens · ${formatBytes(stats.size)}`;
  const promptStats = $("#promptStats");
  if (state.promptResult) {
    promptStats.textContent = `${formatNumber(state.promptResult.tokenEstimate)} estimated prompt tokens for ${state.promptResult.target}`;
    promptStats.classList.toggle("warn", state.promptResult.tooLarge);
    return;
  }
  const warningTokens = PROMPT_WARNING_TOKENS[state.target] || PROMPT_WARNING_TOKENS["Generic LLM"];
  const warning = stats.tokens > warningTokens;
  promptStats.textContent = `${formatNumber(stats.files)} selected files · about ${formatNumber(stats.tokens)} source tokens before prompt instructions${warning ? ` · exceeds common ${state.target} context guidance` : ""}`;
  promptStats.classList.toggle("warn", warning);
}

function syncPromptControls() {
  $("#requestInput").value = state.request;
  $("#targetSelect").value = state.target;
  if (state.promptResult) {
    $("#promptOutput").value = state.promptResult.prompt;
  }
  updateSelectedStats();
}

async function generatePromptFromSelection() {
  if (!state.projectRoot || !state.scan) {
    showAlert("Select and scan a project before generating a prompt.", "warn");
    return;
  }
  const selected = Array.from(state.selectedPaths);
  if (!selected.length) {
    showAlert("Select at least one source file or folder for prompt context.", "warn");
    return;
  }
  const read = await api.readProjectFiles({ paths: selected, root: state.projectRoot });
  for (const warning of read.warnings) {
    showAlert(warning, "warn");
  }
  state.promptResult = await api.generatePrompt({
    files: read.files,
    request: state.request,
    target: state.target,
  });
  $("#promptOutput").value = state.promptResult.prompt;
  updateSelectedStats();
  renderMagic();
  if (state.promptResult.tooLarge) {
    showAlert("The prompt exceeds the common context warning threshold for this target.", "warn");
  } else {
    showAlert("Prompt generated and ready to copy.", "info");
  }
}

async function copyText(value, label) {
  if (!value) {
    showAlert(`Nothing to copy for ${label}.`, "warn");
    return;
  }
  try {
    await navigator.clipboard.writeText(value);
    showAlert(`${label} copied.`, "info");
  } catch (error) {
    reportError(error, `${label} could not be copied.`);
  }
}

function initApprovals(parsed) {
  const approvals = { files: {}, hunks: {}, lines: {} };
  for (const file of parsed.files || []) {
    approvals.files[file.id] = true;
    for (const hunk of file.hunks) {
      approvals.hunks[hunk.id] = true;
      for (const line of hunk.lines) {
        if (line.type === "addition" || line.type === "deletion") {
          approvals.lines[line.id] = true;
        }
      }
    }
  }
  return approvals;
}

function lineAccepted(file, hunk, line) {
  if (!state.approvals) return true;
  if (state.approvals.files[file.id] === false || state.approvals.hunks[hunk.id] === false) return false;
  if (line.type !== "addition" && line.type !== "deletion") return true;
  return state.approvals.lines[line.id] !== false;
}

async function parsePatchInput() {
  const patchText = $("#patchInput").value;
  const result = await api.parsePatch({ patchText });
  state.patchParsed = result.parsed;
  state.approvals = result.approvals || initApprovals(result.parsed);
  state.failedPaths = new Set();
  state.failedHunks = new Set();
  state.patchPreviews = null;
  state.validation = null;
  await rebuildFilteredPatch();
  renderPatchReview();
  renderMagic();
  if (state.patchParsed.isValidStructure) {
    showAlert("Patch parsed. Review approvals before applying.", "info");
  } else {
    showAlert("Patch structure needs attention.", "warn");
  }
}

async function importPatchFile() {
  const result = await api.importPatchFile();
  if (!result) return;
  $("#patchInput").value = result.content;
  await parsePatchInput();
  showAlert(`Imported ${result.path}.`, "info");
}

async function rebuildFilteredPatch() {
  if (!state.patchParsed || !state.approvals) {
    state.filteredPatch = $("#patchInput").value;
    return state.filteredPatch;
  }
  const result = await api.buildFilteredPatch({ approvals: state.approvals, parsedPatch: state.patchParsed });
  state.filteredPatch = result.patch;
  state.patchPreviews = null;
  return state.filteredPatch;
}

function renderPatchSummary() {
  const summary = $("#patchSummary");
  if (!state.patchParsed) {
    summary.textContent = "No patch loaded";
    return;
  }
  const s = state.patchParsed.stats;
  summary.textContent = `${formatNumber(s.files)} files · +${formatNumber(s.additions)} -${formatNumber(s.deletions)} · ${formatNumber(s.hunks)} hunks`;
}

function renderPatchReview() {
  renderPatchSummary();
  const container = $("#patchReview");
  if (!state.patchParsed) {
    container.className = "diff-view empty-state";
    container.textContent = "Parse a patch to review affected files.";
    return;
  }
  if (!state.patchParsed.isValidStructure) {
    container.className = "diff-view";
    container.innerHTML = `<div class="alert error">${state.patchParsed.errors.map((error) => escapeHtml(error.message)).join("<br>")}</div>`;
    return;
  }
  if (state.diffView === "preview") {
    renderPatchPreview(container);
    return;
  }
  container.className = "diff-view";
  container.innerHTML = "";
  for (const file of state.patchParsed.files) {
    container.append(renderFileDiff(file, { approvals: true, mode: state.diffView }));
  }
  attachApprovalHandlers();
}

function renderFileDiff(file, options) {
  const wrapper = document.createElement("div");
  wrapper.className = "file-diff";
  const header = document.createElement("div");
  header.className = "file-header";

  const left = document.createElement("label");
  left.className = "checkbox-line";
  if (options.approvals) {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.fileId = file.id;
    checkbox.checked = state.approvals.files[file.id] !== false;
    left.append(checkbox);
  }
  const title = document.createElement("span");
  title.textContent = `${file.newPath || file.oldPath} (+${file.additions} -${file.deletions})`;
  left.append(title);

  const filePath = file.newPath || file.oldPath;
  if (state.failedPaths.has(filePath)) {
    const failed = document.createElement("span");
    failed.className = "status-badge failed";
    failed.textContent = "Cannot patch cleanly";
    left.append(failed);
  }

  const actions = document.createElement("div");
  actions.className = "button-row";
  if (options.approvals) {
    actions.innerHTML = `<button class="secondary" data-file-accept="${file.id}">${buttonContent("Approve", "check")}</button><button class="secondary" data-file-reject="${file.id}">${buttonContent("Reject", "x")}</button>`;
  }

  header.append(left, actions);
  wrapper.append(header);

  for (const hunk of file.hunks) {
    const hunkHeader = document.createElement("div");
    hunkHeader.className = "hunk-header";
    const hunkLeft = document.createElement("label");
    hunkLeft.className = "checkbox-line";
    if (options.approvals) {
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.dataset.hunkId = hunk.id;
      checkbox.disabled = file.isDeleted;
      checkbox.checked = state.approvals.hunks[hunk.id] !== false && state.approvals.files[file.id] !== false;
      hunkLeft.append(checkbox);
    }
    const hunkText = document.createElement("span");
    hunkText.textContent = hunk.header;
    hunkLeft.append(hunkText);
    if (state.failedHunks.has(hunk.id)) {
      const failed = document.createElement("span");
      failed.className = "status-badge failed";
      failed.textContent = "Failed hunk";
      hunkLeft.append(failed);
    }
    hunkHeader.append(hunkLeft);
    wrapper.append(hunkHeader);

    if (options.mode === "split") {
      wrapper.append(renderSplitHunk(file, hunk));
    } else {
      for (const line of hunk.lines) {
        if (line.type === "meta") continue;
        wrapper.append(renderUnifiedLine(file, hunk, line, options.approvals));
      }
    }
  }
  return wrapper;
}

function renderUnifiedLine(file, hunk, line, approvalsEnabled) {
  const row = document.createElement("div");
  const accepted = lineAccepted(file, hunk, line);
  row.className = `diff-line ${line.type}${accepted ? "" : " rejected"}`;

  const approval = document.createElement("span");
  if (approvalsEnabled && (line.type === "addition" || line.type === "deletion") && !file.isDeleted) {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.lineId = line.id;
    checkbox.checked = accepted;
    approval.append(checkbox);
  }

  const prefix = document.createElement("span");
  prefix.className = "line-prefix";
  prefix.textContent = line.type === "addition" ? "+" : line.type === "deletion" ? "-" : " ";

  const code = document.createElement("code");
  code.textContent = line.content || " ";
  row.append(approval, prefix, code);
  return row;
}

function renderSplitHunk(file, hunk) {
  const grid = document.createElement("div");
  grid.className = "split-grid";
  const lines = hunk.lines.filter((line) => line.type !== "meta");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.type === "deletion" && lines[index + 1] && lines[index + 1].type === "addition") {
      appendSplitRow(grid, line.content, lines[index + 1].content, "deletion", "addition", lineAccepted(file, hunk, line) && lineAccepted(file, hunk, lines[index + 1]));
      index += 1;
      continue;
    }
    if (line.type === "deletion") {
      appendSplitRow(grid, line.content, "", "deletion", "context", lineAccepted(file, hunk, line));
    } else if (line.type === "addition") {
      appendSplitRow(grid, "", line.content, "context", "addition", lineAccepted(file, hunk, line));
    } else {
      appendSplitRow(grid, line.content, line.content, "context", "context", true);
    }
  }
  return grid;
}

function appendSplitRow(grid, leftText, rightText, leftClass, rightClass, accepted) {
  const left = document.createElement("div");
  left.className = `split-cell ${leftClass}${accepted ? "" : " rejected"}`;
  left.textContent = leftText || " ";
  const right = document.createElement("div");
  right.className = `split-cell ${rightClass}${accepted ? "" : " rejected"}`;
  right.textContent = rightText || " ";
  grid.append(left, right);
}

function attachApprovalHandlers() {
  $$("[data-file-id]").forEach((checkbox) => {
    checkbox.addEventListener("change", async () => {
      state.approvals.files[checkbox.dataset.fileId] = checkbox.checked;
      state.validation = null;
      state.failedPaths = new Set();
      state.failedHunks = new Set();
      await rebuildFilteredPatch();
      renderPatchReview();
    });
  });
  $$("[data-hunk-id]").forEach((checkbox) => {
    checkbox.addEventListener("change", async () => {
      state.approvals.hunks[checkbox.dataset.hunkId] = checkbox.checked;
      state.validation = null;
      state.failedPaths = new Set();
      state.failedHunks = new Set();
      await rebuildFilteredPatch();
      renderPatchReview();
    });
  });
  $$("[data-line-id]").forEach((checkbox) => {
    checkbox.addEventListener("change", async () => {
      state.approvals.lines[checkbox.dataset.lineId] = checkbox.checked;
      state.validation = null;
      state.failedPaths = new Set();
      state.failedHunks = new Set();
      await rebuildFilteredPatch();
      renderPatchReview();
    });
  });
  $$("[data-file-accept]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.approvals.files[button.dataset.fileAccept] = true;
      state.validation = null;
      state.failedPaths = new Set();
      state.failedHunks = new Set();
      await rebuildFilteredPatch();
      renderPatchReview();
    });
  });
  $$("[data-file-reject]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.approvals.files[button.dataset.fileReject] = false;
      state.validation = null;
      state.failedPaths = new Set();
      state.failedHunks = new Set();
      await rebuildFilteredPatch();
      renderPatchReview();
    });
  });
}

async function approveAllChanges(approved) {
  if (!state.patchParsed || !state.approvals) return;
  for (const file of state.patchParsed.files) {
    state.approvals.files[file.id] = approved;
    for (const hunk of file.hunks) {
      if (!file.isDeleted) state.approvals.hunks[hunk.id] = approved;
      for (const line of hunk.lines) {
        if ((line.type === "addition" || line.type === "deletion") && !file.isDeleted) {
          state.approvals.lines[line.id] = approved;
        }
      }
    }
  }
  state.validation = null;
  state.failedPaths = new Set();
  state.failedHunks = new Set();
  await rebuildFilteredPatch();
  renderPatchReview();
}

function extractFailedPatchFailures(stderr, parsedPatch) {
  const paths = new Set();
  const hunks = new Set();
  const text = String(stderr || "");
  for (const line of text.split(/\r?\n/)) {
    const patchFailed = /^error: patch failed: (.+?):\d+/.exec(line);
    if (patchFailed) {
      const failedPath = patchFailed[1].replace(/\\/g, "/");
      const failedLineMatch = /^error: patch failed: .+?:(\d+)/.exec(line);
      const failedLine = failedLineMatch ? Number(failedLineMatch[1]) : null;
      paths.add(failedPath);
      markFailedHunk(hunks, parsedPatch, failedPath, failedLine);
      continue;
    }
    const doesNotApply = /^error: (.+?): patch does not apply/.exec(line);
    if (doesNotApply) {
      const failedPath = doesNotApply[1].replace(/\\/g, "/");
      paths.add(failedPath);
      markFailedHunk(hunks, parsedPatch, failedPath, null);
    }
  }
  return { hunks, paths };
}

function markFailedHunk(hunks, parsedPatch, failedPath, failedLine) {
  for (const file of parsedPatch.files || []) {
    if ((file.newPath || file.oldPath) !== failedPath && file.oldPath !== failedPath && file.newPath !== failedPath) {
      continue;
    }
    if (!failedLine) {
      file.hunks.forEach((hunk) => hunks.add(hunk.id));
      return;
    }
    const match = file.hunks.find((hunk) => failedLine >= hunk.oldStart && failedLine <= hunk.oldStart + Math.max(hunk.oldCount - 1, 0));
    if (match) {
      hunks.add(match.id);
    }
  }
}

async function validateCurrentPatch() {
  if (!state.projectRoot) {
    showAlert("Select a project folder before validating a patch.", "warn");
    return null;
  }
  if (!state.patchParsed) {
    await parsePatchInput();
  }
  const patchText = await rebuildFilteredPatch();
  if (!patchText.trim()) {
    showAlert("No approved patch content remains.", "warn");
    return null;
  }
  state.validation = await api.validatePatch({ patchText, root: state.projectRoot });
  const failures = extractFailedPatchFailures(state.validation.applyCheck.stderr, state.validation.parsed);
  state.failedPaths = failures.paths;
  state.failedHunks = failures.hunks;
  renderValidation();
  renderPatchReview();
  renderMagic();
  return state.validation;
}

function renderValidation() {
  if (!state.validation) {
    setLog("");
    return;
  }
  const lines = [];
  if (state.validation.parsed.errors.length) {
    lines.push("Structure errors:");
    state.validation.parsed.errors.forEach((error) => lines.push(`- line ${error.line}: ${error.message}`));
  }
  if (state.validation.security.errors.length) {
    lines.push("Security errors:");
    state.validation.security.errors.forEach((error) => lines.push(`- ${error}`));
  }
  if (state.validation.security.warnings.length) {
    lines.push("Security warnings:");
    state.validation.security.warnings.forEach((warning) => lines.push(`- ${warning}`));
  }
  lines.push(`git apply --check: ${state.validation.applyCheck.ok ? "passed" : "failed"}`);
  if (state.validation.applyCheck.stdout) lines.push(state.validation.applyCheck.stdout.trim());
  if (state.validation.applyCheck.stderr) lines.push(state.validation.applyCheck.stderr.trim());
  setLog(lines.join("\n"));
}

async function applyApprovedPatch() {
  const validation = await validateCurrentPatch();
  if (!validation || !validation.applyCheck.ok || !validation.security.ok || !validation.parsed.isValidStructure) {
    showAlert("Patch was not applied because validation failed.", "error");
    return;
  }
  await refreshGitStatus();
  const warnings = [];
  if (state.git && state.git.repository && !state.git.clean) {
    warnings.push(`The worktree is dirty (${state.git.dirtyCount} changed paths).`);
  }
  const affected = new Set(validation.security.affectedPaths);
  const untrackedHits = state.git && state.git.untracked ? state.git.untracked.filter((path) => affected.has(path)) : [];
  if (untrackedHits.length) {
    warnings.push(`Patch touches untracked files: ${untrackedHits.join(", ")}`);
  }
  const message = `${warnings.join("\n")}${warnings.length ? "\n\n" : ""}Apply the approved patch now?`;
  if (!window.confirm(message)) {
    return;
  }
  const result = await api.applyPatch({
    createBackup: $("#backupBranch").checked && state.git && state.git.repository,
    patchText: state.filteredPatch,
    root: state.projectRoot,
  });
  const lines = [];
  if (result.backup && result.backup.ok) lines.push(`Backup branch: ${result.backup.branchName}`);
  lines.push(`Apply: ${result.apply.ok ? "success" : "failed"}`);
  if (result.apply.stdout) lines.push(result.apply.stdout.trim());
  if (result.apply.stderr) lines.push(result.apply.stderr.trim());
  setLog(lines.join("\n"));
  await refreshGitStatus();
  if (result.apply.ok) {
    state.lastAppliedPatch = state.filteredPatch;
    state.lastAppliedRoot = state.projectRoot;
    $("#revertPatch").disabled = false;
  }
  renderMagic();
  showAlert(result.apply.ok ? "Patch applied successfully." : "Patch application failed.", result.apply.ok ? "info" : "error");
}

async function revertLastPatch() {
  if (!state.lastAppliedPatch || !state.lastAppliedRoot) {
    showAlert("No patch has been applied in this session.", "warn");
    return;
  }
  if (!window.confirm("Revert the last patch applied by PatchBridge in this session?")) {
    return;
  }
  await refreshGitStatus();
  if (state.git && state.git.repository && !state.git.clean && !window.confirm(`The worktree is dirty (${state.git.dirtyCount} changed paths). Continue with reverse apply?`)) {
    return;
  }
  const result = await api.revertPatch({
    patchText: state.lastAppliedPatch,
    root: state.lastAppliedRoot,
  });
  const lines = [`Reverse apply: ${result.apply.ok ? "success" : "failed"}`];
  if (result.apply.stdout) lines.push(result.apply.stdout.trim());
  if (result.apply.stderr) lines.push(result.apply.stderr.trim());
  setLog(lines.join("\n"));
  if (result.apply.ok) {
    state.lastAppliedPatch = "";
    state.lastAppliedRoot = "";
    $("#revertPatch").disabled = true;
  }
  await refreshGitStatus();
  showAlert(result.apply.ok ? "Patch reverted." : "Patch revert failed.", result.apply.ok ? "info" : "error");
}

async function loadDiff() {
  if (!state.projectRoot) {
    showAlert("Select a project folder before loading a diff.", "warn");
    return;
  }
  const mode = $("#diffMode").value;
  const ref = $("#diffRef").value.trim();
  if (mode === "importedPatch") {
    if (!state.patchParsed) {
      showAlert("Paste or import a patch, then parse it before loading this preview.", "warn");
      return;
    }
    const result = await loadPatchPreview();
    $("#diffSummary").textContent = result
      ? `${formatNumber(result.previews.length)} imported patch files previewed against current project`
      : "Imported patch preview is unavailable.";
    renderPreviewInto($("#diffOutput"), state.patchPreviews || []);
    return;
  }
  const result = await api.loadDiff({ mode, ref, root: state.projectRoot });
  state.diffParsed = result.parsed;
  if (!result.result.ok) {
    $("#diffSummary").textContent = result.result.stderr || "Diff command failed.";
    $("#diffOutput").className = "diff-view empty-state";
    $("#diffOutput").textContent = "No diff available.";
    return;
  }
  if (!result.diff.trim()) {
    $("#diffSummary").textContent = "No changes found for this comparison.";
    $("#diffOutput").className = "diff-view empty-state";
    $("#diffOutput").textContent = "No changes found.";
    return;
  }
  $("#diffSummary").textContent = `${formatNumber(result.parsed.stats.files)} files · +${formatNumber(result.parsed.stats.additions)} -${formatNumber(result.parsed.stats.deletions)}`;
  renderReadOnlyDiff();
}

async function loadPatchPreview() {
  if (!state.projectRoot) {
    showAlert("Select a project folder before generating a before/after preview.", "warn");
    return null;
  }
  if (!state.patchParsed) {
    showAlert("Parse a patch before generating a before/after preview.", "warn");
    return null;
  }
  const patchText = await rebuildFilteredPatch();
  const result = await api.previewPatch({ patchText, root: state.projectRoot });
  state.patchPreviews = result.previews;
  if (!result.security.ok || !result.parsed.isValidStructure) {
    showAlert("Patch preview is blocked until structure and security issues are fixed.", "warn");
  }
  return result;
}

function renderPatchPreview(container) {
  if (!state.patchPreviews) {
    container.className = "diff-view empty-state";
    container.textContent = "Before/after preview is unavailable until a project is selected and the approved patch can be previewed.";
    return;
  }
  renderPreviewInto(container, state.patchPreviews);
}

function renderPreviewInto(container, previews) {
  container.className = "diff-view";
  container.innerHTML = "";
  if (!previews || !previews.length) {
    container.className = "diff-view empty-state";
    container.textContent = "No preview is available.";
    return;
  }
  for (const preview of previews) {
    const wrapper = document.createElement("div");
    wrapper.className = "file-diff";
    const header = document.createElement("div");
    header.className = "file-header";
    header.textContent = preview.path;
    wrapper.append(header);
    if (preview.errors.length) {
      const error = document.createElement("div");
      error.className = "alert error";
      error.textContent = preview.errors.join("\n");
      wrapper.append(error);
    }
    const grid = document.createElement("div");
    grid.className = "preview-grid";
    grid.append(renderPreviewPane("Before", preview.before), renderPreviewPane("After", preview.after));
    wrapper.append(grid);
    container.append(wrapper);
  }
}

function renderPreviewPane(label, content) {
  const pane = document.createElement("div");
  pane.className = "preview-pane";
  const title = document.createElement("strong");
  title.textContent = label;
  const code = document.createElement("pre");
  code.textContent = content || "";
  pane.append(title, code);
  return pane;
}

function renderReadOnlyDiff() {
  const container = $("#diffOutput");
  if (!state.diffParsed || !state.diffParsed.files.length) {
    container.className = "diff-view empty-state";
    container.textContent = "No changes found.";
    return;
  }
  container.className = "diff-view";
  container.innerHTML = "";
  for (const file of state.diffParsed.files) {
    container.append(renderFileDiff(file, { approvals: false, mode: state.worktreeView }));
  }
}

function renderMagic() {
  const stats = selectedStats();
  const patchReady = Boolean(state.patchParsed && state.patchParsed.isValidStructure);
  const validationReady = Boolean(state.validation && state.validation.applyCheck && state.validation.applyCheck.ok);
  const steps = [
    {
      action: "select",
      detail: state.projectRoot || "No folder selected",
      done: Boolean(state.projectRoot),
      icon: "folder",
      title: "Select project folder",
    },
    {
      action: "scan",
      detail: state.scan ? `${formatNumber(state.scan.summary.files)} files scanned` : "Waiting for scan",
      disabled: !state.projectRoot,
      done: Boolean(state.scan),
      icon: "scan",
      title: "Scan project",
    },
    {
      action: "scanner",
      detail: `${formatNumber(stats.files)} selected files · ${formatNumber(stats.tokens)} tokens`,
      disabled: !state.scan,
      done: stats.files > 0,
      icon: "review",
      title: "Select context",
    },
    {
      custom: `<textarea id="magicRequest" rows="5" placeholder="Describe the change.">${escapeHtml(state.request)}</textarea>`,
      done: state.request.trim().length > 0,
      icon: "prompt",
      title: "Describe change",
    },
    {
      custom: `<select id="magicTarget"><option${state.target === "ChatGPT" ? " selected" : ""}>ChatGPT</option><option${state.target === "Claude" ? " selected" : ""}>Claude</option><option${state.target === "Gemini" ? " selected" : ""}>Gemini</option><option${state.target === "Generic LLM" ? " selected" : ""}>Generic LLM</option></select>`,
      done: true,
      icon: "spark",
      title: "Select AI target",
    },
    {
      action: "generatePrompt",
      detail: state.promptResult ? `${formatNumber(state.promptResult.tokenEstimate)} estimated tokens` : "Prompt not generated",
      disabled: !state.scan || !state.request.trim(),
      done: Boolean(state.promptResult),
      icon: "spark",
      title: "Generate prompt",
    },
    {
      action: "copyPrompt",
      detail: state.promptResult ? "Ready to paste into a trusted AI tool" : "Generate first",
      disabled: !state.promptResult,
      done: Boolean(state.promptResult),
      icon: "copy",
      title: "Copy or refine",
    },
    {
      action: "patch",
      detail: patchReady ? `${state.patchParsed.stats.files} affected files` : "Paste or import AI patch",
      done: patchReady,
      icon: "import",
      title: "Import patch",
    },
    {
      action: "validate",
      detail: validationReady ? "Dry check passed" : "Awaiting validation",
      disabled: !patchReady || !state.projectRoot,
      done: validationReady,
      icon: "shield",
      title: "Validate patch",
    },
    {
      action: "patch",
      detail: "Preview unified or side-by-side diff",
      disabled: !patchReady,
      done: patchReady,
      icon: "preview",
      title: "Preview diff",
    },
    {
      action: "patch",
      detail: "Approve files, hunks, and eligible lines",
      disabled: !patchReady,
      done: patchReady,
      icon: "check",
      title: "Approve changes",
    },
    {
      action: "apply",
      detail: validationReady ? "Ready to apply approved patch" : "Validate before applying",
      disabled: !validationReady,
      done: false,
      icon: "check",
      title: "Apply patch",
    },
    {
      action: "diff",
      detail: "Review working tree and commit when satisfied",
      disabled: !state.projectRoot,
      done: false,
      icon: "diff",
      title: "Next actions",
    },
  ];
  const currentIndex = steps.findIndex((step) => !step.done && !step.disabled);

  $("#magicSteps").innerHTML = steps
    .map((step, index) => {
      const status = step.done ? "Done" : index === currentIndex ? "Next" : "Waiting";
      const stateClass = step.done ? "done" : index === currentIndex ? "current" : "";
      const button = step.action
        ? `<button class="${step.disabled ? "secondary" : "primary"}" data-magic-action="${step.action}"${step.disabled ? " disabled" : ""}>${buttonContent(magicActionLabel(step.action), magicActionIcon(step.action))}</button>`
        : "";
      return `
        <article class="magic-card ${stateClass}">
          <div class="magic-card-top">
            <span class="magic-step-marker">
              <span class="magic-number">${index + 1}</span>
              <span class="magic-step-icon">${icon(step.icon || magicActionIcon(step.action) || "workflow")}</span>
            </span>
            <span class="step-state">${status}</span>
          </div>
          <strong>${escapeHtml(step.title)}</strong>
          ${step.custom || `<span class="step-detail">${escapeHtml(step.detail || "")}</span>`}
          ${button}
        </article>
      `;
    })
    .join("");

  const magicRequest = $("#magicRequest");
  if (magicRequest) {
    magicRequest.addEventListener("input", () => {
      state.request = magicRequest.value;
      $("#requestInput").value = state.request;
      invalidatePrompt({ rerenderMagic: false });
    });
  }
  const magicTarget = $("#magicTarget");
  if (magicTarget) {
    magicTarget.addEventListener("change", () => {
      state.target = magicTarget.value;
      $("#targetSelect").value = state.target;
      invalidatePrompt({ rerenderMagic: false });
    });
  }
  $$("[data-magic-action]").forEach((button) => {
    button.addEventListener("click", () => runMagicAction(button.dataset.magicAction));
  });
}

function magicActionLabel(action) {
  return {
    apply: "Apply",
    copyPrompt: "Copy",
    diff: "Open",
    generatePrompt: "Generate",
    patch: "Open",
    scan: "Scan",
    scanner: "Open",
    select: "Open",
    validate: "Validate",
  }[action];
}

function magicActionIcon(action) {
  return {
    apply: "check",
    copyPrompt: "copy",
    diff: "diff",
    generatePrompt: "spark",
    patch: "review",
    scan: "scan",
    scanner: "scan",
    select: "folder",
    validate: "shield",
  }[action];
}

async function runMagicAction(action) {
  if (action === "select") return selectProject();
  if (action === "scan") return scanCurrentProject();
  if (action === "scanner") return setView("scanner");
  if (action === "generatePrompt") return generatePromptFromSelection();
  if (action === "copyPrompt") return copyText($("#promptOutput").value, "Prompt");
  if (action === "patch") return setView("patch");
  if (action === "validate") return validateCurrentPatch();
  if (action === "apply") return applyApprovedPatch();
  if (action === "diff") return setView("diff");
}

async function renderSetupWizard() {
  const wizard = $("#setupWizard");
  const result = await api.checkRequirements();
  const blockers = result.requirements.filter((requirement) => requirement.critical && (!requirement.installed || !requirement.supported));
  if (!blockers.length) {
    wizard.classList.add("hidden");
    return;
  }

  wizard.classList.remove("hidden");
  wizard.innerHTML = `
    <div class="setup-card">
      <div class="setup-header">
        <img src="../../logos/logo.svg" alt="PatchBridge" />
        <div>
          <h1>PatchBridge setup</h1>
          <p>Critical requirements must be available before patches can be validated or applied.</p>
        </div>
      </div>
      ${result.requirements.map(renderRequirement).join("")}
      <div class="button-row">
        <button class="primary" id="recheckSetup" data-icon="scan">Re-check</button>
      </div>
    </div>
  `;
  decorateIconButtons(wizard);
  $("#recheckSetup").addEventListener("click", renderSetupWizard);
  $$("[data-link]").forEach((button) => {
    button.addEventListener("click", () => api.openExternal({ url: button.dataset.link }));
  });
  $$("[data-command]").forEach((button) => {
    button.addEventListener("click", () => copyText(button.dataset.command, "Command"));
  });
}

function renderRequirement(requirement) {
  const ok = requirement.installed && requirement.supported;
  const commands = requirement.help.commands
    .map((command) => `<div class="command"><span>${escapeHtml(command)}</span><button class="secondary" data-icon="copy" data-command="${escapeHtml(command)}">${buttonContent("Copy", "copy")}</button></div>`)
    .join("");
  const links = requirement.help.links
    .map((link) => `<button class="secondary" data-icon="diff" data-link="${escapeHtml(link.url)}">${buttonContent(link.label, "diff")}</button>`)
    .join("");
  return `
    <section class="requirement ${ok ? "ok" : ""}">
      <strong>${escapeHtml(requirement.name)}</strong>
      <span>${escapeHtml(requirement.message)}</span>
      ${ok ? "" : `<div class="command-list">${commands}</div><div class="button-row">${links}</div>`}
    </section>
  `;
}

function bindControls() {
  decorateIconButtons();
  $$(".nav-item").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  $("#magicTop").addEventListener("click", () => setView("magic"));
  $$("[data-external-url]").forEach((button) => {
    button.addEventListener("click", () => api.openExternal({ url: button.dataset.externalUrl }));
  });
  $("#magicPrimary").addEventListener("click", () => runMagicAction(state.projectRoot ? "scan" : "select"));
  $("#selectProjectTop").addEventListener("click", selectProject);
  $("#selectProjectScanner").addEventListener("click", selectProject);
  $("#scanProject").addEventListener("click", scanCurrentProject);
  $("#generatePrompt").addEventListener("click", generatePromptFromSelection);
  $("#copyPrompt").addEventListener("click", () => copyText($("#promptOutput").value, "Prompt"));
  $("#requestInput").addEventListener("input", (event) => {
    state.request = event.target.value;
    invalidatePrompt();
  });
  $("#targetSelect").addEventListener("change", (event) => {
    state.target = event.target.value;
    invalidatePrompt();
  });
  $("#promptOutput").addEventListener("input", (event) => {
    if (state.promptResult) state.promptResult.prompt = event.target.value;
  });
  $("#importPatch").addEventListener("click", importPatchFile);
  $("#parsePatch").addEventListener("click", parsePatchInput);
  $("#patchInput").addEventListener("input", () => {
    invalidatePatchDerivedState();
    renderPatchReview();
    renderMagic();
  });
  $("#validatePatch").addEventListener("click", validateCurrentPatch);
  $("#applyPatch").addEventListener("click", applyApprovedPatch);
  $("#revertPatch").addEventListener("click", revertLastPatch);
  $("#approveAll").addEventListener("click", () => approveAllChanges(true));
  $("#rejectAll").addEventListener("click", () => approveAllChanges(false));
  $("#loadDiff").addEventListener("click", loadDiff);
  $$("[data-diff-view]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.diffView = button.dataset.diffView;
      $$("[data-diff-view]").forEach((item) => item.classList.toggle("active", item === button));
      if (state.diffView === "preview") {
        await loadPatchPreview();
      }
      renderPatchReview();
    });
  });
  $$("[data-worktree-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.worktreeView = button.dataset.worktreeView;
      $$("[data-worktree-view]").forEach((item) => item.classList.toggle("active", item === button));
      renderReadOnlyDiff();
    });
  });
}

async function init() {
  if (!api) {
    document.body.textContent = "PatchBridge must be run inside the desktop app.";
    return;
  }
  bindControls();
  syncPromptControls();
  renderScanner();
  renderPatchReview();
  renderMagic();
  await renderSetupWizard();
}

window.addEventListener("DOMContentLoaded", () => {
  init().catch((error) => {
    showAlert(error.message || String(error), "error");
  });
});

window.addEventListener("unhandledrejection", (event) => {
  reportError(event.reason, "Action failed.");
});

window.addEventListener("error", (event) => {
  reportError(event.error || event.message, "Renderer error.");
});
