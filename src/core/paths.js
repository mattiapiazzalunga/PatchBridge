"use strict";

const path = require("node:path");

const BLOCKED_PATH_SEGMENTS = new Set([".git", ".hg", ".svn"]);

function normalizeRoot(rootPath) {
  if (!rootPath || typeof rootPath !== "string") {
    throw new Error("A project folder is required.");
  }
  return path.resolve(rootPath);
}

function toPosixPath(inputPath) {
  return String(inputPath || "").replace(/\\/g, "/");
}

function stripGitPrefix(inputPath) {
  let value = String(inputPath || "").trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  value = toPosixPath(value);
  if (value.startsWith("a/") || value.startsWith("b/")) {
    value = value.slice(2);
  }
  return value;
}

function sanitizeRelativePath(inputPath) {
  if (inputPath === "/dev/null") {
    return { ok: true, path: null };
  }

  const cleaned = stripGitPrefix(inputPath);
  if (!cleaned) {
    return { ok: false, error: "Empty paths are not allowed." };
  }
  if (cleaned.includes("\0")) {
    return { ok: false, error: `Path contains a null byte: ${cleaned}` };
  }
  if (path.posix.isAbsolute(cleaned) || /^[a-zA-Z]:/.test(cleaned) || cleaned.startsWith("~")) {
    return { ok: false, error: `Absolute paths are blocked: ${cleaned}` };
  }

  const parts = cleaned.split("/").filter(Boolean);
  if (parts.includes("..")) {
    return { ok: false, error: `Path traversal is blocked: ${cleaned}` };
  }
  const blockedSegment = parts.find((part) => BLOCKED_PATH_SEGMENTS.has(part.toLowerCase()));
  if (blockedSegment) {
    return { ok: false, error: `Version-control metadata paths are blocked: ${cleaned}` };
  }

  const normalized = path.posix.normalize(cleaned);
  if (normalized === "." || normalized.startsWith("../") || normalized === "..") {
    return { ok: false, error: `Unsafe normalized path: ${cleaned}` };
  }

  return { ok: true, path: normalized };
}

function isInside(rootPath, targetPath) {
  const root = normalizeRoot(rootPath);
  const target = path.resolve(targetPath);
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function resolveInside(rootPath, relativePath) {
  const root = normalizeRoot(rootPath);
  const safe = sanitizeRelativePath(relativePath);
  if (!safe.ok) {
    throw new Error(safe.error);
  }
  if (safe.path === null) {
    throw new Error("/dev/null is not a filesystem path.");
  }
  const absolutePath = path.resolve(root, safe.path.split("/").join(path.sep));
  if (!isInside(root, absolutePath)) {
    throw new Error(`Resolved path escapes project folder: ${relativePath}`);
  }
  return absolutePath;
}

module.exports = {
  BLOCKED_PATH_SEGMENTS,
  isInside,
  normalizeRoot,
  resolveInside,
  sanitizeRelativePath,
  stripGitPrefix,
  toPosixPath,
};
