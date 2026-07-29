// SPDX-License-Identifier: GPL-3.0-or-later

import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SIMULATED_STAT_KEYS,
  SIMULATED_STAT_KEYS,
  SIMULATED_STATS_CONFIG_MARKER,
  resolveShowStats,
  toggleShowStat,
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
