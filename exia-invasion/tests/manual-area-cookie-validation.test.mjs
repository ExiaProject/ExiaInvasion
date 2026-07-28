// SPDX-License-Identifier: GPL-3.0-or-later

import test from "node:test";
import assert from "node:assert/strict";
import { validateCookieWithAccount } from "../src/services/api.js";

const jsonResponse = (payload) => new Response(JSON.stringify(payload), {
  status: 200,
  headers: {
    "Content-Type": "application/json",
  },
});

test("manual area mode skips player lookup and validates with CheckLogin", async (t) => {
  const originalFetch = globalThis.fetch;
  const requestedUrls = [];
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (url) => {
    requestedUrls.push(String(url));
    return jsonResponse({
      code: 0,
      data: {},
    });
  };

  const result = await validateCookieWithAccount(
    {
      game_uid: "123",
      cookie: "game_uid=123; game_token=token",
    },
    undefined,
    { skipRoleLookup: true }
  );

  assert.equal(requestedUrls.length, 1);
  assert.match(requestedUrls[0], /\/CheckLogin\?/);
  assert.doesNotMatch(requestedUrls[0], /GetUserGamePlayerInfo/);
  assert.deepEqual(result, {
    valid: true,
    roleReady: false,
    roleInfo: {
      role_name: "",
      area_id: "",
    },
  });
});

test("default cookie validation preserves automatic player lookup", async (t) => {
  const originalFetch = globalThis.fetch;
  const requestedUrls = [];
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (url) => {
    const requestUrl = String(url);
    requestedUrls.push(requestUrl);

    if (requestUrl.includes("GetUserGamePlayerInfo")) {
      return jsonResponse({
        code: 0,
        data: {
          area_id: 456,
          role_name: "Old Name",
        },
      });
    }

    if (requestUrl.includes("GetUserProfileBasicInfo")) {
      return jsonResponse({
        code: 0,
        data: {
          basic_info: {
            nickname: "Current Name",
          },
        },
      });
    }

    throw new Error(`Unexpected request: ${requestUrl}`);
  };

  const result = await validateCookieWithAccount({
    game_uid: "123",
    cookie: "game_uid=123; game_token=token",
  });

  assert.equal(requestedUrls.length, 2);
  assert.match(requestedUrls[0], /GetUserGamePlayerInfo/);
  assert.match(requestedUrls[1], /GetUserProfileBasicInfo/);
  assert.deepEqual(result, {
    valid: true,
    roleReady: true,
    roleInfo: {
      role_name: "Current Name",
      area_id: "456",
    },
  });
});
