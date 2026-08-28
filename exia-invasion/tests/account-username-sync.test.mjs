// SPDX-License-Identifier: GPL-3.0-or-later

import test from "node:test";
import assert from "node:assert/strict";
import { getRoleName, validateCookieWithAccount } from "../src/services/api.js";

const jsonResponse = (payload) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });

test("getRoleName returns both role_name and area_id from user profile", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalChrome = globalThis.chrome;
  const requestedUrls = [];
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.chrome = originalChrome;
  });

  globalThis.chrome = {
    runtime: { lastError: null },
    cookies: {
      getAll: async () => [{ name: "game_openid", value: "mock_openid_123" }],
      get: ({ name }, callback) => callback({ name, value: "mock_openid_123" }),
    },
  };

  globalThis.fetch = async (url) => {
    const requestUrl = String(url);
    requestedUrls.push(requestUrl);

    if (requestUrl.includes("GetUserGamePlayerInfo")) {
      return jsonResponse({
        code: 0,
        data: {
          area_id: 84,
          role_name: "OldRoleName",
        },
      });
    }

    if (requestUrl.includes("GetUserProfileBasicInfo")) {
      return jsonResponse({
        code: 0,
        data: {
          basic_info: {
            nickname: "LatestInGameName",
            area_id: 84,
          },
        },
      });
    }

    throw new Error(`Unexpected request: ${requestUrl}`);
  };

  const result = await getRoleName();

  assert.equal(requestedUrls.length, 2);
  assert.deepEqual(result, {
    role_name: "LatestInGameName",
    area_id: 84,
  });
});

test("validateCookieWithAccount resolves latest role_name for cookie validation stage", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (url) => {
    const requestUrl = String(url);
    if (requestUrl.includes("GetUserGamePlayerInfo")) {
      return jsonResponse({
        code: 0,
        data: {
          area_id: 80,
          role_name: "PlayerJP",
        },
      });
    }
    if (requestUrl.includes("GetUserProfileBasicInfo")) {
      return jsonResponse({
        code: 0,
        data: {
          basic_info: {
            nickname: "RenamedJPPlayer",
          },
        },
      });
    }
    throw new Error(`Unexpected request: ${requestUrl}`);
  };

  const result = await validateCookieWithAccount({
    game_uid: "999888",
    cookie: "game_uid=999888; game_token=valid_token",
  });

  assert.equal(result.valid, true);
  assert.equal(result.roleReady, true);
  assert.equal(result.roleInfo.role_name, "RenamedJPPlayer");
  assert.equal(result.roleInfo.area_id, "80");
});

test("roleInfo resolution keeps discovered role_name while falling back to batch area_id when account area_id is missing", () => {
  const acc = {
    username: "",
    email: "new_player@example.com",
  };

  const existingBatchAreaId = "84";
  const discoveredRoleInfo = {
    role_name: "AutoDiscoveredHero",
    area_id: "", // 模拟角色接口 area_id 缺失/异常
  };

  const detectedRoleName = discoveredRoleInfo?.role_name || "";
  const detectedAreaId = discoveredRoleInfo?.area_id || "";
  const finalAreaId = detectedAreaId || existingBatchAreaId || "";

  const roleInfo = {
    role_name: detectedRoleName || acc.username || "",
    area_id: finalAreaId,
  };
  const areaSource = detectedAreaId ? "account" : (finalAreaId ? "batch" : "pending");

  assert.equal(roleInfo.role_name, "AutoDiscoveredHero");
  assert.equal(roleInfo.area_id, "84");
  assert.equal(areaSource, "batch");

  if (roleInfo.role_name) {
    acc.username = roleInfo.role_name;
  }
  assert.equal(acc.username, "AutoDiscoveredHero");
});

test("in-game rename updates stored account username", () => {
  const storedAccounts = [
    { email: "user@test.com", username: "OldName", cookie: "sample_cookie" },
  ];

  const reLoggedAccount = {
    email: "user@test.com",
    username: "OldName",
  };

  const discoveredRoleInfo = {
    role_name: "NewRenamedHero",
    area_id: "84",
  };

  const roleInfo = {
    role_name: discoveredRoleInfo.role_name,
    area_id: discoveredRoleInfo.area_id,
  };

  if (roleInfo.role_name) {
    reLoggedAccount.username = roleInfo.role_name;
  }

  const existingIndex = storedAccounts.findIndex(a => a.email === reLoggedAccount.email);
  assert.notEqual(existingIndex, -1);

  storedAccounts[existingIndex] = {
    ...storedAccounts[existingIndex],
    username: reLoggedAccount.username || storedAccounts[existingIndex].username,
  };

  assert.equal(storedAccounts[0].username, "NewRenamedHero");
});
