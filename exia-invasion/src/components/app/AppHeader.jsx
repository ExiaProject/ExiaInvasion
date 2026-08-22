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

const DiscordIcon = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <path d="M20.317 4.369a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.211.375-.444.864-.608 1.249a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.249.077.077 0 0 0-.079-.037 19.736 19.736 0 0 0-4.885 1.515.07.07 0 0 0-.032.027C.533 9.045-.32 13.579.099 18.057a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.062.077.077 0 0 0 .084-.027c.461-.63.873-1.295 1.226-1.994a.076.076 0 0 0-.041-.105 13.223 13.223 0 0 1-1.872-.9.077.077 0 0 1-.008-.128c.126-.094.252-.192.371-.29a.074.074 0 0 1 .077-.01c3.927 1.794 8.18 1.794 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.196.372.29a.077.077 0 0 1-.006.128 12.354 12.354 0 0 1-1.873.9.076.076 0 0 0-.04.106c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.88 19.88 0 0 0 6.002-3.062.077.077 0 0 0 .032-.056c.5-5.177-.838-9.673-3.548-13.661a.061.061 0 0 0-.031-.028zM8.02 15.331c-1.183 0-2.156-1.085-2.156-2.419 0-1.333.955-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.334-.955 2.419-2.157 2.419zm7.975 0c-1.184 0-2.156-1.085-2.156-2.419 0-1.333.955-2.418 2.156-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.334-.946 2.419-2.157 2.419z" />
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
          <Tooltip title={t("user.feedback") || "交流/反馈"} arrow>
            <IconButton
              color="inherit"
              size="small"
              component="a"
              href="https://discord.gg/fRW7PbYZAB"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("user.feedback") || "交流/反馈"}
              sx={{
                p: 0.75,
                color: "inherit",
                opacity: 0.9,
                "&:hover": { opacity: 1, bgcolor: "rgba(255, 255, 255, 0.1)" },
              }}
            >
              <DiscordIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default memo(AppHeader);
