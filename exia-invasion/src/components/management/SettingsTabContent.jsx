// SPDX-License-Identifier: GPL-3.0-or-later
import { memo } from "react";
import { Box, Paper, Switch, Typography } from "@mui/material";

const SettingsTabContent = ({
  t,
  forceSimulatedStatsLevel400,
  onToggleForceSimulatedStatsLevel400,
}) => (
  <Paper variant="outlined" sx={{ p: 3, maxWidth: 720 }}>
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
);

export default memo(SettingsTabContent);
