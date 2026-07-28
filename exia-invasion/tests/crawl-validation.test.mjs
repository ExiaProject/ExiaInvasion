import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EmptyCrawlDataError,
  crawlWithEmptyDataRetry,
  validateCharacterCrawlSummary,
} from '../src/utils/crawlValidation.js';

const createSummary = (overrides = {}) => ({
  configuredCharacterCount: 2,
  ownedCharacterCount: 2,
  requestedCharacterCount: 1,
  receivedDetailCount: 1,
  populatedCharacterCount: 1,
  ...overrides,
});

test('empty owned-character roster is treated as retryable invalid data', () => {
  const validation = validateCharacterCrawlSummary(createSummary({
    ownedCharacterCount: 0,
    requestedCharacterCount: 0,
    receivedDetailCount: 0,
    populatedCharacterCount: 0,
  }));

  assert.equal(validation.valid, false);
  assert.equal(validation.retryable, true);
  assert.match(validation.reason, /持有角色列表为空/);
});

test('no overlap with configured characters is a legitimate empty result', () => {
  const validation = validateCharacterCrawlSummary(createSummary({
    ownedCharacterCount: 5,
    requestedCharacterCount: 0,
    receivedDetailCount: 0,
    populatedCharacterCount: 0,
  }));

  assert.deepEqual(validation, {
    valid: true,
    retryable: false,
    reason: '',
  });
});

test('missing details for an owned configured character is retryable', () => {
  const validation = validateCharacterCrawlSummary(createSummary({
    receivedDetailCount: 0,
    populatedCharacterCount: 0,
  }));

  assert.equal(validation.valid, false);
  assert.equal(validation.retryable, true);
  assert.match(validation.reason, /没有返回任何详情/);
});

test('crawl retries an invalid empty result and returns the next valid result', async () => {
  let attempts = 0;
  const waits = [];
  const retries = [];

  const result = await crawlWithEmptyDataRetry({
    crawlOnce: async () => {
      attempts += 1;
      return {
        value: attempts,
        characterCrawlSummary: attempts === 1
          ? createSummary({
            ownedCharacterCount: 0,
            requestedCharacterCount: 0,
            receivedDetailCount: 0,
            populatedCharacterCount: 0,
          })
          : createSummary(),
      };
    },
    retryDelaysMs: [25],
    wait: async (delayMs) => waits.push(delayMs),
    onRetry: (details) => retries.push(details),
  });

  assert.equal(result.value, 2);
  assert.equal(attempts, 2);
  assert.deepEqual(waits, [25]);
  assert.equal(retries.length, 1);
  assert.equal(retries[0].nextAttempt, 2);
});

test('crawl stops after bounded retries when empty data persists', async () => {
  let attempts = 0;

  await assert.rejects(
    crawlWithEmptyDataRetry({
      crawlOnce: async () => {
        attempts += 1;
        return {
          characterCrawlSummary: createSummary({
            ownedCharacterCount: 0,
            requestedCharacterCount: 0,
            receivedDetailCount: 0,
            populatedCharacterCount: 0,
          }),
        };
      },
      retryDelaysMs: [0, 0],
      wait: async () => {},
    }),
    (error) => {
      assert.ok(error instanceof EmptyCrawlDataError);
      assert.equal(error.code, 'EMPTY_CRAWL_DATA');
      assert.match(error.message, /已尝试 3 次/);
      return true;
    }
  );

  assert.equal(attempts, 3);
});
