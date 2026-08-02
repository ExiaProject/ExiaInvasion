// SPDX-License-Identifier: GPL-3.0-or-later

export const createLogState = () => ({
  logs: [],
  fullLogs: [],
});

export const appendLogEntry = (state, message, { diagnostic = false } = {}) => ({
  logs: diagnostic ? state.logs : [...state.logs, message],
  fullLogs: [...state.fullLogs, message],
});
