// SPDX-License-Identifier: GPL-3.0-or-later

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const packagePath = join(projectRoot, "package.json");
const manifestPath = join(projectRoot, "public", "manifest.json");

const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
const version = packageJson.version;
const versionParts = typeof version === "string" ? version.split(".") : [];
const isValidVersion =
  versionParts.length === 3 &&
  versionParts.every(
    (part) => /^(0|[1-9][0-9]*)$/.test(part) && Number(part) <= 65535,
  );

if (!isValidVersion) {
  throw new Error(
    `package.json version must match MAJOR.MINOR.PATCH with each part no greater than 65535; received "${version}".`,
  );
}

const manifestSource = readFileSync(manifestPath, "utf8");
const manifest = JSON.parse(manifestSource);

if (manifest.version === version) {
  console.log(`public/manifest.json is already at version ${version}.`);
  process.exit(0);
}

const versionFieldPattern =
  /^([ \t]*"version"[ \t]*:[ \t]*)"[^"\r\n]*"([ \t]*,[ \t]*)$/m;

if (!versionFieldPattern.test(manifestSource)) {
  throw new Error("Could not locate the top-level version field in public/manifest.json.");
}

const updatedManifest = manifestSource.replace(
  versionFieldPattern,
  `$1"${version}"$2`,
);

writeFileSync(manifestPath, updatedManifest, "utf8");
console.log(`Updated public/manifest.json to version ${version}.`);
