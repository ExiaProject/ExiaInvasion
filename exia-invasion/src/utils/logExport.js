// SPDX-License-Identifier: GPL-3.0-or-later

export const formatLogText = (logs) => (
  Array.isArray(logs) ? logs.join("\n") : ""
);

export const createLogFilename = (date = new Date()) => {
  const iso = new Date(date).toISOString();
  const [day, time] = iso.split("T");
  const timestamp = `${day.replace(/-/g, "")}-${time.slice(0, 8).replace(/:/g, "")}`;
  return `exia-invasion-log-${timestamp}.txt`;
};
