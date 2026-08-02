// SPDX-License-Identifier: GPL-3.0-or-later

import { writeFile, rename, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LEVEL_STATS_REPRESENTATIVES,
  buildLevelStatsSnapshot,
} from "../src/services/levelStats.js";
import {
  getGameResourceUrl,
  getRoleDataLogicalPath,
} from "../src/utils/gameResourcePath.js";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const targetPath = join(scriptDirectory, "..", "public", "level-stats.json");
const temporaryPath = `${targetPath}.tmp-${process.pid}`;

const fetchRepresentative = async (representative) => {
  const logicalPath = getRoleDataLogicalPath(representative.resourceId);
  const url = getGameResourceUrl(logicalPath);
  console.log(
    `同步 ${representative.name} (${representative.resourceId}, ${representative.className}/${representative.weaponType})`,
  );
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    throw new Error(
      `${representative.name} 下载失败: HTTP ${response.status}`,
    );
  }
  return [representative.resourceId, await response.json()];
};

try {
  console.log(
    `开始并发更新 ${LEVEL_STATS_REPRESENTATIVES.length} 个 SSR 代表角色等级曲线…`,
  );
  const payloads = await Promise.all(
    LEVEL_STATS_REPRESENTATIVES.map(fetchRepresentative),
  );
  const snapshot = buildLevelStatsSnapshot(new Map(payloads));
  const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;

  await writeFile(temporaryPath, serialized, "utf8");
  JSON.parse(serialized);
  await rename(temporaryPath, targetPath);

  console.log(
    `等级曲线同步完成：${targetPath}（${snapshot.curves.attacker.hp.length} 级）`,
  );
} catch (error) {
  await unlink(temporaryPath).catch(() => {});
  console.error(`等级曲线同步失败，原文件未覆盖：${error.message}`);
  process.exitCode = 1;
}

