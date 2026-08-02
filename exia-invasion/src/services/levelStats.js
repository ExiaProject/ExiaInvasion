// SPDX-License-Identifier: GPL-3.0-or-later

import {
  getGameResourceUrl,
  getRoleDataLogicalPath,
} from "../utils/gameResourcePath.js";

export const LEVEL_STATS_SCHEMA_VERSION = 2;
export const LEVEL_STATS_CACHE_KEY = "levelStatsCacheV2";

export const LEVEL_STATS_REPRESENTATIVES = Object.freeze([
  Object.freeze({
    key: "attackerAR",
    name: "潘托姆",
    resourceId: 580,
    className: "Attacker",
    weaponType: "AR",
  }),
  Object.freeze({
    key: "attackerMG",
    name: "吉萝婷",
    resourceId: 180,
    className: "Attacker",
    weaponType: "MG",
  }),
  Object.freeze({
    key: "attackerRL",
    name: "贝斯蒂",
    resourceId: 91,
    className: "Attacker",
    weaponType: "RL",
  }),
  Object.freeze({
    key: "attackerSG",
    name: "德雷克",
    resourceId: 101,
    className: "Attacker",
    weaponType: "SG",
  }),
  Object.freeze({
    key: "attackerSMG",
    name: "D",
    resourceId: 40,
    className: "Attacker",
    weaponType: "SMG",
  }),
  Object.freeze({
    key: "attackerSR",
    name: "麦斯威尔",
    resourceId: 102,
    className: "Attacker",
    weaponType: "SR",
  }),
  Object.freeze({
    key: "supporterSMG",
    name: "米兰达",
    resourceId: 32,
    className: "Supporter",
    weaponType: "SMG",
  }),
  Object.freeze({
    key: "supporterAR",
    name: "托比",
    resourceId: 192,
    className: "Supporter",
    weaponType: "AR",
  }),
  Object.freeze({
    key: "supporterMG",
    name: "艾玛",
    resourceId: 90,
    className: "Supporter",
    weaponType: "MG",
  }),
  Object.freeze({
    key: "supporterRL",
    name: "基里",
    resourceId: 33,
    className: "Supporter",
    weaponType: "RL",
  }),
  Object.freeze({
    key: "supporterSG",
    name: "梅里",
    resourceId: 130,
    className: "Supporter",
    weaponType: "SG",
  }),
  Object.freeze({
    key: "supporterSR",
    name: "艾德米",
    resourceId: 172,
    className: "Supporter",
    weaponType: "SR",
  }),
  Object.freeze({
    key: "defenderRL",
    name: "桑迪",
    resourceId: 80,
    className: "Defender",
    weaponType: "RL",
  }),
  Object.freeze({
    key: "defenderAR",
    name: "牡丹",
    resourceId: 281,
    className: "Defender",
    weaponType: "AR",
  }),
  Object.freeze({
    key: "defenderSMG",
    name: "尼罗",
    resourceId: 380,
    className: "Defender",
    weaponType: "SMG",
  }),
  Object.freeze({
    key: "defenderSG",
    name: "波莉",
    resourceId: 30,
    className: "Defender",
    weaponType: "SG",
  }),
  Object.freeze({
    key: "defenderSR",
    name: "白鹤",
    resourceId: 620,
    className: "Defender",
    weaponType: "SR",
  }),
  Object.freeze({
    key: "defenderMG",
    name: "皇冠",
    resourceId: 330,
    className: "Defender",
    weaponType: "MG",
  }),
]);

const STAT_ENHANCE_KEYS = Object.freeze([
  "grade_ratio",
  "grade_hp",
  "grade_attack",
  "grade_defence",
  "core_hp",
  "core_attack",
  "core_defence",
]);

const LEVEL_STATS_WEAPONS = Object.freeze(["RL", "AR", "SMG", "SG", "SR", "MG"]);
const validatedSnapshots = new WeakSet();

const unwrapRoleData = (payload) =>
  Array.isArray(payload) ? payload[0] : payload;

const arraysEqual = (left, right) =>
  Array.isArray(left)
  && Array.isArray(right)
  && left.length === right.length
  && left.every((value, index) => value === right[index]);

