// SPDX-License-Identifier: GPL-3.0-or-later

import { getGameResourceUrl } from "./gameResourcePath.js";
import {
  getResearchKeyForClass,
  getResearchKeyForCorporation,
  RESEARCH_LEVEL_DEFINITIONS,
} from "./researchLevels.js";
import { selectSharedLevelCurve } from "../services/levelStats.js";

export const OFFICIAL_STATIC_PATHS = Object.freeze({
  research: "character/RecycleResearchStatTable.json",
  attractive: "character/AttractiveLevelTable.json",
  equipment: "equip/ItemEquipTable-zh-tw.json",
});

const STAT_SPECS = Object.freeze([
  Object.freeze({
    stat: "hp",
    outputKey: "simulated_hp",
    gradeKey: "grade_hp",
    coreKey: "core_hp",
    researchKey: "hp",
    attractiveSuffix: "hp_rate",
    equipmentType: "Hp",
    resourceKey: "hp",
  }),
  Object.freeze({
    stat: "atk",
    outputKey: "simulated_atk",
    gradeKey: "grade_attack",
    coreKey: "core_attack",
    researchKey: "attack",
    attractiveSuffix: "attack_rate",
    equipmentType: "Atk",
    resourceKey: "atk",
  }),
  Object.freeze({
    stat: "def",
    outputKey: "simulated_def",
    gradeKey: "grade_defence",
    coreKey: "core_defence",
    researchKey: "defence",
    attractiveSuffix: "defence_rate",
    equipmentType: "Defence",
    resourceKey: "def",
  }),
]);

const CORPORATION_BY_ID = Object.freeze({
  1: "ELYSION",
  2: "MISSILIS",
  3: "TETRA",
  4: "PILGRIM",
  7: "ABNORMAL",
});

export class SimulationInputError extends Error {
  constructor(message) {
    super(message);
    this.name = "SimulationInputError";
  }
}

const requireFinite = (value, label) => {
  if (!Number.isFinite(value)) {
    throw new SimulationInputError(`${label} 缺失或非法`);
  }
  return value;
};

const requireNonNegativeInteger = (value, label) => {
  requireFinite(value, label);
  if (!Number.isInteger(value) || value < 0) {
    throw new SimulationInputError(`${label} 必须是非负整数`);
  }
  return value;
};

const toRecords = (value, label) => {
  const records = Array.isArray(value) ? value : value?.records;
  if (!Array.isArray(records) || records.length === 0) {
    throw new SimulationInputError(`${label} 静态表为空`);
  }
  return records;
};

const normalizeCorporation = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return CORPORATION_BY_ID[value] || null;
  }
  const normalized = String(value ?? "").trim().toUpperCase();
  if (/^\d+$/.test(normalized)) {
    return CORPORATION_BY_ID[Number(normalized)] || null;
  }
  return ["ELYSION", "MISSILIS", "TETRA", "PILGRIM", "ABNORMAL"].includes(
    normalized,
  )
    ? normalized
    : null;
};

export const normalizeSsrLimitBreak = ({ grade, core }) => {
  const rawGrade = requireNonNegativeInteger(grade, "突破等级");
  const rawCore = requireNonNegativeInteger(core, "核心强化等级");
  const total = Math.min(10, rawGrade + rawCore);
  return {
    grade: Math.min(3, total),
    core: Math.max(0, total - 3),
  };
};

export const selectHighestCube = (cubes) => {
  const candidates = (Array.isArray(cubes) ? cubes : [])
    .filter((cube) =>
      cube
      && cube.cube_id !== undefined
      && cube.cube_id !== null
      && Number.isFinite(cube.cube_level)
      && cube.cube_level > 0)
    .map((cube) => ({
      cube_id: cube.cube_id,
      cube_level: cube.cube_level,
    }));
  candidates.sort((left, right) => {
    if (left.cube_level !== right.cube_level) {
      return right.cube_level - left.cube_level;
    }
    const leftNumber = Number(left.cube_id);
    const rightNumber = Number(right.cube_id);
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
      return leftNumber - rightNumber;
    }
    return String(left.cube_id).localeCompare(String(right.cube_id));
  });
  return candidates[0] || null;
};

const buildRecordMap = (records) =>
  new Map(records.map((record) => [String(record?.id), record]));

