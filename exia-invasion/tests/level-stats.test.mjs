// SPDX-License-Identifier: GPL-3.0-or-later

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  LEVEL_STATS_REPRESENTATIVES,
  buildLevelStatsSnapshot,
  selectSharedLevelCurve,
  validateLevelStatsSnapshot,
} from "../src/services/levelStats.js";

const enhance = {
  grade_ratio: 200,
  grade_hp: 3000,
  grade_attack: 20,
  grade_defence: 100,
  core_hp: 200,
  core_attack: 200,
  core_defence: 200,
};

export const makeRolePayloads = () => {
  const payloads = new Map();
  for (const representative of LEVEL_STATS_REPRESENTATIVES) {
    const isDefender = representative.className === "Defender";
    payloads.set(representative.resourceId, {
      resource_id: representative.resourceId,
      class: representative.className,
      original_rare: "SSR",
      shot_detail: { weapon_type: representative.weaponType },
      stat_enhance_detail: { ...enhance },
      character_level_hp_list: isDefender ? [30, 31, 32] : [10, 11, 12],
      character_level_attack_list: isDefender ? [40, 41, 42] : [20, 21, 22],
      character_level_defence_list: [
        50 + LEVEL_STATS_REPRESENTATIVES.indexOf(representative),
        60 + LEVEL_STATS_REPRESENTATIVES.indexOf(representative),
        70 + LEVEL_STATS_REPRESENTATIVES.indexOf(representative),
      ],
    });
  }
  return payloads;
};

test("the eighteen configured representatives match the approved SSR matrix", () => {
  assert.deepEqual(
    LEVEL_STATS_REPRESENTATIVES.map(
      ({ key, resourceId, className, weaponType }) => [
        key,
        resourceId,
        className,
        weaponType,
      ],
    ),
    [
      ["attackerAR", 580, "Attacker", "AR"],
      ["attackerMG", 180, "Attacker", "MG"],
      ["attackerRL", 91, "Attacker", "RL"],
      ["attackerSG", 101, "Attacker", "SG"],
      ["attackerSMG", 40, "Attacker", "SMG"],
      ["attackerSR", 102, "Attacker", "SR"],
      ["supporterSMG", 32, "Supporter", "SMG"],
      ["supporterAR", 192, "Supporter", "AR"],
      ["supporterMG", 90, "Supporter", "MG"],
      ["supporterRL", 33, "Supporter", "RL"],
      ["supporterSG", 130, "Supporter", "SG"],
      ["supporterSR", 172, "Supporter", "SR"],
      ["defenderRL", 80, "Defender", "RL"],
      ["defenderAR", 281, "Defender", "AR"],
      ["defenderSMG", 380, "Defender", "SMG"],
      ["defenderSG", 30, "Defender", "SG"],
      ["defenderSR", 620, "Defender", "SR"],
      ["defenderMG", 330, "Defender", "MG"],
    ],
  );
});

test("snapshot extraction shares class HP/ATK and keeps six DEF curves per class", () => {
  const snapshot = buildLevelStatsSnapshot(
    makeRolePayloads(),
    "2026-07-29T00:00:00.000Z",
  );
  assert.deepEqual(snapshot.curves.defender.hp, [30, 31, 32]);
  assert.deepEqual(snapshot.curves.defender.atk, [40, 41, 42]);
  assert.deepEqual(snapshot.curves.attacker.hp, [10, 11, 12]);
  assert.deepEqual(snapshot.curves.attacker.atk, [20, 21, 22]);
  assert.deepEqual(snapshot.curves.supporter.hp, [10, 11, 12]);
  assert.deepEqual(snapshot.curves.supporter.atk, [20, 21, 22]);
  assert.deepEqual(
    Object.keys(snapshot.curves.attacker.defByWeapon),
    ["RL", "AR", "SMG", "SG", "SR", "MG"],
  );
  assert.deepEqual(
    Object.keys(snapshot.curves.supporter.defByWeapon),
    ["RL", "AR", "SMG", "SG", "SR", "MG"],
  );
  assert.deepEqual(
    Object.keys(snapshot.curves.defender.defByWeapon),
    ["RL", "AR", "SMG", "SG", "SR", "MG"],
  );
  assert.notDeepEqual(
    snapshot.curves.attacker.defByWeapon.RL,
    snapshot.curves.attacker.defByWeapon.AR,
  );
  assert.notDeepEqual(
    snapshot.curves.supporter.defByWeapon.RL,
    snapshot.curves.supporter.defByWeapon.AR,
  );
  assert.notDeepEqual(
    snapshot.curves.defender.defByWeapon.RL,
    snapshot.curves.defender.defByWeapon.AR,
  );
});

test("curve selection applies weapon-specific DEF for every class", () => {
  const snapshot = buildLevelStatsSnapshot(makeRolePayloads());
  assert.equal(
    selectSharedLevelCurve(snapshot, "Attacker", "MG", "def"),
    snapshot.curves.attacker.defByWeapon.MG,
  );
  assert.equal(
    selectSharedLevelCurve(snapshot, "Supporter", "AR", "def"),
    snapshot.curves.supporter.defByWeapon.AR,
  );
  assert.equal(
    selectSharedLevelCurve(snapshot, "Defender", "SR", "def"),
    snapshot.curves.defender.defByWeapon.SR,
  );
  assert.equal(
    selectSharedLevelCurve(snapshot, "Attacker", "RL", "atk"),
    snapshot.curves.attacker.atk,
  );
});

test("representative validation rejects mismatches before replacing a cache", () => {
  const badWeapon = makeRolePayloads();
  badWeapon.get(80).shot_detail.weapon_type = "AR";
  assert.throws(
    () => buildLevelStatsSnapshot(badWeapon),
    /武器类型不匹配/,
  );

  const badDefenderSharedCurve = makeRolePayloads();
  badDefenderSharedCurve.get(281).character_level_hp_list = [1, 2, 3];
  assert.throws(
    () => buildLevelStatsSnapshot(badDefenderSharedCurve),
    /HP\/ATK 曲线不一致/,
  );

  const badConstants = makeRolePayloads();
  badConstants.get(32).stat_enhance_detail.core_attack = 201;
  assert.throws(
    () => buildLevelStatsSnapshot(badConstants),
    /突破\/核心常量不一致/,
  );
});

test("bundled level-stats snapshot is valid and contains 1400 levels", async () => {
  const raw = await readFile(
    new URL("../public/level-stats.json", import.meta.url),
    "utf8",
  );
  const snapshot = validateLevelStatsSnapshot(JSON.parse(raw));
  assert.equal(snapshot.curves.attacker.hp.length, 1400);
  assert.equal(snapshot.curves.supporter.atk.length, 1400);
  assert.equal(snapshot.curves.defender.defByWeapon.MG.length, 1400);
});

