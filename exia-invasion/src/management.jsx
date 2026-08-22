// SPDX-License-Identifier: GPL-3.0-or-later
// ========== ExiaInvasion 管理页面组件 ==========
// 主要功能：账户管理、角色数据管理、装备统计配置等

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Container,
  Tabs,
  Tab,
  Snackbar,
  Alert,
} from "@mui/material";
import TRANSLATIONS from "./i18n/translations.js";
import { fetchAndCacheNikkeDirectory, getCachedNikkeDirectory } from "./services/api.js";
import { getCharacters, getSettings, setSettings } from "./services/storage.js";
import { getNikkeAvatarUrl as buildNikkeAvatarUrl } from "./utils/nikkeAvatar.js";
import ManagementHeader from "./components/management/ManagementHeader.jsx";
import AccountTabContent from "./components/management/AccountTabContent.jsx";
import CharacterTabContent from "./components/management/CharacterTabContent.jsx";
import SettingsTabContent from "./components/management/SettingsTabContent.jsx";
import CharacterFilterDialog from "./components/management/CharacterFilterDialog.jsx";
import {
  defaultRow,
  equipStatKeys,
  basicStatKeys,
  simulatedStatKeys,
  NIKKE_TOGGLE_COL_COUNT,
  NIKKE_NAME_MIN_WIDTH_PX,
  NIKKE_PRIORITY_WIDTH_PX,
  NIKKE_DRAG_HANDLE_WIDTH_PX,
  NIKKE_TOGGLE_MIN_WIDTH_PX,
  SHOW_STATS_CONFIG_MARKER,
  SIMULATED_STATS_CONFIG_MARKER,
  elementTranslationKeys,
  classTranslationKeys,
  corporationTranslationKeys,
} from "./components/management/constants.js";
import {
  normalizeTimestamp,
  getPriorityColor,
  normalizeStoredAccounts,
} from "./components/management/utils.js";
import { useAccountActions } from "./components/management/hooks/useAccountActions.js";
import { useCharacterActions } from "./components/management/hooks/useCharacterActions.js";
import { useTemplateManagement } from "./components/management/hooks/useTemplateManagement.js";

// ========== 管理页面主组件 ==========