const getRequiredResearchRows = (
  researchTable,
  className,
  corporation,
) => {
  const records = toRecords(researchTable, "研究");
  const recordMap = buildRecordMap(records);
  const classKey = getResearchKeyForClass(className);
  const corporationKey = getResearchKeyForCorporation(corporation);
  if (!classKey || !corporationKey) {
    throw new SimulationInputError("角色职业或企业无法映射研究等级");
  }
  const tidByKey = new Map(
    RESEARCH_LEVEL_DEFINITIONS.map(({ key, tid }) => [key, tid]),
  );
  const keys = ["general", classKey, corporationKey];
  const rows = keys.map((key) => {
    const row = recordMap.get(String(tidByKey.get(key)));
    if (!row) throw new SimulationInputError(`缺少 ${key} 研究静态记录`);
    return { key, row };
  });
  return rows;
};

const getAttractiveRow = (attractiveTable, attractiveLevel) => {
  const level = requireNonNegativeInteger(attractiveLevel, "好感度等级");
  if (level === 0) return null;
  const records = toRecords(attractiveTable, "好感度");
  const row = records.find((record) => record?.attractive_level === level);
  if (!row) {
    throw new SimulationInputError(`缺少好感度 ${level} 静态记录`);
  }
  return row;
};

const getEquipmentContribution = ({
  equipmentRecords,
  rawEquipments,
  roleCorporation,
  spec,
}) => {
  const recordMap = buildRecordMap(toRecords(equipmentRecords, "装备"));
  const slots = Array.isArray(rawEquipments) ? rawEquipments : [];
  let total = 0;

  for (let index = 0; index < 4; index += 1) {
    const equipment = slots[index] || {};
    const tid = equipment.tid ?? 0;
    if (tid === 0 || tid === "0" || tid === "") continue;

    const level = requireNonNegativeInteger(
      equipment.level,
      `第 ${index + 1} 件装备等级`,
    );
    if (
      equipment.corporation_type === undefined
      || equipment.corporation_type === null
    ) {
      throw new SimulationInputError(`第 ${index + 1} 件装备企业类型缺失`);
    }
    const record = recordMap.get(String(tid));
    if (!record) {
      throw new SimulationInputError(`装备 ${tid} 静态记录缺失`);
    }
    if (!Array.isArray(record.stat)) {
      throw new SimulationInputError(`装备 ${tid} 属性记录非法`);
    }
    const baseValue = record.stat
      .filter((entry) => entry?.stat_type === spec.equipmentType)
      .reduce(
        (sum, entry) => sum + requireFinite(
          entry.stat_value,
          `装备 ${tid} ${spec.equipmentType}`,
        ),
        0,
      );
    const equipmentCorporation = normalizeCorporation(
      equipment.corporation_type,
    );
    const corporationBonus =
      equipmentCorporation && equipmentCorporation === roleCorporation
        ? 0.3
        : 0;
    total += Math.round(baseValue * (1 + corporationBonus + level * 0.1));
  }
  return total;
};

const getIndexedResourceValue = (
  record,
  key,
  index,
  label,
) => {
  if (!record) return 0;
  if (!Array.isArray(record[key])) {
    throw new SimulationInputError(`${label} ${key} 数组缺失`);
  }
  const value = record[key][index];
  return requireFinite(value, `${label} ${key}[${index}]`);
};

/**
 * Reproduces the official positive-stat rounding order for one character.
 */