const validateCurve = (curve, label) => {
  if (!Array.isArray(curve) || curve.length === 0) {
    throw new Error(`${label} 曲线为空`);
  }
  if (!curve.every((value) => Number.isFinite(value) && value >= 0)) {
    throw new Error(`${label} 曲线含非法数值`);
  }
  return [...curve];
};

const readRole = (payload, representative) => {
  const role = unwrapRoleData(payload);
  if (!role || typeof role !== "object") {
    throw new Error(`${representative.name} roledata 格式错误`);
  }
  if (String(role.resource_id) !== String(representative.resourceId)) {
    throw new Error(`${representative.name} resource_id 不匹配`);
  }
  if (role.class !== representative.className) {
    throw new Error(`${representative.name} 职业不匹配`);
  }
  if (role.original_rare !== "SSR") {
    throw new Error(`${representative.name} 不是 SSR`);
  }
  if (role?.shot_detail?.weapon_type !== representative.weaponType) {
    throw new Error(`${representative.name} 武器类型不匹配`);
  }

  const hp = validateCurve(
    role.character_level_hp_list,
    `${representative.name} HP`,
  );
  const atk = validateCurve(
    role.character_level_attack_list,
    `${representative.name} ATK`,
  );
  const def = validateCurve(
    role.character_level_defence_list,
    `${representative.name} DEF`,
  );
  if (hp.length !== atk.length || hp.length !== def.length) {
    throw new Error(`${representative.name} 三项曲线长度不一致`);
  }

  const statEnhance = {};
  for (const key of STAT_ENHANCE_KEYS) {
    const value = role?.stat_enhance_detail?.[key];
    if (!Number.isFinite(value)) {
      throw new Error(`${representative.name} ${key} 非法`);
    }
    statEnhance[key] = value;
  }
  return { hp, atk, def, statEnhance };
};

const expectedRepresentatives = () =>
  Object.fromEntries(LEVEL_STATS_REPRESENTATIVES.map((representative) => [
    representative.key,
    {
      name: representative.name,
      resourceId: representative.resourceId,
      className: representative.className,
      weaponType: representative.weaponType,
    },
  ]));

const getClassRoles = (roles, className) =>
  LEVEL_STATS_REPRESENTATIVES
    .filter((representative) => representative.className === className)
    .map((representative) => ({
      representative,
      role: roles.get(representative.key),
    }));

const buildClassCurves = (roles, className, label) => {
  const classRoles = getClassRoles(roles, className);
  const roleByWeapon = new Map(
    classRoles.map(({ representative, role }) => [representative.weaponType, role]),
  );
  const missingWeapons = LEVEL_STATS_WEAPONS.filter((weapon) => !roleByWeapon.has(weapon));
  if (missingWeapons.length > 0) {
    throw new Error(`${label} 缺少武器代表: ${missingWeapons.join(", ")}`);
  }

  const baseRole = classRoles[0]?.role;
  for (const { role } of classRoles.slice(1)) {
    if (!arraysEqual(role.hp, baseRole.hp) || !arraysEqual(role.atk, baseRole.atk)) {
      throw new Error(`${label}代表的 HP/ATK 曲线不一致`);
    }
  }

  return {
    hp: baseRole.hp,
    atk: baseRole.atk,
    defByWeapon: Object.fromEntries(LEVEL_STATS_WEAPONS.map((weapon) => [
      weapon,
      roleByWeapon.get(weapon).def,
    ])),
  };
};

