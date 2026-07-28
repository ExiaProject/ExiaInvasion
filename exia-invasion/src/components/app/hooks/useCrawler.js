// SPDX-License-Identifier: GPL-3.0-or-later
// ========== 数据爬取 Hook ==========

import { useState, useCallback } from "react";
import JSZip from "jszip";
import saveDictToExcel from "../../../utils/excel.js";
import { computeAELForDict } from "../../../utils/ael.js";
import { createUniqueExportFileName } from "../../../utils/exportFilenames.js";
import { getAccounts, setAccounts, getCharacters } from "../../../services/storage.js";
import { applyCookieStr, clearSiteCookies, getCurrentCookies } from "../../../services/cookie.js";
import { loadBaseAccountDict, getRoleName, prefetchMainlineCatalog, validateCookieWithAccount, getOutpostInfoWithAccount, getCampaignProgressWithAccount, getUserCharactersWithAccount, getCharacterDetailsWithAccount } from "../../../services/api.js";
import { registerCookieRules, unregisterAllRules } from "../../../services/requestInterceptor.js";
import { parseGameUidFromCookie, cookieArrToStr } from "../utils.js";
import { BATCH_SIZE, STAGGER_DELAY } from "../constants.js";

const AUTO_SAVE_DATA = true;
const REQUIRED_LOGIN_COOKIE_NAMES = ["game_token", "game_uid", "game_openid"];

const emitCrawlerDiagnostic = (onDiagnostic, message) => {
  if (typeof onDiagnostic !== "function") return;
  try {
    onDiagnostic(message);
  } catch {
    // 诊断日志不能影响登录流程
  }
};

const maskDiagnosticText = (value) => {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.length <= 2) return `${text.slice(0, 1)}*`;
  return `${text.slice(0, 2)}***${text.slice(-2)}`;
};

const getAccountDiagnosticLabel = (account) => {
  const gameUid = String(account?.game_uid || account?.gameUid || "").trim();
  if (gameUid) return `uid:***${gameUid.slice(-4)}`;

  const email = String(account?.email || "").trim();
  if (email) {
    const [localPart, domain] = email.split("@");
    return `email:${localPart?.slice(0, 1) || "*"}***${domain ? `@${domain}` : ""}`;
  }

  const displayName = account?.username || account?.name;
  return displayName ? `name:${maskDiagnosticText(displayName)}` : "unknown-account";
};

const sanitizeCookieName = (name) => {
  const text = String(name || "");
  if (/^__ss_storage_cookie_cache_/.test(text)) return "__ss_storage_cookie_cache_*";
  return text.length > 48 ? `${text.slice(0, 40)}…` : text;
};

const summarizeBrowserCookies = (cookies) => {
  const relevantCookies = (cookies || []).filter((cookie) =>
    String(cookie?.domain || "").endsWith("blablalink.com")
  );
  const requiredSummary = REQUIRED_LOGIN_COOKIE_NAMES.map((name) => {
    const matches = relevantCookies.filter((cookie) => cookie.name === name);
    if (matches.length === 0) return `${name}=missing`;
    const metadata = matches
      .map((cookie) => `${cookie.domain}${cookie.path};sameSite=${cookie.sameSite || "unspecified"}`)
      .join("|");
    return `${name}=present(${metadata})`;
  });
  const cookieNames = [...new Set(relevantCookies.map((cookie) => sanitizeCookieName(cookie.name)))]
    .sort();

  return `Cookie快照: total=${relevantCookies.length}; ${requiredSummary.join("; ")}; names=[${cookieNames.join(",")}]`;
};

const createAccountDiagnosticLogger = (addLog, account, scope) => {
  const accountLabel = getAccountDiagnosticLabel(account);
  return (message) => {
    const timestamp = new Date().toISOString().slice(11, 23);
    const line = `[诊断 ${timestamp}][${accountLabel}][${scope}] ${message}`;
    console.debug(line);
    addLog(line);
  };
};

const getDistinctBatchAreaIds = (accounts) => {
  return [...new Set(
    (accounts || [])
      .map((account) => String(account?.roleInfo?.area_id || "").trim())
      .filter(Boolean)
  )];
};

const getSharedBatchAreaId = (accounts) => {
  const areaIds = getDistinctBatchAreaIds(accounts);
  return areaIds.length === 1 ? areaIds[0] : "";
};

/**
 * 数据爬取 Hook
 * @param {Object} options
 * @param {Function} options.t - 翻译函数
 * @param {string} options.lang - 语言
 * @param {boolean} options.saveAsZip - 是否保存为 ZIP
 * @param {boolean} options.exportJson - 是否导出 JSON
 * @param {boolean} options.activateTab - 是否激活标签页
 * @param {string} options.server - 服务器
 */
