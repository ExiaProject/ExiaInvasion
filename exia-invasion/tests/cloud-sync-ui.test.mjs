// SPDX-License-Identifier: GPL-3.0-or-later

import test from "node:test";
import assert from "node:assert/strict";
import { isCloudSyncUiVisible } from "../src/utils/cloudSyncUi.js";

test("cloud sync UI is visible when the setting is missing", () => {
  assert.equal(isCloudSyncUiVisible(), true);
  assert.equal(isCloudSyncUiVisible({}), true);
});

test("cloud sync UI is visible when explicitly enabled", () => {
  assert.equal(isCloudSyncUiVisible({ showCloudSyncUi: true }), true);
});

test("cloud sync UI is hidden only when explicitly disabled", () => {
  assert.equal(isCloudSyncUiVisible({ showCloudSyncUi: false }), false);
});
