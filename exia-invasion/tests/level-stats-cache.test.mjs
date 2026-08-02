// SPDX-License-Identifier: GPL-3.0-or-later

import test from "node:test";
import assert from "node:assert/strict";
import {
  LEVEL_STATS_REPRESENTATIVES,
  buildLevelStatsSnapshot,
  createLevelStatsManager,
} from "../src/services/levelStats.js";

const createPayloads = () => {
  const payloads = new Map();
  for (const representative of LEVEL_STATS_REPRESENTATIVES) {
    const isDefender = representative.className === "Defender";
    payloads.set(representative.resourceId, {
      resource_id: representative.resourceId,
      class: representative.className,
      original_rare: "SSR",
      shot_detail: { weapon_type: representative.weaponType },
      stat_enhance_detail: {
        grade_ratio: 200,
        grade_hp: 3000,
        grade_attack: 20,
        grade_defence: 100,
        core_hp: 200,
        core_attack: 200,
        core_defence: 200,
      },
      character_level_hp_list: isDefender ? [3, 4] : [1, 2],
      character_level_attack_list: isDefender ? [5, 6] : [2, 3],
      character_level_defence_list: [
        7 + LEVEL_STATS_REPRESENTATIVES.indexOf(representative),
        8 + LEVEL_STATS_REPRESENTATIVES.indexOf(representative),
      ],
    });
  }
  return payloads;
};

const snapshotAt = (timestamp) =>
  buildLevelStatsSnapshot(createPayloads(), timestamp);

test("startup refresh is deduplicated and writes one atomic cache value", async () => {
  let requestCount = 0;
  const writes = [];
  const manager = createLevelStatsManager({
    loadBundledSnapshot: async () => snapshotAt("2026-01-01T00:00:00.000Z"),
    loadCachedSnapshot: async () => null,
    loadRoleData: async ({ resourceId }) => {
      requestCount += 1;
      return createPayloads().get(resourceId);
    },
    saveCachedSnapshot: async (snapshot) => writes.push(snapshot),
    now: () => "2026-07-29T00:00:00.000Z",
  });

  const [first, second] = await Promise.all([
    manager.initialize(),
    manager.initialize(),
  ]);
  assert.equal(first, second);
  assert.equal(requestCount, 18);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].updatedAt, "2026-07-29T00:00:00.000Z");
});

test("one failed representative keeps the previous valid snapshot and never writes", async () => {
  const fallback = snapshotAt("2026-01-01T00:00:00.000Z");
  let writes = 0;
  const manager = createLevelStatsManager({
    loadBundledSnapshot: async () => fallback,
    loadCachedSnapshot: async () => null,
    loadRoleData: async ({ resourceId }) => {
      if (resourceId === 281) throw new Error("network failed");
      return createPayloads().get(resourceId);
    },
    saveCachedSnapshot: async () => { writes += 1; },
  });

  assert.equal(await manager.getForCalculation(100), fallback);
  assert.equal(writes, 0);
  assert.equal(manager.getActiveSnapshot(), fallback);
});

test("corrupt cache falls back to the bundled snapshot", async () => {
  const bundled = snapshotAt("2026-01-01T00:00:00.000Z");
  const manager = createLevelStatsManager({
    loadBundledSnapshot: async () => bundled,
    loadCachedSnapshot: async () => ({ schemaVersion: -1 }),
    loadRoleData: async () => {
      throw new Error("offline");
    },
  });
  assert.equal(await manager.load(), bundled);
});

test("newest valid Chrome cache wins before the CDN refresh completes", async () => {
  const bundled = snapshotAt("2026-01-01T00:00:00.000Z");
  const cached = snapshotAt("2026-07-01T00:00:00.000Z");
  const manager = createLevelStatsManager({
    loadBundledSnapshot: async () => bundled,
    loadCachedSnapshot: async () => cached,
    loadRoleData: async () => new Promise(() => {}),
  });
  assert.equal(await manager.load(), cached);
  assert.equal(await manager.getForCalculation(1), cached);
});

