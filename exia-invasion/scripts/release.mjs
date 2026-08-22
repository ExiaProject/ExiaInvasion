// SPDX-License-Identifier: GPL-3.0-or-later

import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(currentDir);

const runGit = (args, options = {}) => {
  const output = execFileSync("git", args, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
  });
  return typeof output === "string" ? output.trim() : "";
};

const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  cwd: projectRoot,
  encoding: "utf8",
}).trim();

// 解析命令行参数
const rawArgs = process.argv.slice(2).filter((arg) => arg !== "--");
const noPush = rawArgs.includes("--no-push");
const releaseTypeOrVersion = rawArgs.find((arg) => !arg.startsWith("--"));

if (!releaseTypeOrVersion) {
  console.log(`
\x1b[36mExiaInvasion 自动化多分支发布脚本\x1b[0m

\x1b[33m用法:\x1b[0m
  npm run release <patch | minor | major | <x.y.z>> [--no-push]

\x1b[33m示例:\x1b[0m
  npm run release patch            # 升级补丁版本 (例: 3.1.4 -> 3.1.5)
  npm run release minor            # 升级次版本功能 (例: 3.1.4 -> 3.2.0)
  npm run release major            # 升级主版本 (例: 3.1.4 -> 4.0.0)
  npm run release 3.2.0            # 指定特定版本号
  npm run release minor --no-push   # 仅本地升级并合并到 cloud 分支，不推送到远程
`);
  process.exit(1);
}

// 1. 检查当前分支必须为 main
const currentBranch = runGit(["rev-parse", "--abbrev-ref", "HEAD"]);
if (currentBranch !== "main") {
  console.error(`\x1b[31m[错误] 发布脚本必须在 main 分支上执行。当前分支: ${currentBranch}\x1b[0m`);
  process.exit(1);
}

// 2. 检查工作区是否干净
const status = runGit(["status", "--porcelain=v1"]);
if (status) {
  console.error(`\x1b[31m[错误] Git 工作区不干净，请先提交或暂存所有修改后再执行发布：\n${status}\x1b[0m`);
  process.exit(1);
}

// 3. 检查 cloud 分支是否存在
const hasLocalCloud = runGit(["branch", "--list", "cloud"]);
if (!hasLocalCloud) {
  console.log(`\x1b[33m本地未发现 cloud 分支，正在从 origin/cloud 创建本地 tracking 分支...\x1b[0m`);
  runGit(["checkout", "-b", "cloud", "origin/cloud"], { stdio: "inherit" });
  runGit(["checkout", "main"], { stdio: "inherit" });
}

// 4. 执行 npm version
console.log(`\n\x1b[36m[1/4] 正在执行 npm version ${releaseTypeOrVersion}...\x1b[0m`);
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const versionResult = spawnSync(npmCmd, ["version", releaseTypeOrVersion], {
  cwd: projectRoot,
  stdio: "inherit",
  shell: true,
});

if (versionResult.status !== 0) {
  console.error("\x1b[31m[错误] npm version 执行失败。\x1b[0m");
  process.exit(versionResult.status || 1);
}

// 读取新版本号
const packageJson = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8"));
const newVersion = packageJson.version;
const tagName = `v${newVersion}`;
console.log(`\x1b[32m✔ 成功在 main 分支创建版本 commit 与 Tag: ${tagName}\x1b[0m`);

// 5. 单向合并到 cloud 分支
console.log(`\n\x1b[36m[2/4] 切换到 cloud 分支并单向合并 main (${tagName})...\x1b[0m`);
try {
  runGit(["checkout", "cloud"], { stdio: "inherit" });
  runGit(["merge", "main", "-m", `chore(release): merge main ${tagName} into cloud`], {
    stdio: "inherit",
  });
  console.log(`\x1b[32m✔ 成功将 main 合并至 cloud 分支\x1b[0m`);
} catch (err) {
  console.error(`\x1b[31m[错误] 合并 main 到 cloud 时发生冲突，请手动解决后切回 main 分支。\x1b[0m`, err);
  process.exit(1);
} finally {
  runGit(["checkout", "main"], { stdio: "inherit" });
}
console.log(`\x1b[32m✔ 已安全切回 main 分支\x1b[0m`);

// 6. 推送至远程仓库
if (noPush) {
  console.log(`\n\x1b[33m[提示] 检测到 --no-push 参数，已跳过远程推送。\x1b[0m`);
  console.log(`稍后你可以手动执行以下命令推送到远程：`);
  console.log(`  git push origin main cloud`);
  console.log(`  git push origin ${tagName}\n`);
} else {
  console.log(`\n\x1b[36m[3/4] 正在推送 main 和 cloud 分支到远程 origin...\x1b[0m`);
  runGit(["push", "origin", "main", "cloud"], { stdio: "inherit" });

  console.log(`\n\x1b[36m[4/4] 正在推送 Tag ${tagName} 触发 GitHub Release CI...\x1b[0m`);
  runGit(["push", "origin", tagName], { stdio: "inherit" });

  console.log(`\n\x1b[32m🎉 发布成功！Tag ${tagName} 已推送至 GitHub，正在自动触发双版本构建与 Release 发布。\x1b[0m\n`);
}
