// SPDX-License-Identifier: GPL-3.0-or-later

import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import saveDictToExcel from "../src/utils/excel.js";
import {
  BASIC_STAT_KEYS,
  SHOW_STATS_CONFIG_MARKER,
  SIMULATED_STAT_KEYS,
  SIMULATED_STATS_CONFIG_MARKER,
} from "../src/utils/showStats.js";

globalThis.chrome = {
  runtime: { lastError: null },
  storage: {
    local: {
      get: (_key, callback) => callback({
        nikkeDirectory: [{
          id: 1,
          name_code: 101,
          resource_id: 580,
        }],
      }),
      set: (_value, callback) => callback?.(),
    },
  },
};

const createDict = (showStats, simulatedAtk = 222) => ({
  name: "Tester",
  synchroLevel: 400,
  outpostLevel: 300,
  normalProgress: "40-1",
  hardProgress: "20-1",
  cubes: [{
    cube_id: 1000301,
    cube_level: 15,
    name_cn: "测试魔方",
    name_en: "Test Cube",
  }],
  researchLevels: {
    general: 380,
    attacker: 278,
    defender: 272,
    supporter: 259,
    elysion: 262,
    missilis: 261,
    tetra: 263,
    pilgrim: 262,
    abnormal: 237,
  },
  elements: {
    Electronic: [{
      id: 1,
      name_code: 101,
      name_cn: "测试妮姬",
      name_en: "Test Nikke",
      priority: "yellow",
      showStats,
      limit_break: { grade: 3, core: 7 },
      skill1_level: 10,
      skill2_level: 10,
      skill_burst_level: 10,
      simulated_hp: 111,
      simulated_atk: simulatedAtk,
      simulated_def: 333,
      item_rare: "",
      item_level: 0,
      equipments: {},
    }],
    Fire: [],
    Wind: [],
    Water: [],
    Iron: [],
    Utility: [],
  },
  options: { showEquipDetails: true },
});

const loadWorkbook = async (dict) => {
  const buffer = await saveDictToExcel(dict, "zh");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
};

test("Excel adds three simulated columns and nine research columns in the fixed order", async () => {
  const workbook = await loadWorkbook(createDict([
    SHOW_STATS_CONFIG_MARKER,
    ...BASIC_STAT_KEYS,
  ]));
  const sheet = workbook.worksheets[0];

  // Character block starts at D; simulated values occupy offsets 4..6.
  assert.equal(sheet.getCell(3, 8).value, "模拟生命");
  assert.equal(sheet.getCell(3, 9).value, "模拟攻击");
  assert.equal(sheet.getCell(3, 10).value, "模拟防御");
  assert.equal(sheet.getCell(4, 8).value, 111);
  assert.equal(sheet.getCell(4, 9).value, 222);
  assert.equal(sheet.getCell(4, 10).value, 333);
  assert.equal(sheet.getColumn(8).hidden, false);
  assert.equal(sheet.getColumn(9).hidden, false);
  assert.equal(sheet.getColumn(10).hidden, true);

  // 20 character columns => cube X, research Y:AG.
  assert.equal(sheet.getCell("Y1").value, "研究等级");
  assert.deepEqual(
    Array.from({ length: 9 }, (_, index) => sheet.getCell(4, 25 + index).value),
    [380, 278, 272, 259, 262, 261, 263, 262, 237],
  );
  assert.equal(sheet.getCell("Y2").value, "通用");
  assert.equal(sheet.getCell("AB2").value, "辅助型");
  assert.ok(sheet.model.merges.includes("D1:W1"));
  assert.ok(sheet.model.merges.includes("Y1:AG1"));
});

test("unconfigured templates hide simulated defense, while explicit settings are preserved", async () => {
  const oldWorkbook = await loadWorkbook(createDict([
    SHOW_STATS_CONFIG_MARKER,
    ...BASIC_STAT_KEYS,
  ]));
  const oldSheet = oldWorkbook.worksheets[0];
  assert.equal(oldSheet.getColumn(8).hidden, false);
  assert.equal(oldSheet.getColumn(9).hidden, false);
  assert.equal(oldSheet.getColumn(10).hidden, true);

  const configuredWorkbook = await loadWorkbook(createDict([
    SHOW_STATS_CONFIG_MARKER,
    SIMULATED_STATS_CONFIG_MARKER,
    ...BASIC_STAT_KEYS,
    "simulated_hp",
    "simulated_def",
  ]));
  const configuredSheet = configuredWorkbook.worksheets[0];
  assert.equal(configuredSheet.getColumn(8).hidden, false);
  assert.equal(configuredSheet.getColumn(9).hidden, true);
  assert.equal(configuredSheet.getColumn(10).hidden, false);
});

test("null simulated values and research values export as blank cells", async () => {
  const dict = createDict([
    SHOW_STATS_CONFIG_MARKER,
    SIMULATED_STATS_CONFIG_MARKER,
    ...BASIC_STAT_KEYS,
    ...SIMULATED_STAT_KEYS,
  ], null);
  dict.researchLevels.missilis = null;
  const workbook = await loadWorkbook(dict);
  const sheet = workbook.worksheets[0];
  assert.equal(sheet.getCell(4, 9).value, null);
  assert.equal(sheet.getCell(4, 30).value, null);
});
