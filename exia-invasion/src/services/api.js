// SPDX-License-Identifier: GPL-3.0-or-later
// API接口和数据处理模块
import { getCharacters } from "./storage.js";
import { Converter as OpenCCConverter } from "opencc-js";

// ========== 主线目录缓存键 ==========
const MAINLINE_CATALOG_MAP_KEY = "mainlineCatalogMap";
const MAINLINE_CATALOG_URL = "https://sg-tools-cdn.blablalink.com/xx-97/b32816a11f83865b09bcf95e67ca83ae.json";

/* ========== 载入基础账号数据模板 ========== */
export const loadBaseAccountDict = async () => {
  // 仅从打包内 cubes.json 读取魔方信息；人物目录从本地缓存获取
  const listUrl = chrome.runtime.getURL("cubes.json");
  const listResp = await fetch(listUrl);
  const listData = await listResp.json();
  const cubes = (listData.cubes || []).map(cube => ({
    cube_id: cube.cube_id,
    cube_level: 0,
    name_cn: cube.name_cn,
    name_en: cube.name_en
  }));

  // 从存储中获取角色数据（角色管理系统）
  const charactersData = await getCharacters();
  const showEquipDetails = charactersData?.options?.showEquipDetails !== false;
  
  // 确保所有元素都是数组格式，如需要则进行迁移
  const migratedElements = {};
  ["Electronic", "Fire", "Wind", "Water", "Iron", "Utility"].forEach(element => {
    if (charactersData.elements && charactersData.elements[element]) {
      if (Array.isArray(charactersData.elements[element])) {
        migratedElements[element] = charactersData.elements[element];
      } else {
        // 将对象转换为数组进行迁移
        migratedElements[element] = Object.values(charactersData.elements[element]);
      }
    } else {
      migratedElements[element] = [];
    }
  });
  
  // 创建基础数据结构，统一元素名称和固定排序
  const baseDict = {
    name: "",
    game_uid: "",
    synchroLevel: 0,
    outpostLevel: 0,
    normalProgress: "",
    hardProgress: "",
    cubes: cubes,
    elements: migratedElements,
    options: {
      showEquipDetails
    }
  };
  
  return baseDict;
};

/* ========== HTTP请求工具函数 ========== */
const buildHeader = () => ({
  "Content-Type": "application/json",
  Accept: "application/json",
});

const emitDiagnostic = (onDiagnostic, message) => {
  if (typeof onDiagnostic !== "function") return;
  try {
    onDiagnostic(message);
  } catch {
    // 诊断日志不能影响请求和验证结果
  }
};

const getEndpointName = (url) => {
  const path = String(url || "").split("?")[0];
  return path.split("/").filter(Boolean).pop() || "unknown-endpoint";
};

const sanitizeDiagnosticText = (value, maxLength = 160) => {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/((?:token|cookie|password|authorization)\s*[:=]\s*)[^\s,;]+/gi, "$1[REDACTED]")
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
};

const describeDiagnosticValue = (value) => {
  if (value === undefined) return "missing";
  if (value === null) return "null";
  if (value === "") return "empty-string";
  if (typeof value === "string") return `string(${sanitizeDiagnosticText(value, 40)})`;
  if (typeof value === "number") return `number(${value})`;
  if (typeof value === "boolean") return `boolean(${value})`;
  if (Array.isArray(value)) return `array(length=${value.length})`;
  if (typeof value === "object") return "object";
  return typeof value;
};

const summarizeApiResponse = (payload) => {
  if (!payload || typeof payload !== "object") {
    return `payload=${describeDiagnosticValue(payload)}`;
  }

  const businessCode = payload.code ?? payload.retcode ?? payload.ret_code ?? "missing";
  const businessMessage = payload.message ?? payload.msg ?? payload.error?.message ?? "";
  const data = payload.data;
  const dataKeys = data && typeof data === "object" && !Array.isArray(data)
    ? Object.keys(data).slice(0, 20)
    : [];
  const areaId = data && typeof data === "object" ? data.area_id : undefined;

  return [
    `businessCode=${sanitizeDiagnosticText(businessCode, 40) || "empty"}`,
    `businessMessage=${businessMessage ? sanitizeDiagnosticText(businessMessage) : "empty"}`,
    `data=${describeDiagnosticValue(data)}`,
    `dataKeys=[${dataKeys.join(",")}]`,
    `area_id=${describeDiagnosticValue(areaId)}`,
  ].join("; ");
};

const requestJson = async (url, options, onDiagnostic) => {
  const endpoint = getEndpointName(url);
  const startedAt = Date.now();
  emitDiagnostic(onDiagnostic, `${endpoint} 请求开始`);

  let res;
  try {
    res = await fetch(url, options);
  } catch (error) {
    emitDiagnostic(
      onDiagnostic,
      `${endpoint} 网络异常: ${sanitizeDiagnosticText(error?.message || error)}; elapsed=${Date.now() - startedAt}ms`
    );
    throw error;
  }

  emitDiagnostic(
    onDiagnostic,
    `${endpoint} HTTP响应: status=${res.status}; ok=${res.ok}; statusText=${sanitizeDiagnosticText(res.statusText) || "empty"}; elapsed=${Date.now() - startedAt}ms`
  );

  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

  let payload;
  try {
    payload = await res.json();
  } catch (error) {
    emitDiagnostic(
      onDiagnostic,
      `${endpoint} JSON解析失败: ${sanitizeDiagnosticText(error?.message || error)}`
    );
    throw error;
  }

  emitDiagnostic(onDiagnostic, `${endpoint} 响应摘要: ${summarizeApiResponse(payload)}`);
  return payload;
};

const postJson = (url, bodyObj, onDiagnostic) => {
  return requestJson(
    url,
    {
      method: "POST",
      headers: buildHeader(),
      body: JSON.stringify(bodyObj),
      credentials: "include", // 自动携带Cookie
    },
    onDiagnostic
  );
};

