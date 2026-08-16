// SPDX-License-Identifier: GPL-3.0-or-later

import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = dirname(currentDir);
const repoRoot = dirname(packageRoot);
const sourceLicense = join(repoRoot, "LICENSE");
const targetLicense = join(packageRoot, "public", "LICENSE");

if (existsSync(sourceLicense)) {
  copyFileSync(sourceLicense, targetLicense);
  console.log("Synchronized root LICENSE to public/LICENSE.");
} else {
  console.warn("Root LICENSE file not found at", sourceLicense);
}
