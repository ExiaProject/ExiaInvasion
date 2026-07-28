// SPDX-License-Identifier: GPL-3.0-or-later

import test from "node:test";
import assert from "node:assert/strict";
import {
  applyManualAreaIdOverride,
  parseManualAreaId,
} from "../src/utils/areaId.js";

test("parseManualAreaId treats blank input as a disabled override", () => {
  assert.deepEqual(parseManualAreaId(), {
    empty: true,
    valid: true,
    value: "",
  });
  assert.deepEqual(parseManualAreaId("   "), {
    empty: true,
    valid: true,
    value: "",
  });
});

test("parseManualAreaId trims and canonicalizes positive integers", () => {
  assert.deepEqual(parseManualAreaId(" 00123 "), {
    empty: false,
    valid: true,
    value: "123",
  });
});

test("parseManualAreaId rejects invalid and unsafe values", () => {
  for (const value of [
    "0",
    "-1",
    "1.5",
    "1e3",
    "123abc",
    "9007199254740992",
  ]) {
    assert.equal(parseManualAreaId(value).valid, false, value);
  }
});

test("applyManualAreaIdOverride replaces every area_id without mutating inputs", () => {
  const accounts = [
    {
      id: "one",
      username: "Stored One",
      roleInfo: {
        role_name: "Role One",
        area_id: "111",
        source: "automatic",
      },
    },
    {
      id: "two",
      name: "Stored Two",
    },
  ];

  const result = applyManualAreaIdOverride(accounts, "00222");

  assert.notEqual(result, accounts);
  assert.notEqual(result[0], accounts[0]);
  assert.notEqual(result[0].roleInfo, accounts[0].roleInfo);
  assert.equal(accounts[0].roleInfo.area_id, "111");
  assert.deepEqual(result, [
    {
      id: "one",
      username: "Stored One",
      roleInfo: {
        role_name: "Role One",
        area_id: "222",
        source: "automatic",
      },
    },
    {
      id: "two",
      name: "Stored Two",
      roleInfo: {
        role_name: "Stored Two",
        area_id: "222",
      },
    },
  ]);
});
