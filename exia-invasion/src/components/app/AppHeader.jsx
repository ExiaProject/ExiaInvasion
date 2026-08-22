// SPDX-License-Identifier: GPL-3.0-or-later
// ========== App Header 组件 ==========

import { memo, useMemo } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Button,
  IconButton,
  Tooltip,
  SvgIcon,
} from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import NewReleasesOutlinedIcon from "@mui/icons-material/NewReleasesOutlined";

const GITHUB_REPO_URL = "https://github.com/IsolateOB/ExiaInvasion";

const GitHubIcon = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
  </SvgIcon>
);

const AppHeader = ({
  t,
  updateAvailable,
  latestVersion,
  releaseUrl,
}) => {
  const iconUrl = useMemo(() => chrome.runtime.getURL("images/icon-128.png"), []);
  const updateMessage = t("updateAvailable").replace("{version}", latestVersion);

  const handleOpenManagement = () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL("management.html"), "_blank");
    }
  };

  return (
    <AppBar position="sticky">
      <Toolbar variant="dense">
        <img
          src={iconUrl}
          alt="logo"
          width={32}
          height={32}
          style={{ width: 32, height: 32, marginRight: 8 }}
        />
        <Box sx={{ display: "flex", alignItems: "center", flexGrow: 1, minWidth: 0 }}>
          <Typography variant="h6" sx={{ flexShrink: 0 }}>
            ExiaInvasion
          </Typography>
          {updateAvailable && (
            <Button
              variant="contained"
              color="error"
              size="small"
              disableElevation
              href={releaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={updateMessage}
              aria-label={updateMessage}
              sx={{
                ml: 0.75,
                minWidth: 0,
                flexShrink: 0,
                px: 0.5,
                py: 0.25,
                fontSize: 10.5,
                lineHeight: 1.25,
                whiteSpace: "nowrap",
                textTransform: "none",
              }}
            >
              <NewReleasesOutlinedIcon sx={{ mr: 0.25, fontSize: 13 }} />
              {latestVersion}
            </Button>
          )}
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Tooltip title={t("management") || "管理面板"} arrow>
            <IconButton
              color="inherit"
              size="small"
              onClick={handleOpenManagement}
              aria-label={t("management") || "管理面板"}
              sx={{
                p: 0.75,
                color: "inherit",
                opacity: 0.9,
                "&:hover": { opacity: 1, bgcolor: "rgba(255, 255, 255, 0.1)" },
              }}
            >
              <SettingsIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t("sourceCode") || "GitHub 源代码"} arrow>
            <IconButton
              color="inherit"
              size="small"
              component="a"
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("sourceCode") || "GitHub 源代码"}
              sx={{
                p: 0.75,
                color: "inherit",
                opacity: 0.9,
                "&:hover": { opacity: 1, bgcolor: "rgba(255, 255, 255, 0.1)" },
              }}
            >
              <GitHubIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default memo(AppHeader);
