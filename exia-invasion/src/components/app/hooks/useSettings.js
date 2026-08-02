// SPDX-License-Identifier: GPL-3.0-or-later
// ========== 设置 Hook ==========

import { useState, useEffect, useCallback } from "react";
import { getSettings, setSettings, getCharacters, setCharacters } from "../../../services/storage.js";
import { isCloudSyncUiVisible } from "../../../utils/cloudSyncUi.js";

/**
 * 设置管理 Hook
 */
export function useSettings() {
  const [lang, setLang] = useState("zh");
  const [saveAsZip, setSaveAsZip] = useState(false);
  const [exportJson, setExportJson] = useState(false);
  const [activateTab, setActivateTab] = useState(false);
  const [server, setServer] = useState("global");
  const [sortFlag, setSortFlag] = useState("1");
  const [collapseEquipDetails, setCollapseEquipDetails] = useState(false);
  const [showCloudSyncUi, setShowCloudSyncUi] = useState(true);
  const [forceSimulatedStatsLevel400, setForceSimulatedStatsLevel400] = useState(false);

  // 初始化设置加载
  useEffect(() => {
    (async () => {
      const [s, chars] = await Promise.all([
        getSettings(),
        getCharacters().catch(() => null),
      ]);
      setLang(s.lang || (navigator.language.startsWith("zh") ? "zh" : "en"));
      setSaveAsZip(Boolean(s.saveAsZip));
      setExportJson(Boolean(s.exportJson));
      setActivateTab(Boolean(s.activateTab));
      setServer(s.server || "global");
      setSortFlag(s.sortFlag || "1");
      setShowCloudSyncUi(isCloudSyncUiVisible(s));
      setForceSimulatedStatsLevel400(Boolean(s.forceSimulatedStatsLevel400));

      // 读取全局"折叠词条细节"开关
      setCollapseEquipDetails(chars?.options?.showEquipDetails === false);
    })();
  }, []);

  // 监听存储变化
  useEffect(() => {
    const handler = (changes, area) => {
      if (area === "local" && changes.settings) {
        const nextSettings = changes.settings.newValue || {};
        const nextLang = nextSettings.lang;
        if (nextLang) setLang(nextLang);
        setShowCloudSyncUi(isCloudSyncUiVisible(nextSettings));
        setForceSimulatedStatsLevel400(Boolean(nextSettings.forceSimulatedStatsLevel400));
        if ("syncAccountSensitive" in nextSettings) {
          // legacy flag ignored in UI
        }
      }
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, []);

  // 持久化设置
  const persistSettings = useCallback((upd) => {
    setSettings({
      lang,
      saveAsZip,
      exportJson,
      activateTab,
      server,
      sortFlag,
      ...upd,
    });
  }, [lang, saveAsZip, exportJson, activateTab, server, sortFlag]);

  // 切换装备详情折叠
  const toggleEquipDetail = useCallback(async (e) => {
    const collapse = e.target.checked;
    setCollapseEquipDetails(collapse);
    const chars = await getCharacters();
    const next = {
      ...chars,
      options: {
        ...(chars?.options || {}),
        showEquipDetails: !collapse,
      },
    };
    await setCharacters(next);
  }, []);

  // 切换保存为 ZIP
  const toggleSaveZip = useCallback((e) => {
    const v = e.target.checked;
    setSaveAsZip(v);
    persistSettings({ saveAsZip: v });
  }, [persistSettings]);

  // 切换导出 JSON
  const toggleExportJson = useCallback((e) => {
    const v = e.target.checked;
    setExportJson(v);
    persistSettings({ exportJson: v });
  }, [persistSettings]);


  // 切换激活标签页
  const toggleActivateTab = useCallback((e) => {
    const v = e.target.checked;
    setActivateTab(v);
    persistSettings({ activateTab: v });
  }, [persistSettings]);

  // 更改服务器
  const changeServer = useCallback((e) => {
    const v = e.target.value;
    setServer(v);
    persistSettings({ server: v });
  }, [persistSettings]);

  // 更改排序
  const handleSortChange = useCallback((e) => {
    const v = e.target.value;
    setSortFlag(v);
    persistSettings({ sortFlag: v });
  }, [persistSettings]);

  // 切换400级模拟属性
  const toggleForceSimulatedStatsLevel400 = useCallback((e) => {
    const v = e.target.checked;
    setForceSimulatedStatsLevel400(v);
    persistSettings({ forceSimulatedStatsLevel400: v });
  }, [persistSettings]);

  return {
    // 状态
    lang,
    saveAsZip,
    exportJson,
    activateTab,
    server,
    sortFlag,
    collapseEquipDetails,
    showCloudSyncUi,
    forceSimulatedStatsLevel400,

    // 操作
    toggleEquipDetail,
    toggleSaveZip,
    toggleExportJson,
    toggleActivateTab,
    changeServer,
    handleSortChange,
    toggleForceSimulatedStatsLevel400,
    persistSettings,
  };
}

export default useSettings;
