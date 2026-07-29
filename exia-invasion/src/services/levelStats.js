// SPDX-License-Identifier: GPL-3.0-or-later

import {
  getGameResourceUrl,
  getRoleDataLogicalPath,
} from "../utils/gameResourcePath.js";

export const LEVEL_STATS_SCHEMA_VERSION = 1;
export const LEVEL_STATS_CACHE_KEY = "levelStatsCacheV1";

export const LEVEL_STATS_REPRESENTATIVES = Object.freeze([
  Object.freeze({
    key: "attacker",
    name: "潘托姆",
    resourceId: 580,
    className: "Attacker",
    weaponType: "AR",
  }),
  Object.freeze({
    key: "supporter",
    name: "米兰达",
    resourceId: 32,
    className: "Supporter",
    weaponType: "SMG",
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

const DEFENDER_WEAPONS = Object.freeze(["RL", "AR", "SMG", "SG", "SR", "MG"]);
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

  const expectedLength = roles.get("attacker").hp.length;
  for (const role of roles.values()) {
    if (role.hp.length !== expectedLength) {
      throw new Error("八个代表角色的等级曲线长度不一致");
    }
  }

  const sharedEnhance = roles.get("attacker").statEnhance;
  for (const role of roles.values()) {
    if (STAT_ENHANCE_KEYS.some((key) => role.statEnhance[key] !== sharedEnhance[key])) {
      throw new Error("八个代表角色的突破/核心常量不一致");
    }
  }

  const defenderRoles = DEFENDER_WEAPONS.map((weapon) =>
    roles.get(`defender${weapon}`));
  const defenderBase = defenderRoles[0];
  for (const role of defenderRoles.slice(1)) {
    if (!arraysEqual(role.hp, defenderBase.hp) || !arraysEqual(role.atk, defenderBase.atk)) {
      throw new Error("六个防御型代表的 HP/ATK 曲线不一致");
    }
  }

  const snapshot = {
    schemaVersion: LEVEL_STATS_SCHEMA_VERSION,
    updatedAt,
    representatives: expectedRepresentatives(),
    statEnhance: { ...sharedEnhance },
    curves: {
      attacker: {
        hp: roles.get("attacker").hp,
        atk: roles.get("attacker").atk,
        def: roles.get("attacker").def,
      },
      supporter: {
        hp: roles.get("supporter").hp,
        atk: roles.get("supporter").atk,
        def: roles.get("supporter").def,
      },
      defender: {
        hp: defenderBase.hp,
        atk: defenderBase.atk,
        defByWeapon: Object.fromEntries(DEFENDER_WEAPONS.map((weapon) => [
          weapon,
          roles.get(`defender${weapon}`).def,
        ])),
      },
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
    validateCurve(snapshot?.curves?.attacker?.hp, "火力型 HP"),
    validateCurve(snapshot?.curves?.attacker?.atk, "火力型 ATK"),
    validateCurve(snapshot?.curves?.attacker?.def, "火力型 DEF"),
    validateCurve(snapshot?.curves?.supporter?.hp, "辅助型 HP"),
    validateCurve(snapshot?.curves?.supporter?.atk, "辅助型 ATK"),
    validateCurve(snapshot?.curves?.supporter?.def, "辅助型 DEF"),
    validateCurve(snapshot?.curves?.defender?.hp, "防御型 HP"),
    validateCurve(snapshot?.curves?.defender?.atk, "防御型 ATK"),
    ...DEFENDER_WEAPONS.map((weapon) =>
      validateCurve(snapshot?.curves?.defender?.defByWeapon?.[weapon], `防御型 ${weapon} DEF`)),
  ];
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
  if (normalizedClass === "attacker") {
    return snapshot.curves.attacker[normalizedStat] || null;
  }
  if (normalizedClass === "supporter") {
    return snapshot.curves.supporter[normalizedStat] || null;
  }
  if (normalizedClass !== "defender") return null;
  if (normalizedStat !== "def") {
    return snapshot.curves.defender[normalizedStat] || null;
  }
  return snapshot.curves.defender.defByWeapon?.[
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
