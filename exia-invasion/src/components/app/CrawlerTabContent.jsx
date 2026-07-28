// SPDX-License-Identifier: GPL-3.0-or-later
// ========== 爬取标签页内容组件 ==========

import { memo } from "react";
import {
  Stack,
  Switch,
  Button,
  FormControlLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  CircularProgress,
  TextField,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SaveIcon from "@mui/icons-material/Save";
import SettingsIcon from "@mui/icons-material/Settings";
import { parseManualAreaId } from "../../utils/areaId.js";

const CrawlerTabContent = ({
  t,
  // 设置
  saveAsZip,
  exportJson,
  collapseEquipDetails,
  activateTab,
  server,
  manualAreaId,
  onManualAreaIdChange,
  // 开关处理
  toggleSaveZip,
  toggleExportJson,
  toggleEquipDetail,
  toggleActivateTab,
  changeServer,
  // 爬取
  loading,
  cookieLoading,
  handleSaveCookie,
  handleStart,
}) => {
  const parsedManualAreaId = parseManualAreaId(manualAreaId);
  const manualAreaIdInvalid = !parsedManualAreaId.valid;

  const normalizeManualAreaId = () => {
    if (parsedManualAreaId.valid) {
      onManualAreaIdChange(parsedManualAreaId.value);
    }
  };

  return (
    <>
      {/* 保存当前 Cookie */}
      <Button
        variant="outlined"
        fullWidth
        onClick={handleSaveCookie}
        startIcon={<SaveIcon />}
      >
        {t("saveCookie")}
      </Button>
      <Button
        variant="text"
        fullWidth
        onClick={() => chrome.runtime.openOptionsPage()}
        startIcon={<SettingsIcon />}
      >
        {t("management")}
      </Button>
      <Stack spacing={1}>
        <FormControlLabel
          control={<Switch checked={saveAsZip} onChange={toggleSaveZip} />}
          label={t("saveAsZip")}
        />
        <FormControlLabel
          control={<Switch checked={exportJson} onChange={toggleExportJson} />}
          label={t("exportJson")}
        />
        <FormControlLabel
          control={<Switch checked={collapseEquipDetails} onChange={toggleEquipDetail} />}
          label={t("equipDetail")}
        />
        <FormControlLabel
          control={<Switch checked={activateTab} onChange={toggleActivateTab} />}
          label={t("activateTab")}
        />
      </Stack>
      
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          {t("server")}
        </Typography>
        <Select
          variant="outlined"
          size="small"
          fullWidth
          value={server}
          onChange={changeServer}
          inputProps={{ "aria-label": t("server") }}
        >
          <MenuItem value="hmt">{t("hmt")}</MenuItem>
          <MenuItem value="global">{t("global")}</MenuItem>
        </Select>
      </Box>

      <TextField
        variant="outlined"
        size="small"
        fullWidth
        label={t("manualAreaId")}
        value={manualAreaId}
        onChange={(event) => onManualAreaIdChange(event.target.value)}
        onBlur={normalizeManualAreaId}
        error={manualAreaIdInvalid}
        helperText={
          manualAreaIdInvalid
            ? t("manualAreaIdInvalid")
            : t("manualAreaIdHelp")
        }
        disabled={loading || cookieLoading}
        slotProps={{
          htmlInput: {
            inputMode: "numeric",
            pattern: "[0-9]*",
            "aria-label": t("manualAreaId"),
          },
        }}
      />
      
      {/* 运行按钮 */}
      <Button
        variant="contained"
        fullWidth
        onClick={() => handleStart({ onlyCookie: false, manualAreaId })}
        startIcon={
          loading ? (
            <CircularProgress size={20} color="inherit" />
          ) : (
            <PlayArrowIcon />
          )
        }
        disabled={loading || cookieLoading || manualAreaIdInvalid}
      >
        {t("fetchCharacters")}
      </Button>
      <Button
        variant="outlined"
        fullWidth
        onClick={() => handleStart({ onlyCookie: true })}
        startIcon={cookieLoading ? <CircularProgress size={20} color="inherit" /> : null}
        disabled={loading || cookieLoading}
      >
        {t("updateCookie")}
      </Button>
    </>
  );
};

export default memo(CrawlerTabContent);
