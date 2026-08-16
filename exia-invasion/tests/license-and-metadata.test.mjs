// SPDX-License-Identifier: GPL-3.0-or-later

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import TRANSLATIONS from "../src/i18n/translations.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = dirname(__dirname);
const repoRoot = dirname(packageRoot);
const rootLicensePath = join(repoRoot, "LICENSE");
const publicLicensePath = join(packageRoot, "public", "LICENSE");
const manifestPath = join(packageRoot, "public", "manifest.json");
const packagePath = join(packageRoot, "package.json");

test("public/LICENSE exists and matches root GPL-3.0 LICENSE", () => {
  assert.equal(existsSync(publicLicensePath), true, "public/LICENSE must exist");
  assert.equal(existsSync(rootLicensePath), true, "root LICENSE must exist");

  const rootLicense = readFileSync(rootLicensePath, "utf8").replace(/\r\n/g, "\n").trim();
  const publicLicense = readFileSync(publicLicensePath, "utf8").replace(/\r\n/g, "\n").trim();

  assert.equal(publicLicense, rootLicense);
  assert.match(publicLicense, /GNU GENERAL PUBLIC LICENSE/);
  assert.match(publicLicense, /Version 3, 29 June 2007/);
});

test("package.json and manifest.json contain GPL license and repository homepage", () => {
  const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

  assert.equal(packageJson.license, "GPL-3.0-or-later");
  assert.equal(packageJson.homepage, "https://github.com/IsolateOB/ExiaInvasion");
  assert.equal(packageJson.repository?.url, "https://github.com/IsolateOB/ExiaInvasion.git");

  assert.equal(manifest.homepage_url, "https://github.com/IsolateOB/ExiaInvasion");
});

test("translations include source code and license keys in zh and en", () => {
  for (const lang of ["zh", "en"]) {
    assert.ok(TRANSLATIONS[lang].sourceCode, `sourceCode key missing in ${lang}`);
    assert.ok(TRANSLATIONS[lang].openSourceLicense, `openSourceLicense key missing in ${lang}`);
    assert.ok(TRANSLATIONS[lang].licenseGpl, `licenseGpl key missing in ${lang}`);
    assert.ok(TRANSLATIONS[lang].viewLicense, `viewLicense key missing in ${lang}`);
    assert.ok(TRANSLATIONS[lang].aboutTitle, `aboutTitle key missing in ${lang}`);
    assert.ok(TRANSLATIONS[lang].aboutDesc, `aboutDesc key missing in ${lang}`);
  }
});
