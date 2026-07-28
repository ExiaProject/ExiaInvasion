// SPDX-License-Identifier: GPL-3.0-or-later

import { execFileSync, spawnSync } from "node:child_process";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const lifecycleStage = process.argv[2];
const version = process.env.npm_new_version;
const versionParts = typeof version === "string" ? version.split(".") : [];
const isValidVersion =
  versionParts.length === 3 &&
  versionParts.every(
    (part) => /^(0|[1-9][0-9]*)$/.test(part) && Number(part) <= 65535,
  );

if (lifecycleStage !== "pre" && lifecycleStage !== "post") {
  throw new Error("Expected lifecycle stage \"pre\" or \"post\".");
}

if (!isValidVersion) {
  throw new Error(
    "npm_new_version must match MAJOR.MINOR.PATCH with each part no greater than 65535. Run this through npm version.",
  );
}

const runGit = (args, options = {}) => {
  const output = execFileSync("git", args, {
    cwd: options.cwd ?? projectRoot,
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
  });

  return typeof output === "string" ? output.trim() : "";
};

const gitSucceeds = (args, cwd) =>
  spawnSync("git", args, {
    cwd,
    stdio: "ignore",
  }).status === 0;

const repoRoot = runGit(["rev-parse", "--show-toplevel"]);
const tagName = `v${version}`;
const tagRef = `refs/tags/${tagName}`;

if (lifecycleStage === "pre") {
  const status = runGit(["status", "--porcelain=v1", "--untracked-files=all"], {
    cwd: repoRoot,
  });

  if (status) {
    throw new Error(
      `Git worktree must be clean before releasing ${tagName}:\n${status}`,
    );
  }

  if (gitSucceeds(["rev-parse", "--verify", "--quiet", tagRef], repoRoot)) {
    throw new Error(`Git tag ${tagName} already exists.`);
  }

  console.log(`Git worktree is clean and ${tagName} is available.`);
  process.exit(0);
}

const status = runGit(["status", "--porcelain=v1", "--untracked-files=all"], {
  cwd: repoRoot,
});
const tagExists = gitSucceeds(
  ["rev-parse", "--verify", "--quiet", tagRef],
  repoRoot,
);

if (tagExists) {
  const head = runGit(["rev-parse", "HEAD"], { cwd: repoRoot });
  const tagCommit = runGit(["rev-list", "-n", "1", tagRef], {
    cwd: repoRoot,
  });

  if (status || tagCommit !== head) {
    throw new Error(
      `${tagName} exists, but it does not describe a clean current HEAD.`,
    );
  }

  console.log(`${tagName} was already committed and tagged by npm.`);
  process.exit(0);
}

const toRepoPath = (path) => relative(repoRoot, path).split(sep).join("/");
const expectedFiles = [
  toRepoPath(join(projectRoot, "package.json")),
  toRepoPath(join(projectRoot, "package-lock.json")),
  toRepoPath(join(projectRoot, "public", "manifest.json")),
].sort();
const stagedFiles = runGit(["diff", "--cached", "--name-only"], {
  cwd: repoRoot,
})
  .split(/\r?\n/)
  .filter(Boolean)
  .sort();
const unstagedFiles = runGit(["diff", "--name-only"], {
  cwd: repoRoot,
})
  .split(/\r?\n/)
  .filter(Boolean);
const untrackedFiles = runGit(["ls-files", "--others", "--exclude-standard"], {
  cwd: repoRoot,
})
  .split(/\r?\n/)
  .filter(Boolean);

if (
  stagedFiles.length !== expectedFiles.length ||
  stagedFiles.some((path, index) => path !== expectedFiles[index]) ||
  unstagedFiles.length > 0 ||
  untrackedFiles.length > 0
) {
  throw new Error(
    [
      `Refusing to create ${tagName}; the release changes are not exactly the expected version files.`,
      `Expected staged: ${expectedFiles.join(", ")}`,
      `Actual staged: ${stagedFiles.join(", ") || "<none>"}`,
      `Unstaged: ${unstagedFiles.join(", ") || "<none>"}`,
      `Untracked: ${untrackedFiles.join(", ") || "<none>"}`,
    ].join("\n"),
  );
}

runGit(["commit", "-m", `chore(release): ${tagName}`], {
  cwd: repoRoot,
  stdio: "inherit",
});
runGit(["tag", "-a", tagName, "-m", tagName], {
  cwd: repoRoot,
  stdio: "inherit",
});

console.log(`Created release commit and annotated tag ${tagName}.`);
