// SPDX-License-Identifier: GPL-3.0-or-later

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = dirname(__dirname);
const manifestPath = join(packageRoot, "public", "manifest.json");

test("manifest.json has no cloud host permissions or content scripts in local branch", () => {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  
  assert.equal(manifest.content_scripts, undefined, "content_scripts must not be present");
  
  const hostPermissions = manifest.host_permissions || [];
  assert.equal(
    hostPermissions.some((h) => h.includes("exia.nikke.cc")),
    false,
    "exia.nikke.cc must not be in host_permissions",
  );
});

test("cloud specific files do not exist in main branch", () => {
  const cloudFiles = [
    "public/content-auth.js",
    "src/components/app/AuthDialog.jsx",
    "src/components/app/hooks/useAuth.js",
    "src/components/app/hooks/useCloudCheck.js",
    "src/components/management/SyncConflictDialog.jsx",
    "src/components/management/hooks/useCloudSync.js",
    "src/utils/cloudCompare.js",
    "src/utils/cloudSyncUi.js",
    "src/utils/manualCloudSync.js",
  ];

  for (const relPath of cloudFiles) {
    const fullPath = join(packageRoot, relPath);
    assert.equal(existsSync(fullPath), false, `${relPath} should not exist in main branch`);
  }
});
