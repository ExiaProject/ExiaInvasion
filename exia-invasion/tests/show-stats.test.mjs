// SPDX-License-Identifier: GPL-3.0-or-later

import test from "node:test";
import assert from "node:assert/strict";
import {
  BASIC_STAT_KEYS,
  DEFAULT_SIMULATED_STAT_KEYS,
  SIMULATED_STAT_KEYS,
  SHOW_STATS_CONFIG_MARKER,
  SIMULATED_STATS_CONFIG_MARKER,
  resolveShowStats,
  setShowStat,
  toggleShowStat,
  updateCharactersShowStat,
} from "../src/utils/showStats.js";

test("unconfigured templates default simulated defense off", () => {
  const resolved = resolveShowStats(["limit_break"]);
  assert.deepEqual(
    SIMULATED_STAT_KEYS.map((key) => resolved.effective.includes(key)),
    [true, true, false],
  );
  assert.deepEqual(DEFAULT_SIMULATED_STAT_KEYS, [
    "simulated_hp",
    "simulated_atk",
  ]);
  assert.equal(resolved.simulatedConfigured, false);
});

test("the first simulated toggle seeds all defaults and writes the independent marker", () => {
  const next = toggleShowStat(["limit_break"], "simulated_atk", false);
  assert.equal(next.includes(SIMULATED_STATS_CONFIG_MARKER), true);
  assert.equal(next.includes("simulated_hp"), true);
  assert.equal(next.includes("simulated_atk"), false);
  assert.equal(next.includes("simulated_def"), false);
});

test("simulated defense remains available when explicitly enabled", () => {
  const next = toggleShowStat(["limit_break"], "simulated_def", true);
  assert.equal(next.includes(SIMULATED_STATS_CONFIG_MARKER), true);
  assert.equal(next.includes("simulated_hp"), true);
  assert.equal(next.includes("simulated_atk"), true);
  assert.equal(next.includes("simulated_def"), true);
});

test("legacy basic defaults remain visible when one basic field is disabled", () => {
  const next = setShowStat(undefined, "limit_break", false);
  const resolved = resolveShowStats(next);

  assert.deepEqual(next, [
    SHOW_STATS_CONFIG_MARKER,
    "skill1_level",
    "skill2_level",
    "skill_burst_level",
  ]);
  assert.equal(resolved.effective.includes("limit_break"), false);
  assert.equal(resolved.effective.includes("skill1_level"), true);
  assert.equal(resolved.effective.includes("simulated_hp"), true);
  assert.equal(resolved.effective.includes("simulated_atk"), true);
});

test("enabling an explicit field on legacy data preserves legacy basic output", () => {
  const next = setShowStat(undefined, "AtkElemLbScore", true);
  const resolved = resolveShowStats(next);

  assert.equal(next.includes(SHOW_STATS_CONFIG_MARKER), true);
  assert.equal(next.includes("AtkElemLbScore"), true);
  assert.deepEqual(
    BASIC_STAT_KEYS.every((key) => resolved.effective.includes(key)),
    true,
  );
});

test("disabling a legacy simulated default writes only the simulated marker", () => {
  const next = setShowStat(undefined, "simulated_hp", false);
  const resolved = resolveShowStats(next);

  assert.equal(next.includes(SIMULATED_STATS_CONFIG_MARKER), true);
  assert.equal(next.includes(SHOW_STATS_CONFIG_MARKER), false);
  assert.equal(resolved.effective.includes("simulated_hp"), false);
  assert.equal(resolved.effective.includes("simulated_atk"), true);
  assert.equal(resolved.effective.includes("limit_break"), true);
});

test("bulk output updates cover every element and preserve no-op identity", () => {
  const template = {
    elements: {
      Electronic: [{ id: "electronic", showStats: undefined }],
      Fire: [{ id: "fire", showStats: [] }],
      Wind: [{ id: "wind", showStats: [SHOW_STATS_CONFIG_MARKER, ...BASIC_STAT_KEYS] }],
      Water: [],
      Iron: [],
      Utility: [{ id: "utility", showStats: [] }],
    },
  };

  const next = updateCharactersShowStat(template, "skill1_level", false);
  for (const list of Object.values(next.elements)) {
    for (const character of list) {
      assert.equal(
        resolveShowStats(character.showStats).effective.includes("skill1_level"),
        false,
      );
    }
  }
  assert.strictEqual(next.elements.Water, template.elements.Water);

  const noOp = updateCharactersShowStat(next, "skill1_level", false);
  assert.strictEqual(noOp, next);
});

test("bulk output updates support every current output column", () => {
  const equipmentKeys = [
    "IncElementDmg",
    "StatAtk",
    "StatAmmoLoad",
    "StatChargeTime",
    "StatChargeDamage",
    "StatCritical",
    "StatCriticalDamage",
    "StatAccuracyCircle",
    "StatDef",
  ];
  const outputKeys = [
    "AtkElemLbScore",
    ...BASIC_STAT_KEYS,
    ...SIMULATED_STAT_KEYS,
    ...equipmentKeys,
  ];
  const showStats = [
    SHOW_STATS_CONFIG_MARKER,
    SIMULATED_STATS_CONFIG_MARKER,
    ...BASIC_STAT_KEYS,
    ...SIMULATED_STAT_KEYS,
    ...equipmentKeys,
    "AtkElemLbScore",
  ];
  const template = {
    elements: {
      Electronic: [{ id: "one", showStats }],
      Fire: [{ id: "two", showStats: [...showStats] }],
    },
  };

  for (const key of outputKeys) {
    const disabled = updateCharactersShowStat(template, key, false);
    for (const character of Object.values(disabled.elements).flat()) {
      assert.equal(
        resolveShowStats(character.showStats).effective.includes(key),
        false,
        `expected ${key} to be disabled`,
      );
    }

    const enabled = updateCharactersShowStat(disabled, key, true);
    for (const character of Object.values(enabled.elements).flat()) {
      assert.equal(
        resolveShowStats(character.showStats).effective.includes(key),
        true,
        `expected ${key} to be enabled`,
      );
    }
  }

  assert.equal(template.elements.Electronic[0].showStats.includes("StatDef"), true);
});
