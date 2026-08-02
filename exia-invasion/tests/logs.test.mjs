// SPDX-License-Identifier: GPL-3.0-or-later

import test from "node:test";
import assert from "node:assert/strict";

import { appendLogEntry, createLogState } from "../src/utils/logBuffer.js";
import { createLogFilename, formatLogText } from "../src/utils/logExport.js";

test("diagnostic entries stay out of concise logs but remain in full log order", () => {
  let state = createLogState();
  state = appendLogEntry(state, "开始处理");
  state = appendLogEntry(state, "[诊断 12:00:00.000] 请求开始", { diagnostic: true });
  state = appendLogEntry(state, "处理完成");

  assert.deepEqual(state.logs, ["开始处理", "处理完成"]);
  assert.deepEqual(state.fullLogs, [
    "开始处理",
    "[诊断 12:00:00.000] 请求开始",
    "处理完成",
  ]);
});

test("appending a log entry does not mutate the previous log state", () => {
  const previous = createLogState();
  const next = appendLogEntry(previous, "完成");

  assert.deepEqual(previous, { logs: [], fullLogs: [] });
  assert.deepEqual(next, { logs: ["完成"], fullLogs: ["完成"] });
});

test("formatLogText joins complete logs and handles empty input", () => {
  assert.equal(formatLogText(["开始", "[诊断] 请求", "完成"]), "开始\n[诊断] 请求\n完成");
  assert.equal(formatLogText([]), "");
  assert.equal(formatLogText(null), "");
});

test("createLogFilename produces a safe, deterministic text filename", () => {
  assert.equal(
    createLogFilename("2026-08-02T03:04:05.678Z"),
    "exia-invasion-log-20260802-030405.txt",
  );
});
