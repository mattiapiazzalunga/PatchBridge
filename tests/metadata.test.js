"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("./harness.cjs");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("release metadata consistently declares the public-domain license", () => {
  const packageJson = JSON.parse(read("package.json"));
  const packageLock = JSON.parse(read("package-lock.json"));
  assert.equal(packageJson.license, "Unlicense");
  assert.equal(packageLock.packages[""].license, "Unlicense");
  assert.match(read("LICENSE"), /released into the public domain/i);
  assert.match(read("README.md"), /public domain/i);
  assert.match(read("site/index.html"), /Public domain via the Unlicense/);
});

test("site includes discoverability metadata for GitHub Pages", () => {
  const site = read("site/index.html");
  assert.match(site, /<link rel="canonical" href="https:\/\/mattiapiazzalunga\.github\.io\/PatchBridge\/"/);
  assert.match(site, /property="og:title"/);
  assert.match(site, /application\/ld\+json/);
  assert.match(read("site/robots.txt"), /Sitemap: https:\/\/mattiapiazzalunga\.github\.io\/PatchBridge\/sitemap\.xml/);
  assert.match(read("site/sitemap.xml"), /<loc>https:\/\/mattiapiazzalunga\.github\.io\/PatchBridge\/<\/loc>/);
});

test("local documentation links resolve", () => {
  const markdownFiles = [
    "README.md",
    "CHANGELOG.md",
    "CODE_OF_CONDUCT.md",
    "CONTRIBUTING.md",
    "ROADMAP.md",
    "SECURITY.md",
    ...fs.readdirSync(path.join(root, "docs")).filter((file) => file.endsWith(".md")).map((file) => path.join("docs", file)),
  ];

  for (const relativeFile of markdownFiles) {
    const text = read(relativeFile);
    const directory = path.dirname(path.join(root, relativeFile));
    for (const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const target = match[1].split("#")[0];
      if (!target || /^(?:https?:|mailto:|#)/.test(target)) {
        continue;
      }
      assert.equal(fs.existsSync(path.resolve(directory, target)), true, `${relativeFile} links to missing file ${match[1]}`);
    }
  }
});

test("site local asset references resolve", () => {
  const site = read("site/index.html");
  const siteRoot = path.join(root, "site");
  for (const match of site.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
    const target = match[1].split("#")[0];
    if (!target || /^(?:https?:|#)/.test(target)) {
      continue;
    }
    assert.equal(fs.existsSync(path.resolve(siteRoot, target)), true, `site/index.html references missing asset ${match[1]}`);
  }
});