const ManagementPage = () => {
  /* ========== 语言与设置 ========== */
  const [lang, setLang] = useState("zh");
  const [forceSimulatedStatsLevel400, setForceSimulatedStatsLevel400] = useState(false);
  const t = useCallback((k) => TRANSLATIONS[lang][k] || k, [lang]);

  // ========== 核心状态管理 ==========
  const [accounts, setAccounts] = useState([]);
  const [tab, setTab] = useState(0);
  const [characters, setCharactersData] = useState({ 
    elements: { 
      Electronic: [], 
      Fire: [], 
      Wind: [], 
      Water: [], 
      Iron: [], 
      Utility: [] 
    },
    options: {
      showEquipDetails: true
    }
  });
  const [nikkeList, setNikkeList] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  // 显示提示消息
  const showMessage = useCallback((message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  }, []);

  // 持久化账号数据到存储
  const persist = useCallback((data) =>
    new Promise((ok) => chrome.storage.local.set({ accounts: data }, ok)), []);

  const accountActionsRef = useRef(null);
  const resetEditingState = useCallback((len) => {
    accountActionsRef.current?.initEditingState(len, false);
  }, []);

  // ========== 使用自定义 Hooks ==========
  const templateManagement = useTemplateManagement({
    t,
    characters,
    setCharactersData,
    accounts,
    setAccounts,
    persist,
    showMessage,
    onAccountTemplateApplied: resetEditingState,
  });

  const accountActions = useAccountActions({
    t,
    accounts,
    setAccounts,
    persist,
    syncAccountTemplateData: templateManagement.syncAccountTemplateData,
    selectedAccountTemplateId: templateManagement.selectedAccountTemplateId,
    showMessage,
  });

  const characterActions = useCharacterActions({
    t,
    characters,
    setCharactersData,
    nikkeList,
    showMessage,
  });

  accountActionsRef.current = accountActions;

  // ========== 派生值 ==========
  const isAllEnabled = useMemo(
    () => (Array.isArray(accounts) ? accounts.every((acc) => acc.enabled !== false) : true),
    [accounts]
  );

  const nikkeResourceIdMap = useMemo(() => {
    const map = new Map();
    (nikkeList || []).forEach((n) => {
      if (!n) return;
      if (n.id === undefined || n.id === null) return;
      if (n.resource_id === undefined || n.resource_id === null || n.resource_id === "") return;
      map.set(n.id, n.resource_id);
    });
    return map;
  }, [nikkeList]);

  // 妮姬页开关列样式
  const toggleCellSx = useMemo(
    () => ({
      textAlign: 'center',
      padding: '4px',
      minWidth: NIKKE_TOGGLE_MIN_WIDTH_PX,
      width: `max(${NIKKE_TOGGLE_MIN_WIDTH_PX}px, calc((100% - ${NIKKE_DRAG_HANDLE_WIDTH_PX}px - ${NIKKE_NAME_MIN_WIDTH_PX}px - ${NIKKE_PRIORITY_WIDTH_PX}px) / ${NIKKE_TOGGLE_COL_COUNT}))`,
    }),
    []
  );
  const toggleHeaderCellSx = useMemo(
    () => ({
      ...toggleCellSx,
      fontSize: '0.75rem'
    }),
    [toggleCellSx]
  );

  const iconUrl = useMemo(() => chrome.runtime.getURL("images/icon-128.png"), []);

  // ========== 工具函数 ==========
  const equipStatLabels = [
    t("elementAdvantage"),
    t("attack"),
    t("ammo"),
    t("chargeSpeed"),
    t("chargeDamage"),
    t("critical"),
    t("criticalDamage"),
    t("hit"),
    t("defense")
  ];

  const getElementName = useCallback((element) => {
    const key = elementTranslationKeys[element];
    return key ? t(key) : element;
  }, [t]);

  const getClassName = useCallback((className) => {
    const key = classTranslationKeys[className];
    return key ? t(key) : className;
  }, [t]);

  const getCorporationName = useCallback((corporation) => {
    const key = corporationTranslationKeys[corporation];
    return key ? t(key) : corporation;
  }, [t]);

  const getBurstStageName = useCallback((stage) => {
    switch (stage) {
      case "Step1":
        return t("burstStage1");
      case "Step2":
        return t("burstStage2");
      case "Step3":
        return t("burstStage3");
      case "AllStep":
        return t("burstStageAll");
      default:
        return stage || "—";
    }
  }, [t]);

  const getDisplayName = useCallback((nikke) => {
    if (!nikke) return "";
    const zhName = nikke.name_cn || nikke.name_en || nikke.name_code || nikke.name;
    const enName = nikke.name_en || nikke.name_cn || nikke.name_code || nikke.name;
    return lang === "zh" ? zhName : enName;
  }, [lang]);

  const getNikkeAvatarUrl = useCallback((nikke) => {
    return buildNikkeAvatarUrl(nikke, nikkeResourceIdMap);
  }, [nikkeResourceIdMap]);

  const renderText = useCallback((txt) => (txt ? txt : "—"), []);

  const formatCookieRemaining = useCallback((timestampMs) => {
    if (!timestampMs) return null;
    const expireAt = timestampMs + 30 * 24 * 60 * 60 * 1000;
    const remainingMs = expireAt - Date.now();
    if (remainingMs <= 0) return { label: t("cookieExpired") || "已过期", color: "error.main" };
    const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
    const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
    if (remainingDays >= 1) {
      const label = (t("cookieValidForDays") || "可用 {count} 天").replace("{count}", String(remainingDays));
      return { label, color: "success.main" };
    }
    const label = (t("cookieValidForHours") || "可用 {count} 小时").replace("{count}", String(remainingHours));
    return { label, color: "success.main" };
  }, [t]);

  const getCookieStatus = useCallback((account) => {
    if (!account?.cookie) return null;
    const ts = normalizeTimestamp(account.cookieUpdatedAt ?? account.cookie_updated_at);
    if (!ts) {
      return { label: t("cookieUnknown") || "未知", color: "text.secondary" };
    }
    return formatCookieRemaining(ts);
  }, [formatCookieRemaining, t]);

  const toggleLang = useCallback(async (e) => {
    const newLang = e.target.checked ? "en" : "zh";
    setLang(newLang);
    const current = await getSettings();
    await setSettings({
      ...current,
      lang: newLang
    });
  }, []);

  const toggleForceSimulatedStatsLevel400 = useCallback((e) => {
    const next = e.target.checked;
    setForceSimulatedStatsLevel400(next);
    setSettings({ forceSimulatedStatsLevel400: next });
  }, []);

  // ========== 初始化 Effects ==========
  // 管理页 Tab 持久化
  useEffect(() => {
    chrome.storage.local.get("managementTab", (r) => {
      const saved = Number(r.managementTab);
      if (saved === 0 || saved === 1 || saved === 2) setTab(saved);
    });
  }, []);

  const handleManagementTabChange = useCallback((e, newTab) => {
    if (newTab === 0 || newTab === 1 || newTab === 2) {
      setTab(newTab);
      chrome.storage.local.set({ managementTab: newTab });
    }
  }, []);

  // 语言和设置初始化
  useEffect(() => {
    chrome.storage.local.get("settings", (r) => {
      const nextSettings = r.settings || {};
      const nextLang = nextSettings.lang || "zh";
      setLang(nextLang);
      setForceSimulatedStatsLevel400(Boolean(nextSettings.forceSimulatedStatsLevel400));
    });
    const handler = (c, area) => {
      if (area === "local" && c.settings) {
        const nextSettings = c.settings.newValue || {};
        const nextLang = nextSettings.lang || "zh";
        setLang(nextLang);
        setForceSimulatedStatsLevel400(Boolean(nextSettings.forceSimulatedStatsLevel400));
      }
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, []);

  // 角色数据初始化
  useEffect(() => {
    getCharacters().then(data => {
      const fallback = {
        elements: {
          Electronic: [], Fire: [], Wind: [], Water: [], Iron: [], Utility: []
        },
        options: {
          showEquipDetails: true
        }
      };
      const valid = (data && data.elements && typeof data.elements === 'object') ? data : fallback;
      const merged = {
        ...fallback,
        ...valid,
        options: {
          showEquipDetails: valid?.options?.showEquipDetails !== false
        }
      };
      setCharactersData(merged);
    });

    (async () => {
      const online = await fetchAndCacheNikkeDirectory();
      if (Array.isArray(online) && online.length) {
        setNikkeList(online);
      } else {
        const cached = await getCachedNikkeDirectory();
        setNikkeList(cached || []);
      }
    })();
  }, []);

  // 账号数据初始化（只在首次渲染时执行）
  useEffect(() => {
    (async () => {
      const rawAccounts = await new Promise((resolve) =>
        chrome.storage.local.get("accounts", (result) => resolve(result.accounts))
      );
      const list = normalizeStoredAccounts(rawAccounts);
      if (JSON.stringify(list) !== JSON.stringify(rawAccounts || [])) {
        await persist(list);
      }

      if (list.length === 0) {
        setAccounts([defaultRow()]);
        accountActions.initEditingState(1, true);
      } else {
        setAccounts(list);
        accountActions.initEditingState(list.length, false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 监听存储变化并同步状态（不重置editing状态，避免编辑中断）
  useEffect(() => {
    const handler = (changes, area) => {
      if (area === "local" && changes.accounts) {
        const next = normalizeStoredAccounts(changes.accounts.newValue);
        setAccounts(next);
        if (templateManagement.selectedAccountTemplateId) {
          templateManagement.syncAccountTemplateData(templateManagement.selectedAccountTemplateId, next);
        }
      }
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ========== 计算标签 ==========
  const selectionLabelTemplate = t("selectedCharactersLabel") || "Selected {count}";
  const selectionLabel = selectionLabelTemplate.replace("{count}", String(characterActions.totalSelectionCount));

  /* ---------- 渲染 ---------- */
  return (
    <>
      <ManagementHeader
        iconUrl={iconUrl}
        lang={lang}
        onToggleLang={toggleLang}
        t={t}
      />
      
      <Container maxWidth="xl" sx={{ mt: 4, pb: 8 }}>
        <Tabs value={tab} onChange={handleManagementTabChange} sx={{ mb: 3 }} aria-label={t("management")}>
          <Tab label={t("accountTable")} />
          <Tab label={t("characterManagement")} />
          <Tab label={t("managementSettings")} />
        </Tabs>
        {tab === 0 && (
          <AccountTabContent
            t={t}
            accountTemplates={templateManagement.accountTemplates}
            defaultAccountTemplateId={templateManagement.defaultAccountTemplateId}
            selectedAccountTemplateId={templateManagement.selectedAccountTemplateId}
            handleAccountTemplateChange={templateManagement.handleAccountTemplateChange}
            isAccountRenaming={templateManagement.isAccountRenaming}
            accountRenameId={templateManagement.accountRenameId}
            accountRenameValue={templateManagement.accountRenameValue}
            setAccountRenameValue={templateManagement.setAccountRenameValue}
            confirmAccountRename={templateManagement.confirmAccountRename}
            setIsAccountRenaming={templateManagement.setIsAccountRenaming}
            setAccountRenameId={templateManagement.setAccountRenameId}
            startRenameAccountTemplate={templateManagement.startRenameAccountTemplate}
            handleDuplicateAccountTemplate={templateManagement.handleDuplicateAccountTemplate}
            handleDeleteAccountTemplate={templateManagement.handleDeleteAccountTemplate}
            handleCreateAccountTemplate={templateManagement.handleCreateAccountTemplate}
            isAllEnabled={isAllEnabled}
            handleToggleAllEnabled={() => accountActions.handleToggleAllEnabled(isAllEnabled)}
            handleImportAccounts={accountActions.handleImportAccounts}
            handleExportAccounts={accountActions.handleExportAccounts}
            handleClearAllAccounts={accountActions.handleClearAllAccounts}
            accounts={accounts}
            editing={accountActions.editing}
            showPwds={accountActions.showPwds}
            accDragging={accountActions.accDragging}
            onAccountDragStart={accountActions.onAccountDragStart}
            onAccountDragOver={accountActions.onAccountDragOver}
            onAccountDrop={accountActions.onAccountDrop}
            onAccountDragEnd={accountActions.onAccountDragEnd}
            updateField={accountActions.updateField}
            handleToggleAccountEnabled={accountActions.handleToggleAccountEnabled}
            setShowPwds={accountActions.setShowPwds}
            saveRow={accountActions.saveRow}
            startEdit={accountActions.startEdit}
            deleteRow={accountActions.deleteRow}
            addRow={accountActions.addRow}
            renderText={renderText}
            getCookieStatus={getCookieStatus}
          />
        )}
        {tab === 1 && (
          <CharacterTabContent
            t={t}
            lang={lang}
            templates={templateManagement.templates}
            defaultTemplateId={templateManagement.defaultTemplateId}
            selectedTemplateId={templateManagement.selectedTemplateId}
            handleTemplateChange={templateManagement.handleTemplateChange}
            isRenaming={templateManagement.isRenaming}
            renameId={templateManagement.renameId}
            renameValue={templateManagement.renameValue}
            setRenameValue={templateManagement.setRenameValue}
            confirmRename={templateManagement.confirmRename}
            setIsRenaming={templateManagement.setIsRenaming}
            setRenameId={templateManagement.setRenameId}
            startRenameTemplate={templateManagement.startRenameTemplate}
            handleDuplicateTemplate={templateManagement.handleDuplicateTemplate}
            handleDeleteTemplate={templateManagement.handleDeleteTemplate}
            handleCreateTemplate={templateManagement.handleCreateTemplate}
            triggerCharacterImport={characterActions.triggerCharacterImport}
            handleExportCharacters={characterActions.handleExportCharacters}
            handleClearAllCharacters={characterActions.handleClearAllCharacters}
            characters={characters}
            getElementName={getElementName}
            openFilterDialog={characterActions.openFilterDialog}
            equipStatKeys={equipStatKeys}
            equipStatLabels={equipStatLabels}
            toggleHeaderCellSx={toggleHeaderCellSx}
            toggleCellSx={toggleCellSx}
            getNikkeAvatarUrl={getNikkeAvatarUrl}
            getDisplayName={getDisplayName}
            updateCharacterPriority={characterActions.updateCharacterPriority}
            getPriorityColor={getPriorityColor}
            updateCharacterShowStats={characterActions.updateCharacterShowStats}
            updateAllCharactersShowStats={characterActions.updateAllCharactersShowStats}
            basicStatKeys={basicStatKeys}
            simulatedStatKeys={simulatedStatKeys}
            showStatsConfigMarker={SHOW_STATS_CONFIG_MARKER}
            simulatedStatsConfigMarker={SIMULATED_STATS_CONFIG_MARKER}
            nikkeNameMinWidthPx={NIKKE_NAME_MIN_WIDTH_PX}
            nikkePriorityWidthPx={NIKKE_PRIORITY_WIDTH_PX}
            nikkeDragHandleWidthPx={NIKKE_DRAG_HANDLE_WIDTH_PX}
            nikkeToggleMinWidthPx={NIKKE_TOGGLE_MIN_WIDTH_PX}
            charDragging={characterActions.charDragging}
            onCharDragStart={characterActions.onCharDragStart}
            onCharDragOver={characterActions.onCharDragOver}
            onCharDrop={characterActions.onCharDrop}
            onCharDragEnd={characterActions.onCharDragEnd}
          />
        )}
        {tab === 2 && (
          <SettingsTabContent
            t={t}
            forceSimulatedStatsLevel400={forceSimulatedStatsLevel400}
            onToggleForceSimulatedStatsLevel400={toggleForceSimulatedStatsLevel400}
          />
        )}
      </Container>
      
      <CharacterFilterDialog
        t={t}
        open={characterActions.filterDialogOpen}
        onClose={characterActions.handleCloseFilterDialog}
        filters={characterActions.filters}
        setFilters={characterActions.setFilters}
        filteredNikkes={characterActions.filteredNikkes}
        selectedNikkes={characterActions.selectedNikkes}
        effectiveExistingElementIds={characterActions.effectiveExistingElementIds}
        getDisplayName={getDisplayName}
        getNikkeAvatarUrl={getNikkeAvatarUrl}
        getElementName={getElementName}
        getBurstStageName={getBurstStageName}
        getClassName={getClassName}
        getCorporationName={getCorporationName}
        handleSelectNikke={characterActions.handleSelectNikke}
        selectionLabel={selectionLabel}
        totalSelectionCount={characterActions.totalSelectionCount}
        effectiveExistingElementCharacters={characterActions.effectiveExistingElementCharacters}
        handleRemoveExistingNikke={characterActions.handleRemoveExistingNikke}
        handleRemoveSelectedNikke={characterActions.handleRemoveSelectedNikke}
        pendingSelectionCount={characterActions.pendingSelectionCount}
        removedExistingIds={characterActions.removedExistingIds}
        handleConfirmSelection={characterActions.handleConfirmSelection}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default ManagementPage;
