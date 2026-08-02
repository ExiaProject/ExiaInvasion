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

// Set one output field while preserving the effective defaults of legacy data.
// A missing family marker means that the corresponding legacy defaults are still
// active, so only material changes need to materialize an explicit configuration.
export const setShowStat = (rawShowStats, key, checked) => {
  const resolved = resolveShowStats(rawShowStats);
  const currentlyVisible = resolved.effective.includes(key);
  if (currentlyVisible === checked) return rawShowStats;

  let base = resolved.raw;
  const isBasic = BASIC_STAT_KEYS.includes(key);
  const isSimulated = SIMULATED_STAT_KEYS.includes(key);

  if (isBasic && !resolved.basicsConfigured) {
    base = [
      ...base,
      SHOW_STATS_CONFIG_MARKER,
      ...BASIC_STAT_KEYS.filter((statKey) => resolved.effective.includes(statKey)),
    ];
  }

  if (isSimulated && !resolved.simulatedConfigured) {
    base = [
      ...base,
      SIMULATED_STATS_CONFIG_MARKER,
      ...DEFAULT_SIMULATED_STAT_KEYS.filter((statKey) => resolved.effective.includes(statKey)),
    ];
  }

  // AEL and equipment fields are explicit fields, but adding one to a legacy
  // character must not accidentally disable the legacy-visible basic fields.
  if (!isBasic && !isSimulated && checked && !resolved.basicsConfigured) {
    base = [
      ...base,
      SHOW_STATS_CONFIG_MARKER,
      ...BASIC_STAT_KEYS.filter((statKey) => resolved.effective.includes(statKey)),
    ];
  }

  const next = checked
    ? [...base, key]
    : base.filter((value) => value !== key);
  return uniqueStrings(next);
};

// Apply one output-field state to every character in a character template.
// The original object and unchanged character entries retain their identity so
// a no-op does not trigger an unnecessary persistence write.
export const updateCharactersShowStat = (characters, key, checked) => {
  if (!characters || typeof characters !== "object") return characters;
  if (!characters.elements || typeof characters.elements !== "object") {
    return characters;
  }

  let changed = false;
  const elements = Object.fromEntries(
    Object.entries(characters.elements).map(([element, list]) => {
      if (!Array.isArray(list)) return [element, list];

      let listChanged = false;
      const nextList = list.map((character) => {
        if (!character || typeof character !== "object") return character;
        const nextShowStats = setShowStat(character.showStats, key, checked);
        if (nextShowStats === character.showStats) return character;
        changed = true;
        listChanged = true;
        return { ...character, showStats: nextShowStats };
      });

      return [element, listChanged ? nextList : list];
    }),
  );

  return changed ? { ...characters, elements } : characters;
};
