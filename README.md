<div align="center">
	<img src="https://sg-cdn.blablalink.com/socialmedia/_58913bdbcfe6bf42a8d5e92a0483c9c9d7fc3dfa-1200x1200-ori_s_80_50_ori_q_80.webp" alt="icon" width="200"><br>
	<h1>ExiaInvasion</h1>
</div>
<p align="center">
    <a href="https://github.com/IsolateOB/ExiaInvasion/releases/latest"><img src="https://img.shields.io/github/v/release/IsolateOB/ExiaInvasion?include_prereleases&style=for-the-badge" alt="GitHub release"></a>
    <a href="https://discord.gg/fRW7PbYZAB"><img src="https://img.shields.io/discord/1039859228640288770?label=Discord&logo=discord&logoColor=white&color=5865F2&style=for-the-badge" alt="Discord"></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-GPL3.0-blue.svg?style=for-the-badge" alt="GPL3.0"></a>
</p>

[English](README.en.md)

**ExiaInvasion** 是一个从 [blablalink](https://www.blablalink.com/) 获取个人账号中的 Nikke 人物数据并生成练度表的开源 **浏览器插件**。

## 示例输出

![示例输出](示例输出.png)

## 注意

- 需要 **Edge**、**Chrome** 或其他 **Chromium** 内核浏览器。
- 目前仅能输出简体中文和英文表格。

## 用法

- ### 安装

  解压压缩包，浏览器进入 `chrome://extensions/` 或 `edge://extensions/` 页面，启用 **开发者模式**，点击 **加载已解压的扩展程序**，选择解压后的文件夹。

- ### 更新

  清空插件所在的文件夹，解压新版本插件的压缩包进该文件夹。**请勿重新安装**，否则将丢失已经保存的账号与妮姬。

- ### 主页面

  - #### 爬虫

    - 点击 **管理账号 & 妮姬** 可进入 **管理页**。
    - **合并保存为 ZIP** 将在 **运行** 完毕后，把所有文件合并为一个 ZIP 格式的压缩文件提供下载。
    - **运行时保存 Cookie** 将在 **运行** 时自动保存该账号的 **Cookie**，以便下次运行时跳过登录步骤。保存的 Cookie 可在 **管理账号** 页查看。
    - **导出 JSON** 将在 **运行** 完毕后输出表格的同时，输出用于制表的账号原始数据（包含 `game_uid` 字段）。
    - **运行时激活标签页** 将在 **运行** 时用 **账号密码** 登录时，切换到脚本操作的标签页，主要用于检查错误和手动操作人机验证。
    - **保存当前账号 Cookie** 可保存当前浏览器在 [blablalink](https://www.blablalink.com/) 的登录 Cookie。保存的 Cookie 可在 **管理账号** 页查看。
    - 默认显示简洁日志。**复制完整日志** 和 **下载完整日志** 可获取包含诊断信息的完整日志，诊断日志也会继续输出到浏览器的 `console.debug`。

  - #### 合并

    - 若选择了 Excel，将导出 `merged.xlsx`（排序选项与表格合并一致：名称升/降序，或同步器等级升/降序）。
    - 若选择了 JSON，将导出 `merged.json`（会把多个账号 JSON 简单装进一个数组，并按排序选项排序）。
    - 若两类都选择了，将分别导出两个文件。

- ### 管理页

  - #### 账号

    - 填入并保存 **邮箱** 和 **密码**。
    - 当同时存在 **邮箱**、**密码** 和 **Cookie** 时，将默认使用 **Cookie**。
    - **启用** 开关打开时，**运行** 将获取该行账号的数据。

  - #### 妮姬

    - **优先级** 为主观评级，可自行决定；它将决定该妮姬在表中的背景色。
    - **选择词条** 时，不管是否选择词条都会获取并统计该词条，但未选择的词条将在制表时被隐藏，可自行展开查看。
    - 表格顶部的 **全局输出** 行可以批量控制所有妮姬的同一输出项，支持 **全选、半选和全不选**。

  - #### 设置

    - **400级属性**：开启后，模拟生命、攻击和防御将始终按照 400 级计算；实际同步器等级不会改变。关闭时，模拟属性会按照当前同步器等级及角色数据计算。

## AEL 计算公式

AEL（攻优突破分）用于简洁衡量角色在当前装备与突破下的输出潜力。本项目将该分数写入导出的 JSON 字段 `AtkElemLbScore`，并在表格中显示（可选择隐藏），公式如下。

- ### 公式

	**AEL** = (1 + 0.9 × 攻击词条 ATK%) × (1 + (优越词条 Elem% + 10%)) × (1 + 3% × 极限突破 Limit Break + 2% × 核心强化 Core Refinement)

## 交流/反馈

QQ群：755798635