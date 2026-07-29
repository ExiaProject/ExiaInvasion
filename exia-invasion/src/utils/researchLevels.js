// SPDX-License-Identifier: GPL-3.0-or-later

export const RESEARCH_LEVEL_DEFINITIONS = Object.freeze([
  Object.freeze({ key: "general", tid: 1001 }),
  Object.freeze({ key: "attacker", tid: 1101 }),
  Object.freeze({ key: "defender", tid: 1102 }),
  Object.freeze({ key: "supporter", tid: 1103 }),
  Object.freeze({ key: "elysion", tid: 1201 }),
  Object.freeze({ key: "missilis", tid: 1202 }),
  Object.freeze({ key: "tetra", tid: 1203 }),
  Object.freeze({ key: "pilgrim", tid: 1204 }),
  Object.freeze({ key: "abnormal", tid: 1205 }),
]);

export const createEmptyResearchLevels = () =>
  Object.fromEntries(RESEARCH_LEVEL_DEFINITIONS.map(({ key }) => [key, null]));

export const mapResearchLevels = (researches) => {
  const result = createEmptyResearchLevels();
  const keyByTid = new Map(
    RESEARCH_LEVEL_DEFINITIONS.map(({ key, tid }) => [String(tid), key]),
  );

  if (!Array.isArray(researches)) return result;
  for (const research of researches) {
    const key = keyByTid.get(String(research?.tid ?? ""));
    if (!key) continue;
    const level = research?.lv;
    result[key] = Number.isFinite(level) && level >= 0 ? level : null;
  }
  return result;
};

export const getResearchKeyForClass = (className) => {
  const normalized = String(className || "").toLowerCase();
  return ["attacker", "defender", "supporter"].includes(normalized)
    ? normalized
    : null;
};

export const getResearchKeyForCorporation = (corporation) => {
  const normalized = String(corporation || "").toLowerCase();
  return ["elysion", "missilis", "tetra", "pilgrim", "abnormal"].includes(
    normalized,
  )
    ? normalized
    : null;
};

