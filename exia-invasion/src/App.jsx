// SPDX-License-Identifier: GPL-3.0-or-later
// ========== Exia Invasion 主应用组件 ==========
// 主要功能：账户管理、数据爬取、Excel导出、文件合并等

import { useState, useEffect, useCallback } from "react";
import {
  Container,
  Stack,
  Paper,
  Button,
  Snackbar,
  Alert,
  ToggleButtonGroup,
  ToggleButton
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadIcon from "@mui/icons-material/Download";
import TRANSLATIONS from "./i18n/translations.js";
import { initializeLevelStats } from "./services/levelStats.js";
import { createLogFilename, formatLogText } from "./utils/logExport.js";
import {
  useAuth,
  useSettings,
  useNotification,
  useCrawler,
  useMerge,
  useUpdateCheck,
  AppHeader,
  CrawlerTabContent,
  MergeTabContent,
} from "./components/app";

// ========== React 主组件 ==========
export default function App() {
  // ========== 标签页状态 ==========
  const [tab, setTab] = useState("crawler");
  const [manualAreaId, setManualAreaId] = useState("");

  useEffect(() => {
    initializeLevelStats().catch((error) => {
      console.warn("共享等级曲线初始化失败:", error);
    });
  }, []);
  
  const handleTabChange = useCallback((event, newTab) => {
    if (newTab !== null) {
      setTab(newTab);
    }
  }, []);

  // ========== 通知 ==========
  const { notification, showMessage, handleCloseNotification } = useNotification();

  // ========== 设置 ==========
  const settings = useSettings();
  
  // 翻译函数
  const t = useCallback((k) => TRANSLATIONS[settings.lang][k] || k, [settings.lang]);

  // ========== 认证 ==========
  const showAuthMessage = useCallback((message, severity) => {
    if (settings.showCloudSyncUi) {
      showMessage(message, severity);
    }
  }, [settings.showCloudSyncUi, showMessage]);
  const auth = useAuth({ t, showMessage: showAuthMessage });
  const { handleMenuClose } = auth;

  useEffect(() => {
    if (!settings.showCloudSyncUi) {
      handleMenuClose();
    }
  }, [settings.showCloudSyncUi, handleMenuClose]);

  // ========== 云同步检查 ==========

  // ========== 自动更新检查 ==========
  const { updateAvailable, latestVersion, releaseUrl } = useUpdateCheck();

  // ========== 数据爬取 ==========
  const crawler = useCrawler({
    t,
    lang: settings.lang,
    saveAsZip: settings.saveAsZip,
    exportJson: settings.exportJson,
    activateTab: settings.activateTab,
    server: settings.server,
  });

  // ========== 文件合并 ==========
  const merge = useMerge({
    t,
    sortFlag: settings.sortFlag,
  });

  // 合并日志显示
  const displayLogs = tab === "crawler" ? crawler.logs : merge.logs;
  const fullLogText = formatLogText(crawler.fullLogs);
  const hasFullLogs = Boolean(fullLogText);

  const handleCopyFullLogs = useCallback(async () => {
    if (!hasFullLogs) {
      showMessage(t("fullLogsEmpty"), "info");
      return;
    }

    try {
      await navigator.clipboard.writeText(fullLogText);
      showMessage(t("fullLogsCopied"), "success");
    } catch (error) {
      console.error("复制完整日志失败:", error);
      showMessage(t("fullLogsCopyFailed"), "error");
    }
  }, [fullLogText, hasFullLogs, showMessage, t]);

  const handleDownloadFullLogs = useCallback(() => {
    if (!hasFullLogs) {
      showMessage(t("fullLogsEmpty"), "info");
      return;
    }

    const blob = new Blob(["\ufeff", fullLogText], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);

    chrome.downloads.download(
      {
        url,
        filename: createLogFilename(),
        saveAs: false,
      },
      () => {
        const downloadError = chrome.runtime.lastError;
        URL.revokeObjectURL(url);
        if (downloadError) {
          console.error("下载完整日志失败:", downloadError.message);
          showMessage(t("fullLogsDownloadFailed"), "error");
          return;
        }
        showMessage(t("fullLogsDownloaded"), "success");
      },
    );
  }, [fullLogText, hasFullLogs, showMessage, t]);

  /* ========== UI 界面渲染 ========== */
  return (
    <>
      <AppHeader
        t={t}
        authUsername={auth.authUsername}
        authAvatarUrl={auth.authAvatarUrl}
        authAnchorEl={auth.authAnchorEl}
        menuOpen={auth.menuOpen}
        handleAvatarClick={auth.handleAvatarClick}
        handleMenuClose={auth.handleMenuClose}
        handleLogoutClick={auth.handleLogoutClick}
        openLoginDialog={auth.openLoginDialog}
        showCloudSyncUi={settings.showCloudSyncUi}
        updateAvailable={updateAvailable}
        latestVersion={latestVersion}
        releaseUrl={releaseUrl}
      />
      
      <Container sx={{ mt: 2, width: 340, pb: 1 }}>
        <ToggleButtonGroup
          value={tab}
          exclusive
          fullWidth
          onChange={handleTabChange}
          aria-label={t("crawlerTab")}
          sx={{ mb: 2 }}
        >
          <ToggleButton value="crawler">{t("crawlerTab")}</ToggleButton>
          <ToggleButton value="merge">{t("mergeTab")}</ToggleButton>
        </ToggleButtonGroup>
        
        <Stack spacing={2}>
          {tab === "crawler" && (
            <CrawlerTabContent
              t={t}
              saveAsZip={settings.saveAsZip}
              exportJson={settings.exportJson}
              collapseEquipDetails={settings.collapseEquipDetails}
              activateTab={settings.activateTab}
              server={settings.server}
              manualAreaId={manualAreaId}
              onManualAreaIdChange={setManualAreaId}
              toggleSaveZip={settings.toggleSaveZip}
              toggleExportJson={settings.toggleExportJson}
              toggleEquipDetail={settings.toggleEquipDetail}
              toggleActivateTab={settings.toggleActivateTab}
              changeServer={settings.changeServer}
              loading={crawler.loading}
              cookieLoading={crawler.cookieLoading}
              handleSaveCookie={crawler.handleSaveCookie}
              handleStart={crawler.handleStart}
            />
          )}
          
          {tab === "merge" && (
            <MergeTabContent
              t={t}
              excelFilesToMerge={merge.excelFilesToMerge}
              jsonFilesToMerge={merge.jsonFilesToMerge}
              sortFlag={settings.sortFlag}
              loading={merge.loading}
              handleExcelFileSelect={merge.handleExcelFileSelect}
              handleJsonFileSelect={merge.handleJsonFileSelect}
              handleSortChange={settings.handleSortChange}
              handleMerge={merge.handleMerge}
            />
          )}

          {tab === "crawler" && (
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                size="small"
                fullWidth
                startIcon={<ContentCopyIcon />}
                onClick={handleCopyFullLogs}
                disabled={!hasFullLogs}
              >
                {t("copyFullLogs")}
              </Button>
              <Button
                variant="outlined"
                size="small"
                fullWidth
                startIcon={<DownloadIcon />}
                onClick={handleDownloadFullLogs}
                disabled={!hasFullLogs}
              >
                {t("downloadFullLogs")}
              </Button>
            </Stack>
          )}
          
          <Paper
            variant="outlined"
            sx={{
              p: 1,
              height: 400,
              overflowY: "auto",
              whiteSpace: "pre-line",
              fontSize: 12,
            }}
          >
            {displayLogs.join("\n")}
          </Paper>

        </Stack>
      </Container>

      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert
          onClose={handleCloseNotification}
          severity={notification.severity}
          sx={{ width: "100%" }}
        >
          {notification.message}
        </Alert>
      </Snackbar>

    </>
  );
}
