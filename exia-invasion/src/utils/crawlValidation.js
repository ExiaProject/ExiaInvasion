// SPDX-License-Identifier: GPL-3.0-or-later

export const EMPTY_CRAWL_RETRY_DELAYS_MS = [1000, 2000];

const SUMMARY_COUNT_KEYS = [
  "configuredCharacterCount",
  "ownedCharacterCount",
  "requestedCharacterCount",
  "receivedDetailCount",
  "populatedCharacterCount",
];

/**
 * 验证角色爬取摘要。
 *
 * 最终导出的角色可能因为“配置角色与玩家持有角色没有交集”而全部没有详情，
 * 因此不能直接把所有静态角色对象都当成异常。玩家持有角色列表和详情请求的
 * 交集才是可靠的判据。
 */
export const validateCharacterCrawlSummary = (summary) => {
  if (!summary || typeof summary !== "object") {
    return {
      valid: false,
      retryable: false,
      reason: "角色爬取缺少验证摘要",
    };
  }

  const hasInvalidCount = SUMMARY_COUNT_KEYS.some(
    (key) => !Number.isInteger(summary[key]) || summary[key] < 0
  );
  if (hasInvalidCount) {
    return {
      valid: false,
      retryable: false,
      reason: "角色爬取验证摘要格式无效",
    };
  }

  if (summary.configuredCharacterCount === 0) {
    return {
      valid: false,
      retryable: false,
      reason: "配置的角色缺少 name_code，无法验证爬取结果",
    };
  }

  if (summary.ownedCharacterCount === 0) {
    return {
      valid: false,
      retryable: true,
      reason: "玩家持有角色列表为空",
    };
  }

  // 玩家确实有角色，只是没有持有当前配置中的任何角色；这是合法空结果。
  if (summary.requestedCharacterCount === 0) {
    return {
      valid: true,
      retryable: false,
      reason: "",
    };
  }

  if (summary.receivedDetailCount === 0) {
    return {
      valid: false,
      retryable: true,
      reason: "已持有的配置角色没有返回任何详情",
    };
  }

  if (summary.populatedCharacterCount === 0) {
    return {
      valid: false,
      retryable: true,
      reason: "角色详情已返回，但没有写入任何配置角色",
    };
  }

  return {
    valid: true,
    retryable: false,
    reason: "",
  };
};

export class EmptyCrawlDataError extends Error {
  constructor(message, validation) {
    super(message);
    this.name = "EmptyCrawlDataError";
    this.code = "EMPTY_CRAWL_DATA";
    this.validation = validation;
  }
}

/**
 * 仅在验证发现异常空数据时重试。网络异常和其他业务错误仍由原流程处理，
 * 避免把确定性错误重复放大。
 */
export const crawlWithEmptyDataRetry = async ({
  crawlOnce,
  retryDelaysMs = EMPTY_CRAWL_RETRY_DELAYS_MS,
  wait = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
  onRetry,
}) => {
  if (typeof crawlOnce !== "function") {
    throw new TypeError("crawlOnce 必须是函数");
  }

  const delays = Array.isArray(retryDelaysMs) ? retryDelaysMs : [];
  const maxAttempts = delays.length + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await crawlOnce({ attempt, maxAttempts });
    const validation = validateCharacterCrawlSummary(
      result?.characterCrawlSummary
    );

    if (validation.valid) {
      return result;
    }

    const canRetry = validation.retryable && attempt < maxAttempts;
    if (!canRetry) {
      const attemptSuffix = validation.retryable
        ? `（已尝试 ${attempt} 次）`
        : "";
      throw new EmptyCrawlDataError(
        `${validation.reason}${attemptSuffix}`,
        validation
      );
    }

    const rawDelayMs = Number(delays[attempt - 1]);
    const delayMs = Number.isFinite(rawDelayMs) && rawDelayMs > 0
      ? rawDelayMs
      : 0;

    if (typeof onRetry === "function") {
      onRetry({
        attempt,
        nextAttempt: attempt + 1,
        maxAttempts,
        delayMs,
        reason: validation.reason,
      });
    }

    await wait(delayMs);
  }

  throw new EmptyCrawlDataError("角色爬取验证失败", {
    valid: false,
    retryable: false,
    reason: "角色爬取验证失败",
  });
};
