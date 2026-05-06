"use strict";

const fs = require("node:fs/promises");
const { resolveInside } = require("./paths");

function normalizeText(text) {
  return String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function splitContentLines(text) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return { hadTrailingNewline: false, lines: [] };
  }
  const hadTrailingNewline = normalized.endsWith("\n");
  const body = hadTrailingNewline ? normalized.slice(0, -1) : normalized;
  return {
    hadTrailingNewline,
    lines: body ? body.split("\n") : [],
  };
}

function joinContentLines(lines, trailingNewline = true) {
  if (!lines.length) {
    return trailingNewline ? "\n" : "";
  }
  return `${lines.join("\n")}${trailingNewline ? "\n" : ""}`;
}

function applyFilePatch(beforeContent, file) {
  const before = splitContentLines(beforeContent);
  const source = before.lines;
  const output = [];
  const errors = [];
  let sourceIndex = 0;

  for (const hunk of file.hunks) {
    const targetIndex = Math.max(0, hunk.oldStart - 1);
    if (targetIndex < sourceIndex) {
      errors.push(`Hunk ${hunk.header} overlaps a previous hunk.`);
      continue;
    }

    while (sourceIndex < targetIndex && sourceIndex < source.length) {
      output.push(source[sourceIndex]);
      sourceIndex += 1;
    }

    for (const line of hunk.lines) {
      if (line.type === "meta") {
        continue;
      }
      if (line.type === "addition") {
        output.push(line.content);
        continue;
      }

      const current = source[sourceIndex];
      if (current !== line.content) {
        errors.push(`Hunk ${hunk.header} expected "${line.content}" but found "${current || ""}".`);
        break;
      }

      if (line.type === "context") {
        output.push(current);
      }
      sourceIndex += 1;
    }
  }

  while (sourceIndex < source.length) {
    output.push(source[sourceIndex]);
    sourceIndex += 1;
  }

  return {
    after: joinContentLines(output, before.hadTrailingNewline || file.isNew),
    errors,
  };
}

async function buildPatchPreviews(rootPath, parsedPatch) {
  const previews = [];

  for (const file of parsedPatch.files || []) {
    const displayPath = file.newPath || file.oldPath;
    const preview = {
      after: "",
      before: "",
      errors: [],
      isDeleted: file.isDeleted,
      isNew: file.isNew,
      newPath: file.newPath,
      oldPath: file.oldPath,
      path: displayPath,
    };

    if (file.binary) {
      preview.errors.push("Binary files cannot be previewed.");
      previews.push(preview);
      continue;
    }

    if (!file.isNew) {
      try {
        preview.before = await fs.readFile(resolveInside(rootPath, file.oldPath), "utf8");
      } catch (error) {
        preview.errors.push(`Could not read ${file.oldPath}: ${error.message}`);
      }
    }

    if (!preview.errors.length) {
      const applied = applyFilePatch(preview.before, file);
      preview.after = file.isDeleted ? "" : applied.after;
      preview.errors.push(...applied.errors);
    }

    previews.push(preview);
  }

  return previews;
}

module.exports = {
  applyFilePatch,
  buildPatchPreviews,
  splitContentLines,
};