export const buildLevelStatsSnapshot = (
  roleDataByResourceId,
  updatedAt = new Date().toISOString(),
) => {
  const source = roleDataByResourceId instanceof Map
    ? roleDataByResourceId
    : new Map(Object.entries(roleDataByResourceId || {}));
  const roles = new Map();

  for (const representative of LEVEL_STATS_REPRESENTATIVES) {
    const payload = source.get(representative.resourceId)
      ?? source.get(String(representative.resourceId));
    roles.set(representative.key, readRole(payload, representative));
  }

  const expectedLength = roles.get("attackerAR").hp.length;
  for (const role of roles.values()) {
    if (role.hp.length !== expectedLength) {
      throw new Error(`${LEVEL_STATS_REPRESENTATIVES.length} 个代表角色的等级曲线长度不一致`);
    }
  }

  const sharedEnhance = roles.get(LEVEL_STATS_REPRESENTATIVES[0].key).statEnhance;
  for (const role of roles.values()) {
    if (STAT_ENHANCE_KEYS.some((key) => role.statEnhance[key] !== sharedEnhance[key])) {
      throw new Error(`${LEVEL_STATS_REPRESENTATIVES.length} 个代表角色的突破/核心常量不一致`);
    }
  }

  const attackerCurves = buildClassCurves(roles, "Attacker", "火力型");
  const supporterCurves = buildClassCurves(roles, "Supporter", "辅助型");
  const defenderCurves = buildClassCurves(roles, "Defender", "防御型");

  const snapshot = {
    schemaVersion: LEVEL_STATS_SCHEMA_VERSION,
    updatedAt,
    representatives: expectedRepresentatives(),
    statEnhance: { ...sharedEnhance },
    curves: {
      attacker: attackerCurves,
      supporter: supporterCurves,
      defender: defenderCurves,
    },
  };
  return validateLevelStatsSnapshot(snapshot);
};

export const validateLevelStatsSnapshot = (snapshot) => {
  if (!snapshot || snapshot.schemaVersion !== LEVEL_STATS_SCHEMA_VERSION) {
    throw new Error("等级曲线缓存 schemaVersion 不兼容");
  }
  if (validatedSnapshots.has(snapshot)) return snapshot;
  if (!Number.isFinite(Date.parse(snapshot.updatedAt))) {
    throw new Error("等级曲线缓存更新时间非法");
  }

  const expected = expectedRepresentatives();
  for (const [key, representative] of Object.entries(expected)) {
    const actual = snapshot?.representatives?.[key];
    if (
      !actual
      || String(actual.resourceId) !== String(representative.resourceId)
      || actual.className !== representative.className
      || actual.weaponType !== representative.weaponType
    ) {
      throw new Error(`等级曲线代表配置不匹配: ${key}`);
    }
  }

  for (const key of STAT_ENHANCE_KEYS) {
    if (!Number.isFinite(snapshot?.statEnhance?.[key])) {
      throw new Error(`等级曲线常量非法: ${key}`);
    }
  }

  const curves = [
    ["attacker", "火力型"],
    ["supporter", "辅助型"],
    ["defender", "防御型"],
  ].flatMap(([classKey, label]) => [
    validateCurve(snapshot?.curves?.[classKey]?.hp, `${label} HP`),
    validateCurve(snapshot?.curves?.[classKey]?.atk, `${label} ATK`),
    ...LEVEL_STATS_WEAPONS.map((weapon) =>
      validateCurve(
        snapshot?.curves?.[classKey]?.defByWeapon?.[weapon],
        `${label} ${weapon} DEF`,
      )),
  ]);
  const length = curves[0].length;
  if (!curves.every((curve) => curve.length === length)) {
    throw new Error("等级曲线缓存数组长度不一致");
  }
  validatedSnapshots.add(snapshot);
  return snapshot;
};

export const selectSharedLevelCurve = (
  snapshot,
  className,
  weaponType,
  stat,
) => {
  validateLevelStatsSnapshot(snapshot);
  const normalizedClass = String(className || "").toLowerCase();
  const normalizedStat = {
    attack: "atk",
    defence: "def",
    defense: "def",
  }[String(stat || "").toLowerCase()] || String(stat || "").toLowerCase();

  if (!["hp", "atk", "def"].includes(normalizedStat)) return null;
  if (!["attacker", "supporter", "defender"].includes(normalizedClass)) return null;
  const classCurves = snapshot.curves[normalizedClass];
  if (normalizedStat !== "def") return classCurves[normalizedStat] || null;
  return classCurves.defByWeapon?.[
    String(weaponType || "").toUpperCase()
  ] || null;
};

const defaultStorageGet = () =>
  new Promise((resolve) => {
    if (!globalThis.chrome?.storage?.local) {
      resolve(null);
      return;
    }
    chrome.storage.local.get(LEVEL_STATS_CACHE_KEY, (result) => {
      resolve(result?.[LEVEL_STATS_CACHE_KEY] ?? null);
    });
  });

