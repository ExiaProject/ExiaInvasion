// SPDX-License-Identifier: GPL-3.0-or-later

export const BASIC_STAT_KEYS = Object.freeze([
  "limit_break",
  "skill1_level",
  "skill2_level",
  "skill_burst_level",
]);

export const SIMULATED_STAT_KEYS = Object.freeze([
  "simulated_hp",
  "simulated_atk",
  "simulated_def",
]);
export const DEFAULT_SIMULATED_STAT_KEYS = Object.freeze(
  SIMULATED_STAT_KEYS.filter((key) => key !== "simulated_def"),
);

export const SHOW_STATS_CONFIG_MARKER = "__showStatsConfigured";
export const SIMULATED_STATS_CONFIG_MARKER = "__simulatedStatsConfigured";

const uniqueStrings = (values) =>
  Array.from(new Set((Array.isArray(values) ? values : []).filter(
    (value) => typeof value === "string",
  )));

export const resolveShowStats = (rawShowStats) => {
  const raw = uniqueStrings(rawShowStats);
  const basicsConfigured = raw.includes(SHOW_STATS_CONFIG_MARKER);
  const simulatedConfigured = raw.includes(SIMULATED_STATS_CONFIG_MARKER);
  const explicitlyVisible = raw.filter((key) => !key.startsWith("__"));
  const effective = new Set(explicitlyVisible);

  if (!basicsConfigured) {
    BASIC_STAT_KEYS.forEach((key) => effective.add(key));
  }
  if (!simulatedConfigured) {
    DEFAULT_SIMULATED_STAT_KEYS.forEach((key) => effective.add(key));
  }

  return {
    raw,
    basicsConfigured,
    simulatedConfigured,
    explicitlyVisible,
    effective: Array.from(effective),
  };
};

export const toggleShowStat = (rawShowStats, key, checked) => {
  const raw = uniqueStrings(rawShowStats);
  let base = [...raw];

  if (BASIC_STAT_KEYS.includes(key) && !base.includes(SHOW_STATS_CONFIG_MARKER)) {
    base.push(SHOW_STATS_CONFIG_MARKER, ...BASIC_STAT_KEYS);
  }
  if (
    SIMULATED_STAT_KEYS.includes(key)
    && !base.includes(SIMULATED_STATS_CONFIG_MARKER)
  ) {
    base.push(SIMULATED_STATS_CONFIG_MARKER, ...DEFAULT_SIMULATED_STAT_KEYS);
  }

  base = uniqueStrings(base);
  const next = checked
    ? base.includes(key) ? base : [...base, key]
    : base.filter((value) => value !== key);
  return uniqueStrings(next);
};