export function useCrawler({ t, lang, saveAsZip, exportJson, activateTab, server }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cookieLoading, setCookieLoading] = useState(false);

  const addLog = useCallback((msg) => setLogs((prev) => [...prev, msg]), []);
  const clearLogs = useCallback(() => setLogs([]), []);

  // ========== Cookie 保存功能 ==========
  const handleSaveCookie = useCallback(async () => {
    chrome.cookies.getAll({ url: "https://www.blablalink.com" }, async (cookies) => {
      console.log(cookies);
      const token = cookies.find((c) => c.name === "game_token");
      if (!token) {
        addLog(t("notLogin"));
        return;
      }
      
      // 自动获取用户名
      let autoUsername = "";
      try {
        const roleInfo = await getRoleName();
        autoUsername = roleInfo.role_name || "";
        addLog(`${t("autoGetUsername")}: ${autoUsername}`);
      } catch (error) {
        console.warn("自动获取用户名失败:", error);
        addLog(t("autoGetUsernameFail"));
        autoUsername = t("noName");
      }
      
      const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
      
      // 提取game_uid
      const gameUidCookie = cookies.find(c => c.name === "game_uid");
      const gameUid = gameUidCookie ? gameUidCookie.value : "";
      
      const accounts = await getAccounts();
      
      // 检查是否已存在相同email/game_uid或cookie的账号
      let existingIndex = -1;
      const emailLike = autoUsername && autoUsername.includes("@") ? autoUsername : "";
      if (emailLike) {
        existingIndex = accounts.findIndex(acc => acc.email === emailLike);
      }
      if (gameUid) {
        // 优先按game_uid查找
        if (existingIndex === -1) {
          existingIndex = accounts.findIndex(acc => acc.game_uid === gameUid);
        }
      }
      if (existingIndex === -1) {
        // 如果没有game_uid或找不到，则按cookie查找
        existingIndex = accounts.findIndex(acc => acc.cookie === cookieStr);
      }
      
      const now = Date.now();
      if (existingIndex !== -1) {
        // 更新现有账号
        accounts[existingIndex].cookie = cookieStr;
        accounts[existingIndex].cookieUpdatedAt = now;
        if (autoUsername) accounts[existingIndex].username = autoUsername;
        if (gameUid) accounts[existingIndex].game_uid = gameUid;
        addLog(`${t("accountUpdated")}: ${autoUsername}`);
      } else {
        // 添加新账号
        accounts.push({
          username: autoUsername,
          email: "",
          password: "",
          cookie: cookieStr,
          cookieUpdatedAt: now,
          game_uid: gameUid,
          enabled: true,
        });
        addLog(`${t("accountSaved")}: ${autoUsername}`);
      }
      
      await setAccounts(accounts);
    });
  }, [t, addLog]);

  // ========== 登录并获取 Cookie ==========
  const loginAndGetCookie = useCallback(async (acc, serverFlag, onDiagnostic) => {
    const LOGIN_COOKIE_TIMEOUT_MS = 20000;
    const LOGIN_COOKIE_MAX_ATTEMPTS = 2;
    const loginStartedAt = Date.now();

    const waitForCookie = (attemptStartedAt) => new Promise((resolve, reject) => {
      const onChanged = (chg) => {
        const c = chg.cookie;
        if (
          !chg.removed &&
          c.domain.endsWith("blablalink.com") &&
          c.name === "game_token"
        ) {
          cleanup();
          const event = {
            domain: c.domain,
            path: c.path,
            sameSite: c.sameSite || "unspecified",
            elapsedMs: Date.now() - attemptStartedAt,
          };
          emitCrawlerDiagnostic(
            onDiagnostic,
            `检测到 game_token 写入事件: domain=${event.domain}; path=${event.path}; sameSite=${event.sameSite}; attemptElapsed=${event.elapsedMs}ms`
          );
          resolve(event);
        }
      };
      const cleanup = () => {
        chrome.cookies.onChanged.removeListener(onChanged);
        if (timeoutId) clearTimeout(timeoutId);
      };
      const timeoutId = setTimeout(() => {
        cleanup();
        emitCrawlerDiagnostic(
          onDiagnostic,
          `等待 game_token 超时: timeout=${LOGIN_COOKIE_TIMEOUT_MS}ms`
        );
        reject(new Error("COOKIE_TIMEOUT"));
      }, LOGIN_COOKIE_TIMEOUT_MS);
      chrome.cookies.onChanged.addListener(onChanged);
    });

    for (let attempt = 1; attempt <= LOGIN_COOKIE_MAX_ATTEMPTS; attempt += 1) {
      const attemptStartedAt = Date.now();
      emitCrawlerDiagnostic(
        onDiagnostic,
        `登录尝试开始: attempt=${attempt}/${LOGIN_COOKIE_MAX_ATTEMPTS}; server=${serverFlag}; activateTab=${activateTab}`
      );
      addLog(t("getCookie"));
      let tab;
      try {
        tab = await chrome.tabs.create({
          url: "https://www.blablalink.com/login",
          active: activateTab,
        });
        emitCrawlerDiagnostic(onDiagnostic, `登录标签页已创建: tabId=${tab.id}`);
        
        await new Promise((resolve) => {
          const listener = (id, info) => {
            if (id === tab.id && info.status === "complete") {
              chrome.tabs.onUpdated.removeListener(listener);
              resolve();
            }
          };
          chrome.tabs.onUpdated.addListener(listener);
        });
        emitCrawlerDiagnostic(
          onDiagnostic,
          `登录页加载完成: attemptElapsed=${Date.now() - attemptStartedAt}ms`
        );
        
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (loginInfo) => {
            const { email, password, server } = loginInfo;
            const click = (sel) => document.querySelector(sel)?.click();
            const clickXPath = (xpath) => {
              const node = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
              if (node) node.click();
            };
            click("#onetrust-accept-btn-handler");
            const waitFor = (sel, timeout = 5000) =>
              new Promise((res) => {
                const st = Date.now();
                const timer = setInterval(() => {
                  if (document.querySelector(sel)) {
                    clearInterval(timer);
                    res(true);
                  } else if (Date.now() - st > timeout) {
                    clearInterval(timer);
                    res(false);
                  }
                }, 100);
              });
            (async () => {
              // 等待网页自身的初始逻辑（如有自动弹窗）稳定下来，避免竞争冲突致使弹窗被秒关
              await new Promise(r => setTimeout(r, 1000));
              
              const targetXPath = server === "hmt" 
                ? '//li[.//div[contains(text(), "HK/MC/TW")]]' 
                : '//li[.//div[contains(text(), "JP/KR/NA/SEA/Global")]]';
              const dropdownXPath = '//div[contains(@class, "common-btns") and .//span[text()="Select Region"]]';
              
              const isVisible = (xp) => {
                const node = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                return node && !!node.offsetParent;
              };
              
              // 如果此后选项依然不可见，说明需要手动点开
              if (!isVisible(targetXPath)) {
                clickXPath(dropdownXPath);
                await new Promise(r => setTimeout(r, 1000)); // 等待展开动画
              }
              
              clickXPath(targetXPath);
              
              // 等待地区切换触发的重新渲染
              await new Promise(r => setTimeout(r, 1000));

              let ok = await waitFor("#loginPwdForm_account", 2000);
              if (!ok) click(".pass-switchLogin__oper");
              await waitFor("#loginPwdForm_account", 5000);
              
              const setVal = (sel, val) => {
                const el = document.querySelector(sel);
                if (el) {
                  el.value = val;
                  el.dispatchEvent(new Event("input", { bubbles: true }));
                }
              };
              setVal("#loginPwdForm_account", email);
              setVal("#loginPwdForm_password", password);
              click('#loginPwdForm button[type="submit"]');
            })();
          },
          args: [{ email: acc.email, password: acc.password, server: serverFlag }],
        });
        emitCrawlerDiagnostic(
          onDiagnostic,
          `登录脚本已注入，等待 game_token: attemptElapsed=${Date.now() - attemptStartedAt}ms`
        );
        
        const tokenEvent = await waitForCookie(attemptStartedAt);
        if (tab?.id) chrome.tabs.remove(tab.id);
        emitCrawlerDiagnostic(
          onDiagnostic,
          `loginAndGetCookie 返回: attempt=${attempt}; totalElapsed=${Date.now() - loginStartedAt}ms`
        );
        return {
          attempt,
          tokenEvent,
          totalElapsedMs: Date.now() - loginStartedAt,
        };
      } catch (err) {
        if (tab?.id) chrome.tabs.remove(tab.id);
        emitCrawlerDiagnostic(
          onDiagnostic,
          `登录尝试异常: attempt=${attempt}; error=${err?.message || err}; attemptElapsed=${Date.now() - attemptStartedAt}ms`
        );
        if (attempt < LOGIN_COOKIE_MAX_ATTEMPTS) {
          addLog(`登录超时，重试 ${attempt + 1}/${LOGIN_COOKIE_MAX_ATTEMPTS}`);
          continue;
        }
        throw err;
      }
    }
  }, [t, activateTab, addLog]);

  // ========== 填充角色详情 ==========
  const addCharacterDetailsToDictWithAccount = useCallback(async (dict, account) => {
    const allNameCodes = [];
    Object.values(dict.elements).forEach(characterArray => {
      characterArray.forEach(details => {
        if (details.name_code !== undefined && details.name_code !== null && details.name_code !== "") {
          allNameCodes.push(details.name_code);
        }
      });
    });
    const uniqueNameCodes = Array.from(new Set(allNameCodes));
    if (uniqueNameCodes.length === 0) return;
    
    try {
      const userCharacters = await getUserCharactersWithAccount(account, account.roleInfo.area_id);
      
      const userCharMap = {};
      userCharacters.forEach(char => {
        userCharMap[char.name_code] = char;
      });
      const ownedSet = new Set(userCharacters.map(char => char.name_code));
      const filteredNameCodes = uniqueNameCodes.filter(code => ownedSet.has(code));
      if (filteredNameCodes.length === 0) return;

      const characterDetails = await getCharacterDetailsWithAccount(account, account.roleInfo.area_id, filteredNameCodes);
      
      const detailsMap = {};
      characterDetails.forEach(detail => {
        detailsMap[detail.name_code] = detail;
      });
      
      Object.keys(dict.elements).forEach(elementKey => {
        const characterArray = dict.elements[elementKey];
        characterArray.forEach(details => {
          const charDetail = detailsMap[details.name_code];
          if (charDetail) {
            details.skill1_level = charDetail.skill1_lv;
            details.skill2_level = charDetail.skill2_lv;
            details.skill_burst_level = charDetail.ulti_skill_lv;
            details.item_level = charDetail.favorite_item_lv >= 0 ? charDetail.favorite_item_lv : "";
            
            if (charDetail.favorite_item_tid) {
              const tidStr = charDetail.favorite_item_tid.toString();
              const firstDigit = parseInt(tidStr.charAt(0));
              const lastDigit = parseInt(tidStr.charAt(tidStr.length - 1));
              
              if (firstDigit === 2) {
                details.item_rare = "SSR";
              } else if (firstDigit === 1) {
                details.item_rare = lastDigit === 1 ? "R" : lastDigit === 2 ? "SR" : "";
              } else {
                details.item_rare = "";
              }
            } else {
              details.item_rare = "";
            }
            
            const userChar = userCharMap[details.name_code];
            if (userChar) {
              details.limit_break = { grade: userChar.grade, core: userChar.core };
            } else if (charDetail) {
              details.limit_break = { grade: charDetail.limitBreak?.grade || 0, core: charDetail.limitBreak?.core || 0 };
            } else {
              details.limit_break = { grade: 0, core: 0 };
            }
            
            details.equipments = charDetail.equipments;
            
            if (charDetail.cube_id && charDetail.cube_level) {
              const cube = dict.cubes.find(c => c.cube_id === charDetail.cube_id);
              if (cube && charDetail.cube_level > cube.cube_level) {
                cube.cube_level = charDetail.cube_level;
              }
            }
          }
        });
      });
    } catch (error) {
      console.error("获取角色详情失败:", error);
      throw error;
    }
  }, []);

  // ========== 数据爬取主流程 ==========
  const handleStart = useCallback(async ({ onlyCookie = false } = {}) => {
    clearLogs();
    if (onlyCookie) {
      setCookieLoading(true);
    } else {
      setLoading(true);
    }

    const shouldExportExcel = true;
    const shouldExportJson = exportJson;
    const shouldZip = saveAsZip && (shouldExportExcel || shouldExportJson);
    
    // 保存当前的cookie，以便运行完成后恢复
    let originalCookies = "";
    
    try {
      // 保存原始cookie
      originalCookies = await getCurrentCookies();
      
      // ========== 步骤0: 检查妮姬列表配置 ==========
      if (!onlyCookie) {
        const characters = await getCharacters();
        const allElementsEmpty = Object.values(characters.elements || {}).every(
          elementArray => !elementArray || elementArray.length === 0
        );
        
        if (allElementsEmpty) {
          addLog(t("emptyNikkeList"));
          addLog(t("pleaseAddNikkes"));
          return;
        }
      }
      
      // ========== 步骤1: 读取账号列表 ==========
      const accountsAll = await getAccounts();
      const normalizedAccounts = accountsAll.map((acc) => ({
        ...acc,
        game_uid: acc.game_uid || parseGameUidFromCookie(acc.cookie) || "",
      }));
      if (JSON.stringify(normalizedAccounts) !== JSON.stringify(accountsAll)) {
        await setAccounts(normalizedAccounts);
      }
      let accounts = normalizedAccounts.filter((a) => a.enabled !== false);
      if (onlyCookie) {
        accounts = accounts.filter((a) => a.enabled !== false);
      }
      if (!accounts.length) {
        addLog(t("emptyAccounts"));
        return;
      }
      
      addLog(t("starting"));
      addLog(`共 ${accounts.length} 个账号，开始并发验证...`);
      
      // 预抓取主线目录（仅执行一次）
      let catalogMap = {};
      try {
        catalogMap = await prefetchMainlineCatalog();
      } catch (e) {
        console.warn("预抓取主线目录失败", e);
      }

      const zip = new JSZip();
      let zipHasFiles = false;
      const usedExportNames = new Set();
      const excelMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      
      // ========== 阶段1: 账号验证 ==========
      const authenticatedAccounts = [];
      const reloginAccounts = [];
      const unavailableAccounts = [];

      if (!onlyCookie) {
        addLog(`----------------------------`);
        addLog(`[阶段1] 并发验证 Cookie...`);
        
        // 注册拦截规则
        addLog(
          `[诊断] Cookie注入规则准备: accounts=${accounts.length}; eligible=${accounts.filter((account) => account.game_uid && account.cookie).length}; missingGameUid=${accounts.filter((account) => !account.game_uid).length}; missingCookie=${accounts.filter((account) => !account.cookie).length}`
        );
        await registerCookieRules(accounts);
        
        // 分批并发验证
        for (let batchStart = 0; batchStart < accounts.length; batchStart += BATCH_SIZE) {
          const batch = accounts.slice(batchStart, batchStart + BATCH_SIZE);
          
          const batchPromises = batch.map((acc, idx) => {
            const delay = idx * STAGGER_DELAY;
            return (async () => {
              await new Promise(r => setTimeout(r, delay));
              const diagnosticLog = createAccountDiagnosticLogger(addLog, acc, "保存Cookie验证");
              const result = await validateCookieWithAccount(acc, diagnosticLog);
              return { acc, result };
            })();
          });
          
          const batchResults = await Promise.all(batchPromises);
          
          for (const { acc, result } of batchResults) {
            if (result.valid) {
              authenticatedAccounts.push({
                ...acc,
                roleInfo: {
                  role_name: result.roleInfo?.role_name || acc.username || acc.name || "",
                  area_id: result.roleInfo?.area_id || "",
                },
              });
              if (result.roleReady) {
                addLog(`✓ ${acc.username || acc.name || t("noName")} - Cookie 有效`);
              } else {
                addLog(`✓ ${acc.username || acc.name || t("noName")} - Cookie 有效，area_id 待批次回填`);
              }
            } else {
              if (acc.password) {
                reloginAccounts.push(acc);
                addLog(`✗ ${acc.username || acc.name || t("noName")} - Cookie 失效，待重登`);
              } else {
                unavailableAccounts.push({ acc, reason: result.error || "Cookie 失效且无密码" });
                addLog(`✗ ${acc.username || acc.name || t("noName")} - ${result.error || "Cookie 失效"}，无密码跳过`);
              }
            }
          }
        }

        const pendingAreaCount = authenticatedAccounts.filter(
          (account) => !account.roleInfo?.area_id
        ).length;
        addLog(
          `验证完成: ${authenticatedAccounts.length} 登录态有效 (${pendingAreaCount} 待回填 area_id), ${reloginAccounts.length} 待重登, ${unavailableAccounts.length} 无法处理`
        );
      } else {
        // 仅更新 Cookie：跳过验证，直接按启用开关强制重登更新
        accounts.forEach((acc) => {
          if (acc.password) {
            reloginAccounts.push(acc);
          } else {
            unavailableAccounts.push({ acc, reason: "无密码，无法更新 Cookie" });
            addLog(`✗ ${acc.username || acc.name || t("noName")} - 无密码跳过`);
          }
        });
      }
      
      // ========== 阶段2: 串行重新登录失效账号 ==========
      if (reloginAccounts.length > 0) {
        addLog(`----------------------------`);
        addLog(onlyCookie ? `串行更新 ${reloginAccounts.length} 个账号 Cookie...` : `[阶段2] 串行重新登录 ${reloginAccounts.length} 个账号...`);
        
        for (const acc of reloginAccounts) {
          addLog(`正在登录: ${acc.username || acc.name || acc.email || t("noName")}`);
          const diagnosticLog = createAccountDiagnosticLogger(addLog, acc, "重新登录");
          diagnosticLog(
            `开始: server=${server}; storedCookie=${acc.cookie ? "present" : "empty"}; storedGameUid=${acc.game_uid ? "present" : "empty"}`
          );
          
          try {
            // 清除浏览器 Cookie 并执行登录
            await clearSiteCookies();
            diagnosticLog("BlaBlaLink Cookie 清理完成");
            const loginResult = await loginAndGetCookie(acc, server, diagnosticLog);
            diagnosticLog(
              `登录函数完成: attempt=${loginResult?.attempt ?? "unknown"}; totalElapsed=${loginResult?.totalElapsedMs ?? "unknown"}ms`
            );
            
            // 获取新 Cookie
            const cks = (await chrome.cookies.getAll({}))
              .filter(c => c.domain.endsWith("blablalink.com"));
            diagnosticLog(summarizeBrowserCookies(cks));
            const newCookieStr = cookieArrToStr(cks);
            const gameTokenCookie = cks.find(c => c.name === "game_token");
            if (!newCookieStr || !gameTokenCookie) {
              throw new Error("登录后未取得 game_token Cookie");
            }

            acc.cookie = newCookieStr;
            acc.cookieUpdatedAt = Date.now();
            const gameUidCookie = cks.find(c => c.name === "game_uid");
            if (gameUidCookie) acc.game_uid = gameUidCookie.value;
            diagnosticLog(
              `Cookie收集完成: serializedCookie=${newCookieStr ? "present" : "empty"}; serializedCookieCount=${newCookieStr ? newCookieStr.split(/;\s*/).filter(Boolean).length : 0}; game_uid写回=${gameUidCookie ? "yes" : "no"}`
            );

            let roleInfo = {
              role_name: acc.username || acc.name || "",
              area_id: "",
            };
            let areaSource = "pending";

            if (onlyCookie) {
              diagnosticLog("已取得 game_token，按 Cookie 更新模式判定重登成功，跳过 area_id 验证");
            } else {
              const existingBatchAreaId = getSharedBatchAreaId(authenticatedAccounts);
              if (existingBatchAreaId) {
                roleInfo.area_id = existingBatchAreaId;
                areaSource = "batch";
                diagnosticLog("已取得 game_token，直接采用本批次已确认的 area_id");
              } else {
                await applyCookieStr(newCookieStr);
                diagnosticLog("Cookie 重新应用完成；本批次尚无 area_id，尝试从当前账号发现");
                try {
                  const discoveredRoleInfo = await getRoleName(diagnosticLog);
                  roleInfo = {
                    role_name: discoveredRoleInfo.role_name || roleInfo.role_name,
                    area_id: discoveredRoleInfo.area_id || "",
                  };
                  areaSource = roleInfo.area_id ? "account" : "pending";
                  diagnosticLog(
                    `玩家信息探测结果: area_id=${roleInfo.area_id ? "present" : "empty"}; role_name=${roleInfo.role_name ? "present" : "empty"}`
                  );
                } catch (error) {
                  diagnosticLog(
                    `玩家信息探测异常但不影响重登成功: ${error?.message || error}`
                  );
                }
              }
            }

            authenticatedAccounts.push({ ...acc, roleInfo });

            if (onlyCookie) {
              addLog(`✓ ${acc.username || acc.name || t("noName")} - Cookie 更新成功`);
            } else if (areaSource === "batch") {
              addLog(`✓ ${acc.username || roleInfo.role_name || t("noName")} - 登录成功，已使用批次 area_id`);
            } else if (roleInfo.area_id) {
              addLog(`✓ ${acc.username || roleInfo.role_name || t("noName")} - 登录成功`);
            } else {
              addLog(`✓ ${acc.username || acc.name || t("noName")} - 登录成功，area_id 待批次回填`);
            }

            // Cookie 获取成功后立即回写账号，不再依赖 area_id。
            if (AUTO_SAVE_DATA) {
              if (roleInfo.role_name) acc.username = roleInfo.role_name;

              try {
                const all = await getAccounts();
                const now = Date.now();
                let existingIndex = -1;
                if (acc.email) {
                  existingIndex = all.findIndex((a) => a.email === acc.email);
                }
                if (existingIndex === -1 && acc.game_uid) {
                  existingIndex = all.findIndex((a) => a.game_uid === acc.game_uid);
                }
                if (existingIndex === -1) {
                  existingIndex = all.findIndex((a) => a.cookie === acc.cookie);
                }
                if (existingIndex !== -1) {
                  all[existingIndex] = {
                    ...all[existingIndex],
                    cookie: acc.cookie,
                    cookieUpdatedAt: now,
                    username: acc.username || all[existingIndex].username,
                    game_uid: acc.game_uid || all[existingIndex].game_uid,
                  };
                } else {
                  all.push({
                    ...acc,
                    cookieUpdatedAt: now,
                    enabled: acc.enabled !== false,
                  });
                }
                await setAccounts(all);
                diagnosticLog("新 Cookie 已回写账号存储");
              } catch (error) {
                diagnosticLog(
                  `新 Cookie 回写账号存储失败，但当前重登结果仍有效: ${error?.message || error}`
                );
              }
            }
          } catch (err) {
            unavailableAccounts.push({ acc, reason: `登录失败: ${err.message}` });
            diagnosticLog(`异常归类: ${err?.message || err}`);
            addLog(`✗ ${acc.username || acc.name || t("noName")} - ${err.message}`);
          }
        }
      }

      if (onlyCookie) {
        addLog(`----------------------------`);
        addLog(
          `Cookie 更新结果: ${authenticatedAccounts.length} 成功, ${unavailableAccounts.length} 失败`
        );
        addLog(t("cookieOnlyDone"));
        
        return;
      }

      // 同一业务批次共享 area_id：仅在本批次实际观测到唯一值时回填。
      const batchAreaIds = getDistinctBatchAreaIds(authenticatedAccounts);
      const sharedBatchAreaId = batchAreaIds.length === 1 ? batchAreaIds[0] : "";
      const pendingAreaAccounts = authenticatedAccounts.filter(
        (account) => !account.roleInfo?.area_id
      );

      let crawlableAccounts = authenticatedAccounts.filter(
        (account) => Boolean(account.roleInfo?.area_id)
      );

      if (sharedBatchAreaId) {
        crawlableAccounts = authenticatedAccounts.map((account) => ({
          ...account,
          roleInfo: {
            ...account.roleInfo,
            role_name:
              account.roleInfo?.role_name || account.username || account.name || "",
            area_id: account.roleInfo?.area_id || sharedBatchAreaId,
          },
        }));
        addLog(
          `批次 area_id 已确认：${pendingAreaAccounts.length} 个账号完成共享回填，${crawlableAccounts.length} 个账号可爬取`
        );
      } else if (pendingAreaAccounts.length > 0) {
        const reason = batchAreaIds.length > 1
          ? "同批次检测到多个 area_id，无法安全回填"
          : "登录成功，但本批次未取得可共享的 area_id";
        pendingAreaAccounts.forEach((acc) => {
          unavailableAccounts.push({ acc, reason });
        });
        addLog(
          batchAreaIds.length > 1
            ? `⚠ 同批次检测到 ${batchAreaIds.length} 个不同的 area_id，未对 ${pendingAreaAccounts.length} 个账号执行回填`
            : `✗ 本批次所有已登录账号均未取得 area_id，暂时无法开始角色数据爬取`
        );
      }

      // 只为最终可爬取账号注册 Cookie 隔离规则。
      await registerCookieRules(crawlableAccounts);

      if (crawlableAccounts.length === 0) {
        addLog(`----------------------------`);
        addLog(`没有可用账号，流程结束`);
        return;
      }
      
      // ========== 阶段3: 并发爬取数据 ==========
      addLog(`----------------------------`);
      addLog(`[阶段3] 并发爬取 ${crawlableAccounts.length} 个账号数据...`);
      
      const successAccounts = [];
      const failedAccounts = [...unavailableAccounts.map(({ acc, reason }) => ({ name: acc.username || acc.name || t("noName"), reason }))];
      
      // 单个账号的数据爬取函数
      const crawlAccountData = async (acc) => {
        const accountName = acc.roleInfo?.role_name || acc.username || acc.name || t("noName");
        
        try {
          // 构建数据字典
          const dict = await loadBaseAccountDict();
          dict.name = acc.roleInfo.role_name || acc.username || acc.name || "";
          dict.area_id = acc.roleInfo.area_id;
          dict.cookie = acc.cookie || "";
          
          // 解析 game_uid
          const gameUidMatch = acc.cookie?.match(/game_uid=([^;]*)/);
          dict.game_uid = acc.game_uid || (gameUidMatch ? gameUidMatch[1] : "");
          
          // 获取前哨信息
          const { synchroLevel, outpostLevel } = await getOutpostInfoWithAccount(acc, acc.roleInfo.area_id);
          dict.synchroLevel = synchroLevel;
          dict.outpostLevel = outpostLevel;
          
          // 获取主线进度
          const prog = await getCampaignProgressWithAccount(acc, acc.roleInfo.area_id, catalogMap);
          dict.normalProgress = prog.normal || "";
          dict.hardProgress = prog.hard || "";
          
          // 获取角色详情
          await addCharacterDetailsToDictWithAccount(dict, acc);
          
          // 计算 AEL 分
          computeAELForDict(dict);
          
          // 生成 Excel
          const excelBuffer = shouldExportExcel ? await saveDictToExcel(dict, lang) : null;
          
          return { success: true, accountName, dict, excelBuffer, account: acc };
        } catch (err) {
          return { success: false, accountName, error: err.message };
        }
      };
      
      // 分批并发爬取
      for (let batchStart = 0; batchStart < crawlableAccounts.length; batchStart += BATCH_SIZE) {
        const batch = crawlableAccounts.slice(batchStart, batchStart + BATCH_SIZE);
        
        const batchPromises = batch.map((acc, idx) => {
          const delay = idx * STAGGER_DELAY;
          return (async () => {
            await new Promise(r => setTimeout(r, delay));
            return await crawlAccountData(acc);
          })();
        });
        
        const batchResults = await Promise.all(batchPromises);
        
        for (const result of batchResults) {
          if (result.success) {
            successAccounts.push(result.accountName);
            addLog(`✓ ${result.accountName} - 数据爬取完成`);

            // 导出文件
            const exportGameUid = result.account?.game_uid
              || result.account?.gameUid
              || parseGameUidFromCookie(result.account?.cookie || "");

            if (shouldExportJson) {
              const jsonName = createUniqueExportFileName({
                accountName: result.accountName,
                gameUid: exportGameUid,
                extension: "json",
                usedNames: usedExportNames,
              });
              if (shouldZip) {
                zip.file(jsonName, JSON.stringify(result.dict, null, 4));
                zipHasFiles = true;
              } else {
                const blob = new Blob([JSON.stringify(result.dict, null, 4)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                chrome.downloads.download({ url, filename: jsonName }, () => URL.revokeObjectURL(url));
              }
            }
            
            if (shouldExportExcel && result.excelBuffer) {
              if (shouldZip) {
                const excelName = createUniqueExportFileName({
                  accountName: result.accountName,
                  gameUid: exportGameUid,
                  extension: "xlsx",
                  usedNames: usedExportNames,
                });
                zip.file(excelName, result.excelBuffer);
                zipHasFiles = true;
              } else {
                const excelName = createUniqueExportFileName({
                  accountName: result.accountName,
                  gameUid: exportGameUid,
                  extension: "xlsx",
                  usedNames: usedExportNames,
                });
                const url = URL.createObjectURL(new Blob([result.excelBuffer], { type: excelMime }));
                chrome.downloads.download({ url, filename: excelName }, () => URL.revokeObjectURL(url));
              }
            }
          } else {
            failedAccounts.push({ name: result.accountName, reason: result.error });
            addLog(`✗ ${result.accountName} - ${result.error}`);
          }
        }
      }
      
      // 清理拦截规则
      await unregisterAllRules();
      
      // 导出 ZIP
      if (shouldZip && zipHasFiles) {
        const zipBlob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(zipBlob);
        chrome.downloads.download({ url, filename: "accounts.zip" }, () => URL.revokeObjectURL(url));
      }
      
      // 输出统计信息
      addLog(`----------------------------`);
      addLog(`${t("processComplete")}`);
      addLog(`${t("successCount")}: ${successAccounts.length}`);
      if (failedAccounts.length > 0) {
        addLog(`${t("failedCount")}: ${failedAccounts.length}`);
        addLog(`${t("failedAccounts")}:`);
        failedAccounts.forEach(({ name, reason }) => {
          addLog(`  - ${name} (${reason})`);
        });
      }
      
      addLog(t("done"));
    } catch (e) {
      setLogs((l) => [...l, `[异常] ${e}`]);
      addLog(`${t("fail")}${e}`);
      // 确保清理规则
      await unregisterAllRules().catch(() => {});
    } finally {
      // 恢复原始cookie
      if (originalCookies) {
        await clearSiteCookies();
        await applyCookieStr(originalCookies);
      }
      if (onlyCookie) {
        setCookieLoading(false);
      } else {
        setLoading(false);
      }
    }
  }, [t, lang, saveAsZip, exportJson, server, clearLogs, addLog, loginAndGetCookie, addCharacterDetailsToDictWithAccount]);

  return {
    logs,
    loading,
    cookieLoading,
    addLog,
    handleSaveCookie,
    handleStart,
  };
}

export default useCrawler;