const defaultStorageSet = (snapshot) =>
  new Promise((resolve, reject) => {
    if (!globalThis.chrome?.storage?.local) {
      resolve();
      return;
    }
    chrome.storage.local.set({ [LEVEL_STATS_CACHE_KEY]: snapshot }, () => {
      const error = chrome.runtime?.lastError;
      if (error) reject(new Error(error.message));
      else resolve();
    });
  });

const fetchJson = async (url, fetchImpl = globalThis.fetch) => {
  const response = await fetchImpl(url);
  if (!response?.ok) {
    throw new Error(`下载失败 (${response?.status ?? "unknown"}): ${url}`);
  }
  return response.json();
};

const defaultBundledLoader = () => {
  if (!globalThis.chrome?.runtime?.getURL) {
    throw new Error("无法定位内置 level-stats.json");
  }
  return fetchJson(chrome.runtime.getURL("level-stats.json"));
};

const defaultRoleLoader = (representative) =>
  fetchJson(getGameResourceUrl(getRoleDataLogicalPath(representative.resourceId)));

const selectNewestSnapshot = (snapshots) =>
  [...snapshots].sort(
    (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
  )[0];

export const createLevelStatsManager = ({
  loadBundledSnapshot = defaultBundledLoader,
  loadCachedSnapshot = defaultStorageGet,
  saveCachedSnapshot = defaultStorageSet,
  loadRoleData = defaultRoleLoader,
  now = () => new Date().toISOString(),
} = {}) => {
  let activeSnapshot = null;
  let loadPromise = null;
  let refreshPromise = null;
  let initializePromise = null;

  const load = () => {
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
      const candidates = await Promise.allSettled([
        loadBundledSnapshot(),
        loadCachedSnapshot(),
      ]);
      const valid = [];
      for (const candidate of candidates) {
        if (candidate.status !== "fulfilled" || !candidate.value) continue;
        try {
          valid.push(validateLevelStatsSnapshot(candidate.value));
        } catch {
          // 损坏或过期缓存不能阻断内置快照回退。
        }
      }
      if (valid.length === 0) {
        throw new Error("没有可用的共享等级曲线");
      }
      activeSnapshot = selectNewestSnapshot(valid);
      return activeSnapshot;
    })();
    return loadPromise;
  };

  const refresh = () => {
    if (refreshPromise) return refreshPromise;
    refreshPromise = (async () => {
      await load();
      const payloads = await Promise.all(
        LEVEL_STATS_REPRESENTATIVES.map(async (representative) => [
          representative.resourceId,
          await loadRoleData(representative),
        ]),
      );
      const nextSnapshot = buildLevelStatsSnapshot(
        new Map(payloads),
        now(),
      );
      await saveCachedSnapshot(nextSnapshot);
      activeSnapshot = nextSnapshot;
      return activeSnapshot;
    })();
    return refreshPromise;
  };

  const initialize = () => {
    if (initializePromise) return initializePromise;
    initializePromise = (async () => {
      await load();
      try {
        await refresh();
      } catch (error) {
        console.warn("共享等级曲线 CDN 更新失败，继续使用上次有效快照:", error);
      }
      return activeSnapshot;
    })();
    return initializePromise;
  };

  const getForCalculation = async (timeoutMs = 8000) => {
    const fallback = await load();
    const inFlight = refresh();
    let timeoutId;
    await Promise.race([
      inFlight.catch(() => null),
      new Promise((resolve) => {
        timeoutId = setTimeout(resolve, Math.max(0, timeoutMs));
      }),
    ]);
    if (timeoutId) clearTimeout(timeoutId);
    return activeSnapshot || fallback;
  };

  return {
    initialize,
    load,
    refresh,
    getForCalculation,
    getActiveSnapshot: () => activeSnapshot,
  };
};

const defaultManager = createLevelStatsManager();

export const initializeLevelStats = () => defaultManager.initialize();
export const getLevelStatsForCalculation = (timeoutMs) =>
  defaultManager.getForCalculation(timeoutMs);
