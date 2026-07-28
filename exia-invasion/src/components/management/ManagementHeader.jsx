// SPDX-License-Identifier: GPL-3.0-or-later
import { memo } from "react";
import { AppBar, Toolbar, Typography, Box, Switch, Button } from "@mui/material";
import CloudIcon from "@mui/icons-material/Cloud";
import CloudOffIcon from "@mui/icons-material/CloudOff";

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
      </Box>
    </Toolbar>
  </AppBar>
);

export default memo(ManagementHeader);
