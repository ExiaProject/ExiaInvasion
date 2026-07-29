// SPDX-License-Identifier: GPL-3.0-or-later

import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateCharacterSimulatedStats,
  normalizeSsrLimitBreak,
  selectHighestCube,
} from "../src/utils/simulatedStats.js";
import {
  createEmptyResearchLevels,
  mapResearchLevels,
} from "../src/utils/researchLevels.js";

const makeLevelStats = () => ({
  schemaVersion: 1,
  updatedAt: "2026-07-29T00:00:00.000Z",
  representatives: {
    attacker: { resourceId: 580, className: "Attacker", weaponType: "AR" },
    supporter: { resourceId: 32, className: "Supporter", weaponType: "SMG" },
    defenderRL: { resourceId: 80, className: "Defender", weaponType: "RL" },
    defenderAR: { resourceId: 281, className: "Defender", weaponType: "AR" },
    defenderSMG: { resourceId: 380, className: "Defender", weaponType: "SMG" },
    defenderSG: { resourceId: 30, className: "Defender", weaponType: "SG" },
    defenderSR: { resourceId: 620, className: "Defender", weaponType: "SR" },
    defenderMG: { resourceId: 330, className: "Defender", weaponType: "MG" },
  },
  statEnhance: {
    grade_ratio: 200,
    grade_hp: 3,
    grade_attack: 2,
    grade_defence: 1,
    core_hp: 200,
    core_attack: 200,
    core_defence: 200,
  },
  curves: {
    attacker: { hp: [101], atk: [201], def: [301] },
    supporter: { hp: [102], atk: [202], def: [302] },
    defender: {
      hp: [103],
      atk: [203],
      defByWeapon: {
        RL: [303],
        AR: [304],
        SMG: [305],
        SG: [306],
        SR: [307],
        MG: [308],
      },
    },
  },
});

const researchTable = {
  records: [
    { id: 1001, hp: 1, attack: 1, defence: 1 },
    { id: 1101, hp: 2, attack: 2, defence: 2 },
    { id: 1102, hp: 2, attack: 2, defence: 2 },
    { id: 1103, hp: 2, attack: 2, defence: 2 },
    { id: 1201, hp: 3, attack: 3, defence: 3 },
    { id: 1202, hp: 3, attack: 3, defence: 3 },
    { id: 1203, hp: 3, attack: 3, defence: 3 },
    { id: 1204, hp: 3, attack: 3, defence: 3 },
    { id: 1205, hp: 3, attack: 3, defence: 3 },
  ],
};

const attractiveTable = {
  records: [{
    attractive_level: 1,
    attacker_hp_rate: 5,
    attacker_attack_rate: 5,
    attacker_defence_rate: 5,
    supporter_hp_rate: 5,
    supporter_attack_rate: 5,
    supporter_defence_rate: 5,
    defender_hp_rate: 5,
    defender_attack_rate: 5,
    defender_defence_rate: 5,
  }],
};

const equipmentTable = {
  records: [{
    id: 9001,
    stat: [
      { stat_type: "Hp", stat_value: 10 },
      { stat_type: "Atk", stat_value: 10 },
      { stat_type: "Defence", stat_value: 10 },
    ],
  }],
};

const baseInput = {
  levelStats: makeLevelStats(),
  metadata: {
    class: "Attacker",
    corporation: "MISSILIS",
    weapon_type: "RL",
    original_rare: "SSR",
  },
  userCharacter: { lv: 1, grade: 3, core: 2 },
  characterDetail: {
    attractive_lv: 1,
    favorite_item_tid: 7001,
    favorite_item_lv: 1,
    raw_equipments: [
      { tid: 9001, level: 2, corporation_type: "MISSILIS" },
      { tid: 0, level: 0, corporation_type: 0 },
      { tid: 0, level: 0, corporation_type: 0 },
      { tid: 0, level: 0, corporation_type: 0 },
    ],
  },
  researchLevels: {
    ...createEmptyResearchLevels(),
    general: 1,
    attacker: 1,
    missilis: 1,
  },
  researchTable,
  attractiveTable,
  equipmentTable,
  cubeSelection: { cube_id: 5001, cube_level: 2 },
  cubeRecord: { hp: [6, 7], atk: [6, 7], def: [6, 7] },
  favoriteRecord: { hp: [8, 9], atk: [8, 9], def: [8, 9] },
};

test("research mapping is order-independent, preserves zero, and nulls hidden/missing levels", () => {
  const mapped = mapResearchLevels([
    { tid: 1205, lv: -1 },
    { tid: 1102, lv: 0 },
    { tid: 1001, lv: 380 },
    { tid: 1201, lv: null },
    { tid: 9999, lv: 12 },
  ]);
  assert.deepEqual(mapped, {
    general: 380,
    attacker: null,
    defender: 0,
    supporter: null,
    elysion: null,
    missilis: null,
    tetra: null,
    pilgrim: null,
    abnormal: null,
  });
});

test("SSR breakthrough/core values are normalized through one shared 0..10 total", () => {
  assert.deepEqual(
    normalizeSsrLimitBreak({ grade: 2, core: 0 }),
    { grade: 2, core: 0 },
  );
  assert.deepEqual(
    normalizeSsrLimitBreak({ grade: 4, core: 2 }),
    { grade: 3, core: 3 },
  );
  assert.deepEqual(
    normalizeSsrLimitBreak({ grade: 20, core: 20 }),
    { grade: 3, core: 7 },
  );
});

test("highest cube is derived only from supplied template cubes with deterministic tie-breaking", () => {
  assert.deepEqual(
    selectHighestCube([
      { cube_id: 4, cube_level: 10 },
      { cube_id: 2, cube_level: 10 },
      { cube_id: 1, cube_level: 9 },
      { cube_id: 99, cube_level: 0 },
    ]),
    { cube_id: 2, cube_level: 10 },
  );
  assert.equal(selectHighestCube([]), null);
});

test("formula preserves official floor/round order and rounds each equipment item", () => {
  const result = calculateCharacterSimulatedStats(baseInput);
  // HP: floor(101*1.06+9)=116; research=6; bond=5;
  // round((116+6+5)*1.04)=132; equip=round(10*1.5)=15;
  // cube=7; favorite index 1=9 => 163.
  assert.equal(result.simulated_hp, 163);
  assert.equal(result.simulated_atk, 270);
  assert.equal(result.simulated_def, 377);
});

test("SR/R metadata still uses the approved shared SSR baseline", () => {
  const srResult = calculateCharacterSimulatedStats({
    ...baseInput,
    metadata: { ...baseInput.metadata, original_rare: "SR" },
    characterDetail: {
      ...baseInput.characterDetail,
      attractive_lv: 0,
    },
  });
  assert.equal(srResult.simulated_hp, 158);
});

test("missing required research leaves calculations invalid instead of silently using zero", () => {
  assert.throws(
    () => calculateCharacterSimulatedStats({
      ...baseInput,
      researchLevels: {
        ...baseInput.researchLevels,
        missilis: null,
      },
    }),
    /missilis 研究等级/,
  );
});
