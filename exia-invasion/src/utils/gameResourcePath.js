// SPDX-License-Identifier: GPL-3.0-or-later

export const GAME_RESOURCE_CDN_BASE = "https://sg-tools-cdn.blablalink.com";

const DIRECTORY_HASH_PRIMES = [
  224737,
  1000639,
  2654435761,
  2654435769,
  1000621,
  4294967291,
];

const MD5_ROTATIONS = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

const MD5_CONSTANTS = Array.from(
  { length: 64 },
  (_, index) => Math.floor(Math.abs(Math.sin(index + 1)) * 0x100000000) >>> 0,
);

const rotateLeft = (value, shift) =>
  ((value << shift) | (value >>> (32 - shift))) >>> 0;

const toUtf8Bytes = (text) => {
  if (typeof TextEncoder !== "undefined") {
    return Array.from(new TextEncoder().encode(String(text)));
  }
  const encoded = unescape(encodeURIComponent(String(text)));
  return Array.from(encoded, (char) => char.charCodeAt(0));
};

const wordToLittleEndianHex = (word) => {
  let output = "";
  for (let offset = 0; offset < 32; offset += 8) {
    output += ((word >>> offset) & 0xff).toString(16).padStart(2, "0");
  }
  return output;
};

/**
 * Small dependency-free MD5 implementation used by the official CDN path scheme.
 */
export const md5Hex = (text) => {
  const bytes = toUtf8Bytes(text);
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);

  const lowBits = bitLength >>> 0;
  const highBits = Math.floor(bitLength / 0x100000000) >>> 0;
  for (let offset = 0; offset < 32; offset += 8) {
    bytes.push((lowBits >>> offset) & 0xff);
  }
  for (let offset = 0; offset < 32; offset += 8) {
    bytes.push((highBits >>> offset) & 0xff);
  }

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  for (let blockOffset = 0; blockOffset < bytes.length; blockOffset += 64) {
    const words = Array.from({ length: 16 }, (_, index) => {
      const offset = blockOffset + index * 4;
      return (
        bytes[offset]
        | (bytes[offset + 1] << 8)
        | (bytes[offset + 2] << 16)
        | (bytes[offset + 3] << 24)
      ) >>> 0;
    });

    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;

    for (let index = 0; index < 64; index += 1) {
      let f;
      let wordIndex;
      if (index < 16) {
        f = (b & c) | (~b & d);
        wordIndex = index;
      } else if (index < 32) {
        f = (d & b) | (~d & c);
        wordIndex = (5 * index + 1) % 16;
      } else if (index < 48) {
        f = b ^ c ^ d;
        wordIndex = (3 * index + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        wordIndex = (7 * index) % 16;
      }

      const previousD = d;
      d = c;
      c = b;
      const sum = (a + f + MD5_CONSTANTS[index] + words[wordIndex]) >>> 0;
      b = (b + rotateLeft(sum, MD5_ROTATIONS[index])) >>> 0;
      a = previousD;
    }

    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }

  return [a0, b0, c0, d0].map(wordToLittleEndianHex).join("");
};

export const djb2Hash32 = (text, seed) => {
  let hash = seed | 0;
  const value = String(text);
  for (let index = 0; index < value.length; index += 1) {
    hash = (Math.imul(hash, 33) + value.charCodeAt(index)) | 0;
  }
  return hash;
};

const positiveModulo = (value, divisor) => ((value % divisor) + divisor) % divisor;

export const getDirectoryBucket = (logicalPath, seed) => {
  const modulo = positiveModulo(djb2Hash32(logicalPath, seed), seed);
  const firstLetter = String.fromCharCode(97 + (Math.floor(modulo / 26) % 26));
  const secondLetter = String.fromCharCode(97 + (modulo % 26));
  const digits = String(modulo % 99).padStart(2, "0");
  return `${firstLetter}${secondLetter}-${digits}`;
};

export const normalizeGameResourcePath = (logicalPath) => {
  const normalized = String(logicalPath || "").replace(/^\/+/, "");
  if (!normalized || normalized.endsWith("/") || normalized.includes("\\")) {
    throw new Error(`无效的官网静态资源路径: ${logicalPath}`);
  }
  return normalized;
};

export const getGameResourceUrl = (
  logicalPath,
  baseUrl = GAME_RESOURCE_CDN_BASE,
) => {
  const normalized = normalizeGameResourcePath(logicalPath);
  const segments = normalized.split("/");
  const directoryCount = segments.length - 1;
  if (directoryCount > DIRECTORY_HASH_PRIMES.length) {
    throw new Error(`官网静态资源目录层级过深: ${logicalPath}`);
  }

  const filename = segments.at(-1);
  const dotIndex = filename.lastIndexOf(".");
  const extension = dotIndex >= 0 ? filename.slice(dotIndex) : "";
  const buckets = DIRECTORY_HASH_PRIMES
    .slice(0, directoryCount)
    .map((prime) => getDirectoryBucket(normalized, prime));
  const base = String(baseUrl).replace(/\/+$/, "");
  return `${base}/${[...buckets, `${md5Hex(normalized)}${extension}`].join("/")}`;
};

export const getRoleDataLogicalPath = (resourceId, locale = "zh-tw") =>
  `roledata/${resourceId}-v2-${locale}.json`;

