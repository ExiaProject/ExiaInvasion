// SPDX-License-Identifier: GPL-3.0-or-later

import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateCharacterSimulatedStats,
  calculateSimulatedStatsForDict,
  normalizeSsrLimitBreak,
  selectHighestCube,
} from "../src/utils/simulatedStats.js";
import {
  createEmptyResearchLevels,
  mapResearchLevels,
} from "../src/utils/researchLevels.js";

const makeLevelStats = () => ({
  schemaVersion: 2,
  updatedAt: "2026-07-29T00:00:00.000Z",
  representatives: {
    attackerAR: { resourceId: 580, className: "Attacker", weaponType: "AR" },
    attackerMG: { resourceId: 180, className: "Attacker", weaponType: "MG" },
    attackerRL: { resourceId: 91, className: "Attacker", weaponType: "RL" },
    attackerSG: { resourceId: 101, className: "Attacker", weaponType: "SG" },
    attackerSMG: { resourceId: 40, className: "Attacker", weaponType: "SMG" },
    attackerSR: { resourceId: 102, className: "Attacker", weaponType: "SR" },
    supporterSMG: { resourceId: 32, className: "Supporter", weaponType: "SMG" },
    supporterAR: { resourceId: 192, className: "Supporter", weaponType: "AR" },
    supporterMG: { resourceId: 90, className: "Supporter", weaponType: "MG" },
    supporterRL: { resourceId: 33, className: "Supporter", weaponType: "RL" },
    supporterSG: { resourceId: 130, className: "Supporter", weaponType: "SG" },
    supporterSR: { resourceId: 172, className: "Supporter", weaponType: "SR" },
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
    attacker: {
      hp: [101],
      atk: [201],
      defByWeapon: {
        RL: [301],
        AR: [302],
        SMG: [303],
        SG: [304],
        SR: [305],
        MG: [306],
      },
    },
    supporter: {
      hp: [102],
      atk: [202],
      defByWeapon: {
        RL: [307],
        AR: [308],
        SMG: [309],
        SG: [310],
        SR: [311],
        MG: [312],
      },
    },
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

const makeTwoLevelStats = () => {
  const levelStats = makeLevelStats();
  levelStats.curves.attacker = {
    hp: [101, 1001],
    atk: [201, 2001],
    defByWeapon: {
      RL: [301, 3001],
      AR: [302, 3002],
      SMG: [303, 3003],
      SG: [304, 3004],
      SR: [305, 3005],
      MG: [306, 3006],
    },
  };
  levelStats.curves.supporter = {
    hp: [102, 1002],
    atk: [202, 2002],
    defByWeapon: {
      RL: [307, 3007],
      AR: [308, 3008],
      SMG: [309, 3009],
      SG: [310, 3010],
      SR: [311, 3011],
      MG: [312, 3012],
    },
  };
  levelStats.curves.defender = {
    hp: [103, 1003],
    atk: [203, 2003],
    defByWeapon: {
      RL: [303, 3003],
      AR: [304, 3004],
      SMG: [305, 3005],
      SG: [306, 3006],
      SR: [307, 3007],
      MG: [308, 3008],
    },
  };
  return levelStats;
};

const makeFourHundredLevelStats = () => {
  const levelStats = makeLevelStats();
  const buildCurve = (levelOne, level400) =>
    Array.from({ length: 400 }, (_, index) => index === 399 ? level400 : levelOne);
  const buildDefByWeapon = (levelOne, level400) => Object.fromEntries(
    ["RL", "AR", "SMG", "SG", "SR", "MG"].map((weapon, index) => [
      weapon,
      buildCurve(levelOne + index, level400 + index),
    ]),
  );

  levelStats.curves = {
    attacker: {
      hp: buildCurve(101, 4001),
      atk: buildCurve(201, 5001),
      defByWeapon: buildDefByWeapon(301, 6001),
    },
    supporter: {
      hp: buildCurve(102, 4002),
      atk: buildCurve(202, 5002),
      defByWeapon: buildDefByWeapon(307, 6007),
    },
    defender: {
      hp: buildCurve(103, 4003),
      atk: buildCurve(203, 5003),
      defByWeapon: buildDefByWeapon(303, 6003),
    },
  };
  return levelStats;
};

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
  synchroLevel: 1,
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

test("formula always uses synchronizer level regardless of character level", () => {
  const result = calculateCharacterSimulatedStats({
    ...baseInput,
    levelStats: makeTwoLevelStats(),
    synchroLevel: 2,
    userCharacter: { ...baseInput.userCharacter, lv: 400 },
  });

  assert.deepEqual(result, {
    simulated_hp: 1155,
    simulated_atk: 2255,
    simulated_def: 3354,
  });
});

test("dict calculation forwards its synchronizer level to every character", async () => {
  const outputCharacter = { name_code: 101 };
  const dict = {
    synchroLevel: 2,
    cubes: [],
    researchLevels: {
      ...createEmptyResearchLevels(),
      general: 0,
      attacker: 0,
      missilis: 0,
    },
    elements: { Electronic: [outputCharacter] },
  };

  const summary = await calculateSimulatedStatsForDict({
    dict,
    userCharacters: [{ name_code: 101, lv: 1, grade: 0, core: 0 }],
    characterDetails: [{
      name_code: 101,
      attractive_lv: 0,
      favorite_item_tid: 0,
      raw_equipments: [],
    }],
    nikkeDirectory: [{
      name_code: 101,
      class: "Attacker",
      corporation: "MISSILIS",
      weapon_type: "RL",
    }],
    levelStats: makeTwoLevelStats(),
    staticDataLoader: {
      loadBase: async () => ({
        researchTable,
        attractiveTable,
        equipmentTable,
      }),
    },
  });

  assert.deepEqual(summary, { calculatedCount: 1, failures: [] });
  assert.deepEqual(outputCharacter, {
    name_code: 101,
    simulated_hp: 1001,
    simulated_atk: 2001,
    simulated_def: 3001,
  });
});

test("400-level setting overrides only the simulated stat level", async () => {
  const runCalculation = async (forceSimulatedStatsLevel400) => {
    const outputCharacter = { name_code: 101 };
    const dict = {
      synchroLevel: 1,
      cubes: [],
      researchLevels: {
        ...createEmptyResearchLevels(),
        general: 0,
        attacker: 0,
        missilis: 0,
      },
      elements: { Electronic: [outputCharacter] },
    };

    const summary = await calculateSimulatedStatsForDict({
      dict,
      userCharacters: [{ name_code: 101, lv: 1, grade: 0, core: 0 }],
      characterDetails: [{
        name_code: 101,
        attractive_lv: 0,
        favorite_item_tid: 0,
        raw_equipments: [],
      }],
      nikkeDirectory: [{
        name_code: 101,
        class: "Attacker",
        corporation: "MISSILIS",
        weapon_type: "RL",
      }],
      levelStats: makeFourHundredLevelStats(),
      forceSimulatedStatsLevel400,
      staticDataLoader: {
        loadBase: async () => ({
          researchTable,
          attractiveTable,
          equipmentTable,
        }),
      },
    });

    return { dict, outputCharacter, summary };
  };

  const normal = await runCalculation(false);
  assert.deepEqual(normal.outputCharacter, {
    name_code: 101,
    simulated_hp: 101,
    simulated_atk: 201,
    simulated_def: 301,
  });

  const forced = await runCalculation(true);
  assert.deepEqual(forced.summary, { calculatedCount: 1, failures: [] });
  assert.deepEqual(forced.outputCharacter, {
    name_code: 101,
    simulated_hp: 4001,
    simulated_atk: 5001,
    simulated_def: 6001,
  });
  assert.equal(forced.dict.synchroLevel, 1);
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