/**
 * 带账号标识的 POST 请求（用于并发模式）
 * 在 URL 后附加 _acct_id 参数，由 declarativeNetRequest 规则注入对应 Cookie
 * @param {string} url - 请求 URL
 * @param {object} bodyObj - 请求体
 * @param {string} accountId - 账号 game_uid
 * @returns {Promise<object>} - 响应 JSON
 */
const postJsonWithAccount = async (url, bodyObj, accountId, onDiagnostic) => {
  if (!accountId) {
    emitDiagnostic(onDiagnostic, `${getEndpointName(url)} 请求前检查失败: 缺少 game_uid`);
    throw new Error("缺少 game_uid，无法并发请求");
  }
  // 在 URL 后附加账号标识参数
  const separator = url.includes("?") ? "&" : "?";
  const urlWithId = `${url}${separator}_acct_id=${accountId}`;
  
  return requestJson(
    urlWithId,
    {
      method: "POST",
      headers: buildHeader(),
      body: JSON.stringify(bodyObj),
      credentials: "omit", // 不携带浏览器 Cookie，由拦截器注入
    },
    onDiagnostic
  );
};

/* ========== 游戏API接口 ========== */

// 从Cookie中获取intl_open_id
const getIntlOpenId = async () => {
  // 使用Chrome API获取cookie，而不是document.cookie
  const cookies = await chrome.cookies.getAll({ domain: ".blablalink.com" });
  const gameOpenIdCookie = cookies.find(cookie => cookie.name === 'game_openid');
  
  if (gameOpenIdCookie) {
    return gameOpenIdCookie.value;
  }
  
  throw new Error("未找到 game_openid cookie");
};

const USER_GAME_PLAYER_INFO_URL =
  "https://api.blablalink.com/api/ugc/direct/standalonesite/User/GetUserGamePlayerInfo";
const USER_CHECK_LOGIN_URL =
  "https://api.blablalink.com/api/user/CheckLogin";
const USER_INFO_NEW_URL =
  "https://api.blablalink.com/api/ugc/proxy/standalonesite/User/GetUserInfoNew";
const USER_PRIVACY_SETTING_URL =
  "https://api.blablalink.com/api/ugc/direct/standalonesite/User/GetUserPrivacySetting";
const PLAYER_INFO_SYSTEM_ERROR_CODE = "1300015";
const PLAYER_INFO_RETRY_DELAYS_MS = [1000, 2000];

const getApiBusinessCode = (response) => {
  return response?.code ?? response?.retcode ?? response?.ret_code;
};

const isApiResponseSuccessful = (response) => {
  return String(getApiBusinessCode(response)) === "0";
};

const isPlayerInfoResponseSuccessful = (response) => {
  return isApiResponseSuccessful(response) && Boolean(response?.data?.area_id);
};

const getCanonicalIntlOpenId = (response) => {
  return String(
    response?.data?.info?.intl_openid ??
    response?.data?.intl_openid ??
    ""
  ).trim();
};

const summarizeIntlOpenIdRelation = (canonicalIntlOpenId, gameOpenId) => {
  const canonicalText = String(canonicalIntlOpenId || "").trim();
  const gameOpenIdText = String(gameOpenId || "").trim();
  const segments = canonicalText ? canonicalText.split("-") : [];
  const canonicalSuffix = segments.length > 1 ? segments.slice(1).join("-") : "";
  const format = /^\d+-\d+$/.test(canonicalText)
    ? "numeric-prefix-and-id"
    : canonicalText.includes("-")
      ? "hyphenated-other"
      : canonicalText
        ? "unprefixed-or-other"
        : "missing";
  const equality = canonicalText && gameOpenIdText
    ? String(canonicalText === gameOpenIdText)
    : "unavailable";
  const suffixEquality = canonicalSuffix && gameOpenIdText
    ? String(canonicalSuffix === gameOpenIdText)
    : "unavailable";

  return [
    `canonicalIntlOpenId=${canonicalText ? "present" : "missing"}`,
    `format=${format}`,
    `segmentLengths=[${segments.map((segment) => segment.length).join(",")}]`,
    `equalsGameOpenIdCookie=${equality}`,
    `suffixEqualsGameOpenIdCookie=${suffixEquality}`,
  ].join("; ");
};

/**
 * 仅在 1300015 时执行有界恢复。
 * 返回的成功响应可进入正式判定；所有标识日志均只输出结构和比较结果。
 */
