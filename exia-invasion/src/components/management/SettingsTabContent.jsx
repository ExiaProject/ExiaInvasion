import { memo, useMemo } from "react";
import { Box, Paper, Switch, Typography, Button, Divider, Stack, SvgIcon } from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ArticleIcon from "@mui/icons-material/Article";

const GITHUB_REPO_URL = "https://github.com/IsolateOB/ExiaInvasion";

const GitHubIcon = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
  </SvgIcon>
);

const SettingsTabContent = ({
  t,
  forceSimulatedStatsLevel400,
  onToggleForceSimulatedStatsLevel400,
}) => {
  const licenseUrl = useMemo(() => {
    try {
      return chrome?.runtime?.getURL ? chrome.runtime.getURL("LICENSE") : `${GITHUB_REPO_URL}/blob/main/LICENSE`;
    } catch {
      return `${GITHUB_REPO_URL}/blob/main/LICENSE`;
    }
  }, []);

  const version = useMemo(() => {
    try {
      return chrome?.runtime?.getManifest ? chrome.runtime.getManifest().version : "3.1.3";
    } catch {
      return "3.1.3";
    }
  }, []);

  return (
    <Stack spacing={2} sx={{ maxWidth: 720 }}>
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          {t("managementSettings")}
        </Typography>
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body1">
              {t("forceSimulatedStatsLevel400")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("forceSimulatedStatsLevel400Help")}
            </Typography>
          </Box>
          <Switch
            checked={Boolean(forceSimulatedStatsLevel400)}
            onChange={onToggleForceSimulatedStatsLevel400}
            inputProps={{ "aria-label": t("forceSimulatedStatsLevel400") }}
          />
        </Box>
      </Paper>

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          {t("aboutTitle") || "关于与开源许可"}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          ExiaInvasion v{version} · {t("aboutDesc") || "ExiaInvasion 是遵循 GPL-3.0 协议的自由软件。您可以自由查看源码、修改与分发。"}
        </Typography>

        <Divider sx={{ my: 1.5 }} />

        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
            <Box>
              <Typography variant="subtitle2">
                {t("openSourceLicense") || "开源许可证"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t("licenseGpl") || "GNU 通用公共许可证 v3.0 (GPL-3.0)"}
              </Typography>
            </Box>
            <Button
              variant="outlined"
              size="small"
              startIcon={<ArticleIcon />}
              endIcon={<OpenInNewIcon fontSize="small" />}
              href={licenseUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("viewLicense") || "查看许可证全文"}
            </Button>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1, mt: 1 }}>
            <Box>
              <Typography variant="subtitle2">
                {t("sourceCode") || "GitHub 源代码"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {GITHUB_REPO_URL}
              </Typography>
            </Box>
            <Button
              variant="contained"
              size="small"
              startIcon={<GitHubIcon />}
              endIcon={<OpenInNewIcon fontSize="small" />}
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("sourceCode") || "GitHub 源代码"}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Stack>
  );
};

export default memo(SettingsTabContent);