export const calculateCharacterSimulatedStats = ({
  levelStats,
  metadata,
  userCharacter,
  synchroLevel,
  characterDetail,
  researchLevels,
  researchTable,
  attractiveTable,
  equipmentTable,
  cubeSelection = null,
  cubeRecord = null,
  favoriteRecord = null,
}) => {
  if (!metadata || !userCharacter || !characterDetail) {
    throw new SimulationInputError("角色计算输入不完整");
  }

  const className = metadata.class;
  const corporation = normalizeCorporation(metadata.corporation);
  const weaponType = metadata.weapon_type;
  if (!["Attacker", "Defender", "Supporter"].includes(className)) {
    throw new SimulationInputError("角色职业非法");
  }
  if (!corporation) {
    throw new SimulationInputError("角色企业非法");
  }
  if (!weaponType) {
    throw new SimulationInputError("角色武器类型缺失");
  }

  const level = requireNonNegativeInteger(synchroLevel, "同步器等级");
  if (level < 1) throw new SimulationInputError("同步器等级必须大于 0");
  const { grade, core } = normalizeSsrLimitBreak(userCharacter);
  const researchRows = getRequiredResearchRows(
    researchTable,
    className,
    corporation,
  );
  const attractiveRow = getAttractiveRow(
    attractiveTable,
    characterDetail.attractive_lv,
  );

  const normalizedClass = className.toLowerCase();
  const result = {};
  for (const spec of STAT_SPECS) {
    const curve = selectSharedLevelCurve(
      levelStats,
      className,
      weaponType,
      spec.stat,
    );
    if (!curve || !Number.isFinite(curve[level - 1])) {
      throw new SimulationInputError(
        `${className}/${weaponType} ${spec.stat} 等级曲线缺失`,
      );
    }
    const gradeRatio = requireFinite(
      levelStats?.statEnhance?.grade_ratio,
      "突破比例",
    );
    const gradeFixed = requireFinite(
      levelStats?.statEnhance?.[spec.gradeKey],
      spec.gradeKey,
    );
    const coreRatio = requireFinite(
      levelStats?.statEnhance?.[spec.coreKey],
      spec.coreKey,
    );

    const characterValue = Math.floor(
      curve[level - 1] * (1 + grade * gradeRatio / 10000)
      + grade * gradeFixed,
    );
    const researchValue = Math.floor(researchRows.reduce(
      (sum, { key, row }) => {
        const researchLevel = researchLevels?.[key];
        requireNonNegativeInteger(researchLevel, `${key} 研究等级`);
        return sum + researchLevel * requireFinite(
          row[spec.researchKey],
          `${key} 研究 ${spec.researchKey}`,
        );
      },
      0,
    ));
    const attractiveField =
      `${normalizedClass}_${spec.attractiveSuffix}`;
    const attractiveValue = attractiveRow
      ? Math.round(requireFinite(
        attractiveRow[attractiveField],
        `好感度 ${attractiveField}`,
      ))
      : 0;
    const coreValue = Math.round(
      (characterValue + researchValue + attractiveValue)
      * (1 + core * coreRatio / 10000),
    );
    const equipmentValue = getEquipmentContribution({
      equipmentRecords: equipmentTable,
      rawEquipments: characterDetail.raw_equipments,
      roleCorporation: corporation,
      spec,
    });

    const cubeValue = cubeSelection
      ? getIndexedResourceValue(
        cubeRecord,
        spec.resourceKey,
        cubeSelection.cube_level - 1,
        `魔方 ${cubeSelection.cube_id}`,
      )
      : 0;
    const favoriteTid = characterDetail.favorite_item_tid ?? 0;
    const favoriteValue = favoriteTid
      ? getIndexedResourceValue(
        favoriteRecord,
        spec.resourceKey,
        requireNonNegativeInteger(
          characterDetail.favorite_item_lv,
          "珍藏品等级",
        ),
        `珍藏品 ${favoriteTid}`,
      )
      : 0;

    result[spec.outputKey] =
      coreValue + equipmentValue + cubeValue + favoriteValue;
  }
  return result;
};

const fetchOfficialJson = async (
  logicalPath,
  fetchImpl,
) => {
  const url = getGameResourceUrl(logicalPath);
  const response = await fetchImpl(url);
  if (!response?.ok) {
    throw new Error(`静态资源下载失败 (${response?.status ?? "unknown"}): ${logicalPath}`);
  }
  return response.json();
};

export const createOfficialStaticDataLoader = ({
  fetchImpl = globalThis.fetch,
} = {}) => {
  const promiseCache = new Map();
  const loadPath = (logicalPath) => {
    if (promiseCache.has(logicalPath)) return promiseCache.get(logicalPath);
    const promise = fetchOfficialJson(logicalPath, fetchImpl).catch((error) => {
      promiseCache.delete(logicalPath);
      throw error;
    });
    promiseCache.set(logicalPath, promise);
    return promise;
  };
  return {
    loadBase: async () => {
      const [researchTable, attractiveTable, equipmentTable] =
        await Promise.all([
          loadPath(OFFICIAL_STATIC_PATHS.research),
          loadPath(OFFICIAL_STATIC_PATHS.attractive),
          loadPath(OFFICIAL_STATIC_PATHS.equipment),
        ]);
      return { researchTable, attractiveTable, equipmentTable };
    },
    loadCube: (cubeId) => loadPath(`equip/zh-tw/cube_${cubeId}.json`),
    loadFavorite: (favoriteId) =>
      loadPath(`equip/zh-tw/favorite_${favoriteId}.json`),
    loadPath,
  };
};

