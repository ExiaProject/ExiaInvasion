// SPDX-License-Identifier: GPL-3.0-or-later

import test from "node:test";
import assert from "node:assert/strict";
import {
  getGameResourceUrl,
  getRoleDataLogicalPath,
  md5Hex,
} from "../src/utils/gameResourcePath.js";

test("dependency-free MD5 matches RFC vectors", () => {
  assert.equal(md5Hex(""), "d41d8cd98f00b204e9800998ecf8427e");
  assert.equal(md5Hex("abc"), "900150983cd24fb0d6963f7d28e17f72");
  assert.equal(
    md5Hex("message digest"),
    "f96b697d7cb7938d525a2f31aaf161d0",
  );
});

test("DJB2/MD5 mapping reproduces known official CDN URLs", () => {
  assert.equal(
    getGameResourceUrl("/stage/stage_list.json"),
    "https://sg-tools-cdn.blablalink.com/xx-97/b32816a11f83865b09bcf95e67ca83ae.json",
  );
  assert.equal(
    getGameResourceUrl("/character/RecycleResearchStatTable.json"),
    "https://sg-tools-cdn.blablalink.com/eu-96/258f853112b1d6f69d1508e12918ff3b.json",
  );
  assert.equal(
    getGameResourceUrl("/equip/zh-tw/cube_1000301.json"),
    "https://sg-tools-cdn.blablalink.com/qt-68/rs-35/b3ac57d9588afb90064cbd463af7ecb0.json",
  );
});

test("roledata logical paths are generated instead of pinning a current hash", () => {
  assert.equal(
    getRoleDataLogicalPath(580),
    "roledata/580-v2-zh-tw.json",
  );
  assert.match(
    getGameResourceUrl(getRoleDataLogicalPath(580)),
    /^https:\/\/sg-tools-cdn\.blablalink\.com\/[a-z]{2}-\d{2}\/[a-f0-9]{32}\.json$/,
  );
});

