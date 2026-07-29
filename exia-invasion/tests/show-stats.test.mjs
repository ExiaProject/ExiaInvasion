// SPDX-License-Identifier: GPL-3.0-or-later

import test from "node:test";
import assert from "node:assert/strict";
import {
  SIMULATED_STAT_KEYS,
  SIMULATED_STATS_CONFIG_MARKER,
  resolveShowStats,
  toggleShowStat,
} from "../src/utils/showStats.js";

test("legacy templates expose all simulated columns until a simulated toggle is used", () => {
  const resolved = resolveShowStats(["limit_break"]);
  assert.deepEqual(
    SIMULATED_STAT_KEYS.map((key) => resolved.effective.includes(key)),
    [true, true, true],
  );
  assert.equal(resolved.simulatedConfigured, false);
});

test("the first simulated toggle seeds all defaults and writes the independent marker", () => {
  const next = toggleShowStat(["limit_break"], "simulated_atk", false);
  assert.equal(next.includes(SIMULATED_STATS_CONFIG_MARKER), true);
  assert.equal(next.includes("simulated_hp"), true);
  assert.equal(next.includes("simulated_atk"), false);
  assert.equal(next.includes("simulated_def"), true);
});