const defaultStaticDataLoader = createOfficialStaticDataLoader();

const initializeSimulatedOutputs = (dict) => {
  for (const characters of Object.values(dict?.elements || {})) {
    if (!Array.isArray(characters)) continue;
    for (const character of characters) {
      character.simulated_hp = null;
      character.simulated_atk = null;
      character.simulated_def = null;
    }
  }
};

const sanitizeFailureReason = (error) => {
  const message = String(error?.message || error || "未知错误")
    .replace(/https?:\/\/\S+/g, "[URL]")
    .slice(0, 180);
  return message || "未知错误";
};

export const calculateSimulatedStatsForDict = async ({
  dict,
  userCharacters,
  characterDetails,
  nikkeDirectory,
  levelStats,
  forceSimulatedStatsLevel400 = false,
  staticDataLoader = defaultStaticDataLoader,
}) => {
  initializeSimulatedOutputs(dict);
  const result = { calculatedCount: 0, failures: [] };
  const userMap = new Map(
    (Array.isArray(userCharacters) ? userCharacters : []).map((character) => [
      String(character?.name_code),
      character,
    ]),
  );
  const detailMap = new Map(
    (Array.isArray(characterDetails) ? characterDetails : []).map((detail) => [
      String(detail?.name_code),
      detail,
    ]),
  );
  const directoryMap = new Map(
    (Array.isArray(nikkeDirectory) ? nikkeDirectory : []).map((entry) => [
      String(entry?.name_code),
      entry,
    ]),
  );
  const targets = [];
  for (const characters of Object.values(dict?.elements || {})) {
    if (!Array.isArray(characters)) continue;
    for (const outputCharacter of characters) {
      const key = String(outputCharacter?.name_code);
      if (!userMap.has(key) || !detailMap.has(key)) continue;
      targets.push({
        key,
        outputCharacter,
        userCharacter: userMap.get(key),
        characterDetail: detailMap.get(key),
        metadata: directoryMap.get(key),
      });
    }
  }
  if (targets.length === 0) return result;
  const simulationLevel = forceSimulatedStatsLevel400
    ? 400
    : dict.synchroLevel;

  let baseResources;
  const cubeSelection = selectHighestCube(dict?.cubes);
  let cubeRecord = null;
  try {
    [baseResources, cubeRecord] = await Promise.all([
      staticDataLoader.loadBase(),
      cubeSelection
        ? staticDataLoader.loadCube(cubeSelection.cube_id)
        : Promise.resolve(null),
    ]);
  } catch (error) {
    const reason = sanitizeFailureReason(error);
    result.failures.push(...targets.map(({ key }) => ({ name_code: key, reason })));
    return result;
  }

  const favoriteIds = Array.from(new Set(
    targets
      .map(({ characterDetail }) => characterDetail.favorite_item_tid)
      .filter((tid) => tid && tid !== "0")
      .map(String),
  ));
  const favoriteResults = await Promise.allSettled(
    favoriteIds.map(async (favoriteId) => [
      favoriteId,
      await staticDataLoader.loadFavorite(favoriteId),
    ]),
  );
  const favoriteMap = new Map();
  const favoriteErrors = new Map();
  favoriteResults.forEach((settled, index) => {
    const favoriteId = favoriteIds[index];
    if (settled.status === "fulfilled") {
      favoriteMap.set(favoriteId, settled.value[1]);
    } else {
      favoriteErrors.set(favoriteId, settled.reason);
    }
  });

  for (const target of targets) {
    try {
      const favoriteId = String(target.characterDetail.favorite_item_tid || "");
      if (favoriteId && favoriteErrors.has(favoriteId)) {
        throw favoriteErrors.get(favoriteId);
      }
      const values = calculateCharacterSimulatedStats({
        levelStats,
        metadata: target.metadata,
        userCharacter: target.userCharacter,
        synchroLevel: simulationLevel,
        characterDetail: target.characterDetail,
        researchLevels: dict.researchLevels,
        ...baseResources,
        cubeSelection,
        cubeRecord,
        favoriteRecord: favoriteId ? favoriteMap.get(favoriteId) : null,
      });
      Object.assign(target.outputCharacter, values);
      result.calculatedCount += 1;
    } catch (error) {
      result.failures.push({
        name_code: target.key,
        reason: sanitizeFailureReason(error),
      });
    }
  }
  return result;
};
