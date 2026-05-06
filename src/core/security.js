"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { normalizeRoot, resolveInside, sanitizeRelativePath, toPosixPath } = require("./paths");

function validateParsedPatch(rootPath, parsedPatch) {
  const errors = [];
  const warnings = [];
  const affectedPaths = [];

  for (const file of parsedPatch.files || []) {
    const displayPath = file.newPath || file.oldPath;
    if (file.binary) {
      errors.push(`Binary patches are blocked: ${displayPath}`);
    }

    if (file.isSymlink || file.oldMode === "120000" || file.newMode === "120000" || file.indexMode === "120000") {
      errors.push(`Symlink patches are blocked: ${displayPath}`);
    }

    const paths = [file.oldPath, file.newPath].filter(Boolean);
    for (const candidate of paths) {
      if (candidate === "/dev/null") {
        continue;
      }
      const safe = sanitizeRelativePath(candidate);
      if (!safe.ok) {
        errors.push(safe.error);
        continue;
      }
      try {
        resolveInside(rootPath, safe.path);
        affectedPaths.push(safe.path);
      } catch (error) {
        errors.push(error.message);
      }
    }

    if (file.isNew) {
      warnings.push(`Patch creates ${file.newPath}. Review before applying.`);
    }
    if (file.isDeleted) {
      warnings.push(`Patch deletes ${file.oldPath}. Confirm this is intended.`);
    }
  }

  return {
    affectedPaths: Array.from(new Set(affectedPaths)).sort(),
    errors,
    ok: errors.length === 0,
    warnings,
  };
}

async function pathHasSymlink(rootPath, relativePath) {
  const parts = toPosixPath(relativePath).split("/").filter(Boolean);
  let current = rootPath;

  for (const part of parts) {
    current = path.join(current, part);
    try {
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink()) {
        return true;
      }
    } catch (error) {
      if (error && error.code === "ENOENT") {
        return false;
      }
      throw error;
    }
  }

  return false;
}

async function validateParsedPatchFilesystem(rootPath, parsedPatch) {
  const root = normalizeRoot(rootPath);
  const result = validateParsedPatch(rootPath, parsedPatch);
  if (!result.ok) {
    return result;
  }

  for (const affectedPath of result.affectedPaths) {
    if (await pathHasSymlink(root, affectedPath)) {
      result.errors.push(`Symlink paths are blocked to prevent writes outside the project folder: ${affectedPath}`);
    }
  }

  result.ok = result.errors.length === 0;
  return result;
}

module.exports = {
  pathHasSymlink,
  validateParsedPatch,
  validateParsedPatchFilesystem,
};