const recoverPlayerInfoSystemError = async (onDiagnostic) => {
  emitDiagnostic(
    onDiagnostic,
    `[恢复] 检测到 ${PLAYER_INFO_SYSTEM_ERROR_CODE}，开始有界重试: delays=[${PLAYER_INFO_RETRY_DELAYS_MS.join(",")}]ms`
  );

  for (let index = 0; index < PLAYER_INFO_RETRY_DELAYS_MS.length; index += 1) {
    const attempt = index + 1;
    const delayMs = PLAYER_INFO_RETRY_DELAYS_MS[index];
    const label = `恢复重试${attempt}`;
    emitDiagnostic(onDiagnostic, `[${label}] 等待 ${delayMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    let retryResponse = null;
    try {
      retryResponse = await postJson(
        USER_GAME_PLAYER_INFO_URL,
        {},
        (message) => emitDiagnostic(onDiagnostic, `[${label}] ${message}`)
      );
    } catch (error) {
      emitDiagnostic(
        onDiagnostic,
        `[${label}] 请求异常: ${sanitizeDiagnosticText(error?.message || error)}`
      );
    }

    const retryCode = getApiBusinessCode(retryResponse);
    const retryAreaId = retryResponse?.data?.area_id;
    const retrySucceeded = isPlayerInfoResponseSuccessful(retryResponse);
    emitDiagnostic(
      onDiagnostic,
      `[${label}] 结果: businessCode=${describeDiagnosticValue(retryCode)}; area_id=${describeDiagnosticValue(retryAreaId)}; success=${retrySucceeded}`
    );

    if (retrySucceeded) {
      emitDiagnostic(
        onDiagnostic,
        `[恢复结论] 第 ${attempt} 次重试成功，正式判定将采用本次响应`
      );
      return { response: retryResponse, source: `retry-${attempt}` };
    }

    if (
      retryResponse &&
      String(retryCode) !== PLAYER_INFO_SYSTEM_ERROR_CODE
    ) {
      emitDiagnostic(
        onDiagnostic,
        `[${label}] 业务码已变为 ${describeDiagnosticValue(retryCode)}，停止空请求重试`
      );
      break;
    }
  }

  emitDiagnostic(
    onDiagnostic,
    "[恢复] 空请求重试未成功，开始玩家标识后备链路"
  );

  let gameOpenId = "";
  try {
    gameOpenId = await getIntlOpenId();
    emitDiagnostic(
      onDiagnostic,
      `[后备1-game_openid参数] game_openid Cookie: ${gameOpenId ? "present" : "empty"}`
    );
  } catch (error) {
    emitDiagnostic(
      onDiagnostic,
      `[后备1-game_openid参数] 无法读取 game_openid Cookie: ${sanitizeDiagnosticText(error?.message || error)}`
    );
  }

  let gameOpenIdResponse = null;
  if (gameOpenId) {
    try {
      gameOpenIdResponse = await postJson(
        USER_GAME_PLAYER_INFO_URL,
        { intl_openid: gameOpenId },
        (message) => emitDiagnostic(onDiagnostic, `[后备1-game_openid参数] ${message}`)
      );
    } catch (error) {
      emitDiagnostic(
        onDiagnostic,
        `[后备1-game_openid参数] 请求异常: ${sanitizeDiagnosticText(error?.message || error)}`
      );
    }
  } else {
    emitDiagnostic(
      onDiagnostic,
      "[后备1-game_openid参数] 跳过请求: game_openid Cookie 不存在"
    );
  }

  const gameOpenIdCode = getApiBusinessCode(gameOpenIdResponse);
  const gameOpenIdAreaId = gameOpenIdResponse?.data?.area_id;
  const gameOpenIdSucceeded = isPlayerInfoResponseSuccessful(gameOpenIdResponse);
  emitDiagnostic(
    onDiagnostic,
    `[后备1-game_openid参数] 结果: businessCode=${describeDiagnosticValue(gameOpenIdCode)}; area_id=${describeDiagnosticValue(gameOpenIdAreaId)}; success=${gameOpenIdSucceeded}`
  );

  if (gameOpenIdSucceeded) {
    emitDiagnostic(
      onDiagnostic,
      "[恢复结论] game_openid Cookie 参数请求成功，正式判定将采用本次响应"
    );
    return { response: gameOpenIdResponse, source: "game-openid-cookie" };
  }

  let checkLoginResponse = null;
  try {
    checkLoginResponse = await postJson(
      USER_CHECK_LOGIN_URL,
      {},
      (message) => emitDiagnostic(onDiagnostic, `[后备2-CheckLogin] ${message}`)
    );
  } catch (error) {
    emitDiagnostic(
      onDiagnostic,
      `[后备2-CheckLogin] 请求异常: ${sanitizeDiagnosticText(error?.message || error)}`
    );
  }

  const checkLoginCode = getApiBusinessCode(checkLoginResponse);
  const checkLoginSucceeded = isApiResponseSuccessful(checkLoginResponse);
  emitDiagnostic(
    onDiagnostic,
    `[后备2-CheckLogin] 结果: businessCode=${describeDiagnosticValue(checkLoginCode)}; success=${checkLoginSucceeded}`
  );

  let userInfoResponse = null;
  try {
    userInfoResponse = await postJson(
      USER_INFO_NEW_URL,
      {},
      (message) => emitDiagnostic(onDiagnostic, `[后备3-GetUserInfoNew] ${message}`)
    );
  } catch (error) {
    emitDiagnostic(
      onDiagnostic,
      `[后备3-GetUserInfoNew] 请求异常: ${sanitizeDiagnosticText(error?.message || error)}`
    );
  }

  const userInfoCode = getApiBusinessCode(userInfoResponse);
  const canonicalIntlOpenId = getCanonicalIntlOpenId(userInfoResponse);
  const userInfoSucceeded =
    isApiResponseSuccessful(userInfoResponse) && Boolean(canonicalIntlOpenId);
  emitDiagnostic(
    onDiagnostic,
    `[后备3-GetUserInfoNew] 结果: businessCode=${describeDiagnosticValue(userInfoCode)}; info=${userInfoResponse?.data?.info ? "present" : "missing"}; success=${userInfoSucceeded}`
  );
  emitDiagnostic(
    onDiagnostic,
    `[后备3-GetUserInfoNew] 标识关系: ${summarizeIntlOpenIdRelation(canonicalIntlOpenId, gameOpenId)}`
  );

  if (!canonicalIntlOpenId) {
    emitDiagnostic(
      onDiagnostic,
      `[恢复结论] 官网用户信息链路未取得正式 intl_openid；CheckLogin=${checkLoginSucceeded}; GetUserInfoNew=${userInfoSucceeded}`
    );
    return null;
  }

  let privacyResponse = null;
  try {
    privacyResponse = await postJson(
      USER_PRIVACY_SETTING_URL,
      { intl_openid: canonicalIntlOpenId },
      (message) => emitDiagnostic(onDiagnostic, `[后备4-正式intl_openid隐私] ${message}`)
    );
  } catch (error) {
    emitDiagnostic(
      onDiagnostic,
      `[后备4-正式intl_openid隐私] 请求异常: ${sanitizeDiagnosticText(error?.message || error)}`
    );
  }

  const privacyCode = getApiBusinessCode(privacyResponse);
  const privacySucceeded = isApiResponseSuccessful(privacyResponse);
  emitDiagnostic(
    onDiagnostic,
    `[后备4-正式intl_openid隐私] 结果: businessCode=${describeDiagnosticValue(privacyCode)}; success=${privacySucceeded}`
  );

  let canonicalPlayerInfoResponse = null;
  try {
    canonicalPlayerInfoResponse = await postJson(
      USER_GAME_PLAYER_INFO_URL,
      { intl_openid: canonicalIntlOpenId },
      (message) => emitDiagnostic(onDiagnostic, `[后备5-正式intl_openid玩家] ${message}`)
    );
  } catch (error) {
    emitDiagnostic(
      onDiagnostic,
      `[后备5-正式intl_openid玩家] 请求异常: ${sanitizeDiagnosticText(error?.message || error)}`
    );
  }

  const canonicalPlayerInfoCode = getApiBusinessCode(canonicalPlayerInfoResponse);
  const canonicalPlayerInfoAreaId = canonicalPlayerInfoResponse?.data?.area_id;
  const canonicalPlayerInfoSucceeded =
    isPlayerInfoResponseSuccessful(canonicalPlayerInfoResponse);
  emitDiagnostic(
    onDiagnostic,
    `[后备5-正式intl_openid玩家] 结果: businessCode=${describeDiagnosticValue(canonicalPlayerInfoCode)}; area_id=${describeDiagnosticValue(canonicalPlayerInfoAreaId)}; success=${canonicalPlayerInfoSucceeded}`
  );

  if (canonicalPlayerInfoSucceeded) {
    emitDiagnostic(
      onDiagnostic,
      `[恢复结论] 正式 intl_openid 玩家请求成功，正式判定将采用本次响应；privacy=${privacySucceeded}`
    );
    return {
      response: canonicalPlayerInfoResponse,
      source: "canonical-intl-openid",
    };
  }

  emitDiagnostic(
    onDiagnostic,
    `[恢复结论] 所有恢复路径均未取得有效玩家信息；CheckLogin=${checkLoginSucceeded}; privacy=${privacySucceeded}; playerBusinessCode=${describeDiagnosticValue(canonicalPlayerInfoCode)}`
  );
  return null;
};

// 获取最新昵称（优先 BasicInfo.nickname，回退旧 role_name）；不因空昵称判定 Cookie 失效
export const getRoleName = async (onDiagnostic) => {
  emitDiagnostic(onDiagnostic, "getRoleName 开始");
  const oldPromise = postJson(
    USER_GAME_PLAYER_INFO_URL,
    {},
    onDiagnostic
  ).catch(err => {
    emitDiagnostic(
      onDiagnostic,
      `GetUserGamePlayerInfo 请求失败并回退为空结果: ${sanitizeDiagnosticText(err?.message || err)}`
    );
    return { error: err };
  });

  let oldResp = await oldPromise;
  if (
    !oldResp.error &&
    String(getApiBusinessCode(oldResp)) === PLAYER_INFO_SYSTEM_ERROR_CODE
  ) {
    const recovery = await recoverPlayerInfoSystemError(onDiagnostic);
    if (recovery?.response) {
      oldResp = recovery.response;
      emitDiagnostic(
        onDiagnostic,
        `[恢复] 正式判定已切换到恢复响应: source=${recovery.source}`
      );
    } else {
      emitDiagnostic(
        onDiagnostic,
        "[恢复] 恢复未成功，正式判定继续使用首次原始响应"
      );
    }
  }

  const areaId = (!oldResp.error && (oldResp?.data?.area_id)) ? oldResp.data.area_id : "";
  const oldName = !oldResp.error ? (oldResp?.data?.role_name || "") : "";

  emitDiagnostic(
    onDiagnostic,
    `GetUserGamePlayerInfo 解析结果: area_id=${describeDiagnosticValue(areaId)}; role_name=${oldName ? "present" : "empty"}; requestError=${oldResp.error ? "yes" : "no"}`
  );

  if (areaId) {
    let intlOpenId = "";
    try {
      intlOpenId = await getIntlOpenId();
      emitDiagnostic(onDiagnostic, `game_openid Cookie: ${intlOpenId ? "present" : "empty"}`);
    } catch (error) {
      emitDiagnostic(
        onDiagnostic,
        `读取 game_openid Cookie 失败: ${sanitizeDiagnosticText(error?.message || error)}`
      );
      throw error;
    }
    const payload = { nikke_area_id: parseInt(areaId) };
    if (intlOpenId) payload.intl_open_id = intlOpenId;
    const basicResp = await postJson(
      "https://api.blablalink.com/api/game/proxy/Game/GetUserProfileBasicInfo",
      payload,
      onDiagnostic
    ).catch(err => {
      emitDiagnostic(
        onDiagnostic,
        `GetUserProfileBasicInfo 请求失败，保留旧接口结果: ${sanitizeDiagnosticText(err?.message || err)}`
      );
      return { error: err };
    });
    if (!basicResp.error) {
      const info = basicResp?.data?.basic_info || {};
      const finalName = info.nickname || oldName || "";
      const finalAreaId = info.area_id || areaId;
      emitDiagnostic(
        onDiagnostic,
        `getRoleName 完成: source=basic-or-old; area_id=${describeDiagnosticValue(finalAreaId)}; role_name=${finalName ? "present" : "empty"}`
      );
      return {
        role_name: finalName,
        area_id: finalAreaId
      };
    }
  }
  if (!oldResp.error) {
    emitDiagnostic(
      onDiagnostic,
      `getRoleName 完成: source=old; area_id=${describeDiagnosticValue(areaId)}; role_name=${oldName ? "present" : "empty"}`
    );
    return { role_name: oldName || "", area_id: areaId };
  }
  emitDiagnostic(onDiagnostic, "getRoleName 完成: source=request-error; area_id=empty-string; role_name=empty");
  return { role_name: "", area_id: areaId };
};

// 获取同步器等级：必须传入从 getRoleName 获得的 area_id
export const getSyncroLevel = (areaId) => {
  if (areaId === undefined || areaId === null || areaId === "") {
    return Promise.reject(new Error("缺少 areaId，需先调用 getRoleName 获取"));
  }
  return postJson(
    "https://api.blablalink.com/api/game/proxy/Game/GetUserProfileOutpostInfo",
    { nikke_area_id: parseInt(areaId) }
  )
    .then((j) => {
      const level = j?.data?.outpost_info?.synchro_level;
      return Number.isFinite(level) ? level : 0;
    })
    .catch((err) => {
      console.warn("获取同步器等级失败", err);
      return 0;
    });
};
// 获取前哨信息（同步器等级 + 前哨基地等级）
export const getOutpostInfo = (areaId) => {
  if (areaId === undefined || areaId === null || areaId === "") {
    return Promise.reject(new Error("缺少 areaId，需先调用 getRoleName 获取"));
  }
  return postJson(
    "https://api.blablalink.com/api/game/proxy/Game/GetUserProfileOutpostInfo",
    { nikke_area_id: parseInt(areaId) }
  )
    .then((j) => {
      const info = j?.data?.outpost_info || {};
      return {
        synchroLevel: Number.isFinite(info.synchro_level) ? info.synchro_level : 0,
        outpostLevel: Number.isFinite(info.outpost_battle_level) ? info.outpost_battle_level : 0,
      };
    })
    .catch((err) => {
      console.warn("获取前哨信息失败", err);
      return { synchroLevel: 0, outpostLevel: 0 };
    });
};

// ========== 主线目录：预抓取与映射 ==========
// 递归遍历对象，收集可能的关卡ID与名称
const buildStageMap = (root) => {
  const map = new Map();
  const visit = (node) => {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (typeof node === "object") {
      // 可能的ID字段
      const idCandidates = [
        node.id,
        node.stage_id,
        node.progress_id,
        node.campaign_id,
      ].filter((v) => typeof v === "number" || (typeof v === "string" && v.trim() !== ""));
      // 可能的名称字段
      let nameStr = undefined;
      if (typeof node.name_short === "string") nameStr = node.name_short;
      else if (typeof node.name === "string") nameStr = node.name;
      else if (typeof node.title === "string") nameStr = node.title;
      else if (node.name_localkey && typeof node.name_localkey === "object") {
        // 从本地化对象中任选一个字符串
        const vals = Object.values(node.name_localkey).filter((v) => typeof v === "string");
        if (vals.length) nameStr = vals[0];
      }
      if (nameStr && idCandidates.length) {
        idCandidates.forEach((idVal) => {
          const key = String(idVal);
          if (!map.has(key)) map.set(key, nameStr);
        });
      }
      // 继续遍历子字段
      Object.values(node).forEach(visit);
    }
  };
  visit(root);
  // 转换为普通对象，便于存储
  const obj = {};
  for (const [k, v] of map.entries()) obj[k] = v;
  return obj;
};

// 预抓取并缓存主线目录映射（id -> 名称字符串）
export const prefetchMainlineCatalog = async () => {
  try {
    const resp = await fetch(MAINLINE_CATALOG_URL, { credentials: "omit" });
    if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
    const data = await resp.json();
    const mapObj = buildStageMap(data);
    await new Promise((res) => chrome.storage.local.set({ [MAINLINE_CATALOG_MAP_KEY]: mapObj }, () => res()));
    return mapObj;
  } catch (e) {
    console.warn("预抓取主线目录失败:", e);
    // 尝试读取已有缓存
    const cached = await new Promise((res) => chrome.storage.local.get(MAINLINE_CATALOG_MAP_KEY, (r) => res(r[MAINLINE_CATALOG_MAP_KEY] || {})));
    return cached || {};
  }
};

export const getCachedMainlineCatalog = async () =>
  new Promise((res) =>
    chrome.storage.local.get(MAINLINE_CATALOG_MAP_KEY, (r) => res(r[MAINLINE_CATALOG_MAP_KEY] || {}))
  );

// 提取短格式：保留第一个空格之前的字符（如 "40-22B-1 STAGE" => "40-22B-1"）
const toShortStage = (name) => {
  if (!name || typeof name !== "string") return "";
  const s = name.trim();
  // 按空白分割，保留第一段
  const first = s.split(/\s+/)[0] || "";
  // 规范化连字符两侧空格（若存在）
  return first.replace(/\s*[-–]\s*/g, "-");
};

// 将进度ID映射为短名称（如 34-1）
export const mapStageIdToShortName = (catalogMapObj, stageId) => {
  if (!stageId && stageId !== 0) return "";
  const key = String(stageId);
  const name = catalogMapObj?.[key];
  if (typeof name === "string") return toShortStage(name) || name;
  return "";
};

// 获取账号主线进度（Normal/Hard），并映射为短名称
export const getCampaignProgress = async (areaId, catalogMapObj) => {
  if (!areaId) return { normal: "", hard: "" };
  const intlOpenId = await getIntlOpenId();
  try {
    const payload = { nikke_area_id: parseInt(areaId) };
    if (intlOpenId) payload.intl_open_id = intlOpenId;
    const resp = await postJson(
      "https://api.blablalink.com/api/game/proxy/Game/GetUserProfileBasicInfo",
      payload
    );
    const info = resp?.data?.basic_info || {};
    const normalId = info.progress_normal_campaign ?? info.progress_campaign_normal ?? info.progress_normal ?? 0;
    const hardId   = info.progress_hard_campaign   ?? info.progress_campaign_hard   ?? info.progress_hard   ?? 0;
    return {
      normal: mapStageIdToShortName(catalogMapObj || {}, normalId),
      hard: mapStageIdToShortName(catalogMapObj || {}, hardId),
    };
  } catch (e) {
    console.warn("获取主线进度失败:", e);
    return { normal: "", hard: "" };
  }
};

// 获取角色详情和装备信息（逐个获取以避免API错误）
export const getCharacterDetails = async (areaId, nameCodes) => {
  const intlOpenId = await getIntlOpenId();
  const allCharacterDetails = [];
  const allStateEffects = [];

  const uniqueCodes = Array.isArray(nameCodes)
    ? Array.from(new Set(nameCodes.filter((v) => v !== undefined && v !== null && v !== "")))
    : [];
  if (uniqueCodes.length === 0) return [];

  try {
    const response = await postJson(
      "https://api.blablalink.com/api/game/proxy/Game/GetUserCharacterDetails",
      {
        intl_open_id: intlOpenId,
        nikke_area_id: parseInt(areaId),
        name_codes: uniqueCodes
      }
    );

    if (response?.data?.character_details) {
      allCharacterDetails.push(...response.data.character_details);
    }
    if (response?.data?.state_effects) {
      allStateEffects.push(...response.data.state_effects);
    }
  } catch (error) {
    console.warn("获取角色详情失败:", error.message);
  }
  
  // 创建state_effects的映射表，便于查找
  const effectsMap = {};
  allStateEffects.forEach(effect => {
    effectsMap[effect.id] = effect;
  });
  
  return allCharacterDetails.map(char => {
    // 处理突破信息（新格式：grade + core）
    const limitBreak = {
      grade: char.grade || 0,
      core: char.core || 0
    };
    
    // 处理装备词条
    const equipments = {};
    const equipSlots = ['head', 'torso', 'arm', 'leg'];
    
    equipSlots.forEach((slot, idx) => {
      const details = [];
      for (let i = 1; i <= 3; i++) {
        const optionKey = `${slot}_equip_option${i}_id`;
        const optionId = char[optionKey];
        if (optionId && optionId !== 0) {
          const effect = effectsMap[optionId.toString()];
          if (effect && effect.function_details) {
            effect.function_details.forEach(func => {
              details.push({
                function_type: func.function_type,
                function_value: Math.abs(func.function_value) / 100,
                level: func.level,
              });
            });
          }
        }
      }
      equipments[idx] = details;
    });
    
    return {
      name_code: char.name_code,
      lv: char.lv || 1,
      skill1_lv: char.skill1_lv || 1,
      skill2_lv: char.skill2_lv || 1,
      ulti_skill_lv: char.ulti_skill_lv || 1,
      favorite_item_lv: char.favorite_item_lv || 0,
      favorite_item_tid: char.favorite_item_tid || 0,
      combat: char.combat || 0,
      limitBreak: limitBreak,
      equipments: equipments,
      // 魔方信息
      cube_id: char.harmony_cube_tid || 0,
      cube_level: char.harmony_cube_lv || 0
    };
  });
};

// 获取用户所有角色的基础信息（包含core和grade）
export const getUserCharacters = async (areaId) => {
  const intlOpenId = await getIntlOpenId();
  
  try {
    const response = await postJson(
      "https://api.blablalink.com/api/game/proxy/Game/GetUserCharacters",
      {
        intl_open_id: intlOpenId,
        nikke_area_id: parseInt(areaId)
      }
    );
    
    if (response?.data?.characters) {
      return response.data.characters.map(char => ({
        name_code: char.name_code,
        lv: char.lv || 1,
        combat: char.combat || 0,
        core: char.core || 0,
        grade: char.grade || 0,
        costume_id: char.costume_id || 0
      }));
    }
    
    return [];
  } catch (error) {
    console.error("获取用户角色列表失败:", error);
    throw error;
  }
};

/* ========== 并发模式专用 API（使用账号标识隔离请求） ========== */

/**
 * 从账号 Cookie 字符串中解析指定 cookie 值
 * @param {string} cookieStr - Cookie 字符串
 * @param {string} name - Cookie 名称
 * @returns {string|null}
 */
const parseCookieValue = (cookieStr, name) => {
  if (!cookieStr) return null;
  const match = cookieStr.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? match[1] : null;
};

/**
 * 验证账号 Cookie 登录态是否有效（并发模式）。
 * 玩家信息接口不可用时使用 CheckLogin 区分“Cookie 失效”和“角色信息暂不可用”。
 * @param {{game_uid: string, cookie: string}} account - 账号对象
 * @returns {Promise<{
 *   valid: boolean,
 *   roleReady?: boolean,
 *   roleInfo?: {role_name: string, area_id: string},
 *   error?: string
 * }>}
 */
export const validateCookieWithAccount = async (account, onDiagnostic) => {
  const cookieNames = String(account.cookie || "")
    .split(/;\s*/)
    .map((entry) => entry.split("=")[0]?.trim())
    .filter(Boolean);
  emitDiagnostic(
    onDiagnostic,
    `保存Cookie检查: cookie=${account.cookie ? "present" : "empty"}; game_uid=${account.game_uid ? "present" : "empty"}; cookieCount=${cookieNames.length}; cookieNames=[${[...new Set(cookieNames)].sort().join(",")}]`
  );

  if (!account.cookie) {
    emitDiagnostic(onDiagnostic, "保存Cookie验证结束: invalid; reason=无 Cookie");
    return { valid: false, error: "无 Cookie" };
  }

  if (!account.game_uid) {
    emitDiagnostic(onDiagnostic, "保存Cookie验证结束: invalid; reason=缺少 game_uid");
    return { valid: false, error: "缺少 game_uid" };
  }

  let playerInfoResponse = null;
  let playerInfoError = null;
  try {
    playerInfoResponse = await postJsonWithAccount(
      USER_GAME_PLAYER_INFO_URL,
      {},
      account.game_uid,
      onDiagnostic
    );
  } catch (error) {
    playerInfoError = error;
    emitDiagnostic(
      onDiagnostic,
      `保存Cookie玩家信息请求异常，将使用 CheckLogin 判断登录态: ${sanitizeDiagnosticText(error?.message || error)}`
    );
  }

  const areaId = playerInfoResponse?.data?.area_id;
  const roleName = playerInfoResponse?.data?.role_name || "";
  const playerInfoCode = getApiBusinessCode(playerInfoResponse);
  emitDiagnostic(
    onDiagnostic,
    `保存Cookie玩家信息解析: businessCode=${describeDiagnosticValue(playerInfoCode)}; area_id=${describeDiagnosticValue(areaId)}; role_name=${roleName ? "present" : "empty"}`
  );

  if (areaId) {
    // 尝试获取更详细的信息
    const intlOpenId = parseCookieValue(account.cookie, "game_openid") || "";
    const payload = { nikke_area_id: parseInt(areaId) };
    if (intlOpenId) payload.intl_open_id = intlOpenId;
    
    const basicResp = await postJsonWithAccount(
      "https://api.blablalink.com/api/game/proxy/Game/GetUserProfileBasicInfo",
      payload,
      account.game_uid,
      onDiagnostic
    ).catch((error) => {
      emitDiagnostic(
        onDiagnostic,
        `保存Cookie BasicInfo 请求失败但不影响有效性: ${sanitizeDiagnosticText(error?.message || error)}`
      );
      return null;
    });
    
    const finalName = basicResp?.data?.basic_info?.nickname || roleName || "";
    emitDiagnostic(
      onDiagnostic,
      `保存Cookie验证结束: valid; area_id=${describeDiagnosticValue(areaId)}; role_name=${finalName ? "present" : "empty"}`
    );
    
    return {
      valid: true,
      roleReady: true,
      roleInfo: {
        role_name: finalName,
        area_id: String(areaId)
      }
    };
  }

  emitDiagnostic(
    onDiagnostic,
    "保存Cookie未取得 area_id，改用 CheckLogin 验证 Cookie 登录态"
  );

  let checkLoginResponse = null;
  let checkLoginError = null;
  try {
    checkLoginResponse = await postJsonWithAccount(
      USER_CHECK_LOGIN_URL,
      {},
      account.game_uid,
      (message) => emitDiagnostic(onDiagnostic, `[登录态后备-CheckLogin] ${message}`)
    );
  } catch (error) {
    checkLoginError = error;
    emitDiagnostic(
      onDiagnostic,
      `[登录态后备-CheckLogin] 请求异常: ${sanitizeDiagnosticText(error?.message || error)}`
    );
  }

  const checkLoginCode = getApiBusinessCode(checkLoginResponse);
  const authenticated = isApiResponseSuccessful(checkLoginResponse);
  emitDiagnostic(
    onDiagnostic,
    `[登录态后备-CheckLogin] 判定: businessCode=${describeDiagnosticValue(checkLoginCode)}; authenticated=${authenticated}`
  );

  if (authenticated) {
    emitDiagnostic(
      onDiagnostic,
      `保存Cookie验证结束: authenticated; roleReady=false; playerBusinessCode=${describeDiagnosticValue(playerInfoCode)}`
    );
    return {
      valid: true,
      roleReady: false,
      roleInfo: {
        role_name: roleName,
        area_id: ""
      }
    };
  }

  const errorMessage =
    checkLoginError?.message ||
    (checkLoginCode !== undefined && checkLoginCode !== null
      ? `CheckLogin 失败 (${checkLoginCode})`
      : playerInfoError?.message || "Cookie 登录态验证失败");
  emitDiagnostic(
    onDiagnostic,
    `保存Cookie验证结束: invalid; reason=${sanitizeDiagnosticText(errorMessage)}`
  );
  return { valid: false, error: errorMessage };
};

/**
 * 获取前哨信息（并发模式）
 * @param {{game_uid: string, cookie: string}} account - 账号对象
 * @param {string} areaId - 区域 ID
 * @returns {Promise<{synchroLevel: number, outpostLevel: number}>}
 */
export const getOutpostInfoWithAccount = async (account, areaId) => {
  if (!areaId) return { synchroLevel: 0, outpostLevel: 0 };
  
  try {
    const resp = await postJsonWithAccount(
      "https://api.blablalink.com/api/game/proxy/Game/GetUserProfileOutpostInfo",
      { nikke_area_id: parseInt(areaId) },
      account.game_uid
    );
    const info = resp?.data?.outpost_info || {};
    return {
      synchroLevel: Number.isFinite(info.synchro_level) ? info.synchro_level : 0,
      outpostLevel: Number.isFinite(info.outpost_battle_level) ? info.outpost_battle_level : 0,
    };
  } catch (error) {
    console.warn("获取前哨信息失败:", error);
    return { synchroLevel: 0, outpostLevel: 0 };
  }
};

/**
 * 获取主线进度（并发模式）
 * @param {{game_uid: string, cookie: string}} account - 账号对象
 * @param {string} areaId - 区域 ID
 * @param {object} catalogMapObj - 主线目录映射
 * @returns {Promise<{normal: string, hard: string}>}
 */
export const getCampaignProgressWithAccount = async (account, areaId, catalogMapObj) => {
  if (!areaId) return { normal: "", hard: "" };
  
  const intlOpenId = parseCookieValue(account.cookie, "game_openid") || "";
  
  try {
    const payload = { nikke_area_id: parseInt(areaId) };
    if (intlOpenId) payload.intl_open_id = intlOpenId;
    
    const resp = await postJsonWithAccount(
      "https://api.blablalink.com/api/game/proxy/Game/GetUserProfileBasicInfo",
      payload,
      account.game_uid
    );
    
    const info = resp?.data?.basic_info || {};
    const normalId = info.progress_normal_campaign ?? info.progress_campaign_normal ?? info.progress_normal ?? 0;
    const hardId = info.progress_hard_campaign ?? info.progress_campaign_hard ?? info.progress_hard ?? 0;
    
    return {
      normal: mapStageIdToShortName(catalogMapObj || {}, normalId),
      hard: mapStageIdToShortName(catalogMapObj || {}, hardId),
    };
  } catch (error) {
    console.warn("获取主线进度失败:", error);
    return { normal: "", hard: "" };
  }
};

/**
 * 获取用户角色列表（并发模式）
 * @param {{game_uid: string, cookie: string}} account - 账号对象
 * @param {string} areaId - 区域 ID
 * @returns {Promise<Array>}
 */
export const getUserCharactersWithAccount = async (account, areaId) => {
  const intlOpenId = parseCookieValue(account.cookie, "game_openid") || "";
  
  try {
    const resp = await postJsonWithAccount(
      "https://api.blablalink.com/api/game/proxy/Game/GetUserCharacters",
      {
        intl_open_id: intlOpenId,
        nikke_area_id: parseInt(areaId)
      },
      account.game_uid
    );
    
    if (resp?.data?.characters) {
      return resp.data.characters.map(char => ({
        name_code: char.name_code,
        lv: char.lv || 1,
        combat: char.combat || 0,
        core: char.core || 0,
        grade: char.grade || 0,
        costume_id: char.costume_id || 0
      }));
    }
    return [];
  } catch (error) {
    console.error("获取用户角色列表失败:", error);
    throw error;
  }
};

/**
 * 获取角色详情（并发模式）
 * @param {{game_uid: string, cookie: string}} account - 账号对象
 * @param {string} areaId - 区域 ID
 * @param {Array<string>} nameCodes - 角色 name_code 列表
 * @returns {Promise<Array>}
 */
export const getCharacterDetailsWithAccount = async (account, areaId, nameCodes) => {
  const intlOpenId = parseCookieValue(account.cookie, "game_openid") || "";
  const allCharacterDetails = [];
  const allStateEffects = [];

  const uniqueCodes = Array.isArray(nameCodes)
    ? Array.from(new Set(nameCodes.filter((v) => v !== undefined && v !== null && v !== "")))
    : [];
  if (uniqueCodes.length === 0) return [];

  try {
    const response = await postJsonWithAccount(
      "https://api.blablalink.com/api/game/proxy/Game/GetUserCharacterDetails",
      {
        intl_open_id: intlOpenId,
        nikke_area_id: parseInt(areaId),
        name_codes: uniqueCodes
      },
      account.game_uid
    );

    if (response?.data?.character_details) {
      allCharacterDetails.push(...response.data.character_details);
    }
    if (response?.data?.state_effects) {
      allStateEffects.push(...response.data.state_effects);
    }
  } catch (error) {
    console.warn("获取角色详情失败:", error.message);
  }
  
  // 创建state_effects的映射表，便于查找
  const effectsMap = {};
  allStateEffects.forEach(effect => {
    effectsMap[effect.id] = effect;
  });
  
  return allCharacterDetails.map(char => {
    const limitBreak = {
      grade: char.grade || 0,
      core: char.core || 0
    };
    
    const equipments = {};
    const equipSlots = ['head', 'torso', 'arm', 'leg'];
    
    equipSlots.forEach((slot, idx) => {
      const details = [];
      for (let i = 1; i <= 3; i++) {
        const optionKey = `${slot}_equip_option${i}_id`;
        const optionId = char[optionKey];
        if (optionId && optionId !== 0) {
          const effect = effectsMap[optionId.toString()];
          if (effect && effect.function_details) {
            effect.function_details.forEach(func => {
              details.push({
                function_type: func.function_type,
                function_value: Math.abs(func.function_value) / 100,
                level: func.level,
              });
            });
          }
        }
      }
      equipments[idx] = details;
    });
    
    return {
      name_code: char.name_code,
      lv: char.lv || 1,
      skill1_lv: char.skill1_lv || 1,
      skill2_lv: char.skill2_lv || 1,
      ulti_skill_lv: char.ulti_skill_lv || 1,
      favorite_item_lv: char.favorite_item_lv || 0,
      favorite_item_tid: char.favorite_item_tid || 0,
      combat: char.combat || 0,
      limitBreak: limitBreak,
      equipments: equipments,
      cube_id: char.harmony_cube_tid || 0,
      cube_level: char.harmony_cube_lv || 0
    };
  });
};

// 保持兼容性的旧接口（已废弃，但保留以防其他地方调用）
export const getPlayerNikkes = () => {
  console.warn("getPlayerNikkes 接口已废弃，请使用 getCharacterDetails");
  return Promise.resolve({ data: { nikkes: [] } });
};

export const getEquipments = () => {
  console.warn("getEquipments 接口已废弃，请使用 getCharacterDetails");
  return Promise.resolve({});
};

/* ========== 人物目录获取与缓存（管理页打开时自动执行） ========== */
const NIKKE_DIR_CACHE_KEY = "nikkeDirectory";

// 远端目录地址（繁中与英文）
const NIKKE_TW_URL = 'https://sg-tools-cdn.blablalink.com/jz-26/ww-14/c4619ec83335bcfd7b23e43600520dc7.json';
const NIKKE_EN_URL = 'https://sg-tools-cdn.blablalink.com/yl-57/hd-03/1bf030193826e243c2e195f951a4be00.json';

const oc = OpenCCConverter({ from: 'tw', to: 'cn' });

const convertToSimplified = (data) => {
  if (Array.isArray(data)) return data.map(convertToSimplified);
  if (data && typeof data === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(data)) out[k] = convertToSimplified(v);
    return out;
  }
  if (typeof data === 'string') return oc(data);
  return data;
};

export const fetchAndCacheNikkeDirectory = async () => {
  try {
    const [twResp, enResp] = await Promise.all([
      fetch(NIKKE_TW_URL),
      fetch(NIKKE_EN_URL),
    ]);
    if (!twResp.ok || !enResp.ok) throw new Error('fetch nikke directory failed');
    const [twDataRaw, enData] = await Promise.all([twResp.json(), enResp.json()]);
    const twData = convertToSimplified(twDataRaw);
    const enMap = new Map(enData.map((e) => [e.id, e]));

    const nikkes = [];
    for (const tw of twData) {
      const en = enMap.get(tw.id);
      if (!en) continue; // 跳过没有英文条目的 id
      nikkes.push({
        id: tw.id,
        resource_id: tw.resource_id,
        name_code: tw.name_code,
        class: tw.class,
        name_cn: tw?.name_localkey?.name,
        name_en: en?.name_localkey?.name,
        element: tw?.element_id?.element?.element,
        use_burst_skill: tw?.use_burst_skill,
        corporation: tw?.corporation,
        weapon_type: tw?.shot_id?.element?.weapon_type,
        original_rare: tw?.original_rare,
      });
    }

    await new Promise((res) => chrome.storage.local.set({ [NIKKE_DIR_CACHE_KEY]: nikkes }, res));
    return nikkes;
  } catch (e) {
    console.warn('获取人物目录失败:', e);
    // 回退读取缓存
    const cached = await new Promise((res) => chrome.storage.local.get(NIKKE_DIR_CACHE_KEY, (r) => res(r[NIKKE_DIR_CACHE_KEY] || [])));
    return cached || [];
  }
};

export const getCachedNikkeDirectory = async () =>
  new Promise((res) => chrome.storage.local.get(NIKKE_DIR_CACHE_KEY, (r) => res(r[NIKKE_DIR_CACHE_KEY] || [])));
