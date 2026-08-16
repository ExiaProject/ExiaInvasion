// SPDX-License-Identifier: GPL-3.0-or-later
import { memo } from "react";
import { AppBar, Toolbar, Typography, Box, Switch, Button, IconButton, Tooltip, SvgIcon } from "@mui/material";
import CloudIcon from "@mui/icons-material/Cloud";
import CloudOffIcon from "@mui/icons-material/CloudOff";

const GITHUB_REPO_URL = "https://github.com/IsolateOB/ExiaInvasion";

const GitHubIcon = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
  </SvgIcon>
);

const ManagementHeader = ({
  iconUrl,
  lang,
  onToggleLang,
  t,
  showCloudSyncUi,
  onToggleCloudSyncUi,
}) => (
  <AppBar position="sticky" sx={{ top: 0, zIndex: (theme) => theme.zIndex.appBar }}>
    <Toolbar>
      <img
        src={iconUrl}
        alt="logo"
        width={32}
        height={32}
        style={{ width: 32, height: 32, marginRight: 8 }}
      />
      <Typography variant="h6" sx={{ flexGrow: 1 }}>ExiaInvasion</Typography>
      <Box display="flex" alignItems="center" sx={{ color: "white" }}>
        <Typography variant="caption">中文</Typography>
        <Switch
          size="small"
          color="default"
          checked={lang === "en"}
          onChange={onToggleLang}
          inputProps={{ "aria-label": "Language" }}
        />
        <Typography variant="caption">EN</Typography>
        <Button
          size="small"
          color="inherit"
          variant="outlined"
          startIcon={showCloudSyncUi ? <CloudOffIcon /> : <CloudIcon />}
          onClick={onToggleCloudSyncUi}
          aria-label={showCloudSyncUi ? t("sync.hideUi") : t("sync.showUi")}
          sx={{
            ml: 2,
            whiteSpace: "nowrap",
            borderColor: "rgba(255, 255, 255, 0.7)",
            "&:hover": {
              borderColor: "white",
              bgcolor: "rgba(255, 255, 255, 0.08)",
            },
          }}
        >
          {showCloudSyncUi ? t("sync.hideUi") : t("sync.showUi")}
        </Button>
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
              ml: 1,
              color: "white",
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

export default memo(ManagementHeader);
