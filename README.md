<div align="center">
	<img src="https://sg-cdn.blablalink.com/socialmedia/_58913bdbcfe6bf42a8d5e92a0483c9c9d7fc3dfa-1200x1200-ori_s_80_50_ori_q_80.webp" alt="icon" width="200"><br>
	<h1>ExiaInvasion</h1>
</div>
<p align="center">
    <a href="https://github.com/IsolateOB/ExiaInvasion/releases/latest"><img src="https://img.shields.io/github/v/release/IsolateOB/ExiaInvasion?include_prereleases&style=for-the-badge" alt="GitHub release"></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-GPL3.0-blue.svg?style=for-the-badge" alt="GPL3.0"></a>
</p>

[English](README.en.md)

**ExiaInvasion** 是一个从 [blablalink](https://www.blablalink.com/) 获取个人账号中的 Nikke 人物数据并生成练度表的开源 **浏览器插件**。

## 版本说明与分支策略

本项目从 v3.2.0 开始实行 **双版本 / 双分支** 维护策略，每次 Release 均提供两个构建版本供用户按需选择：

| 版本名称 | 代码分支 | 发布安装包 | 说明 |
| :--- | :--- | :--- | :--- |
| **纯本地版（推荐）** | `main` | `ExiaInvasion.v*.zip` | **默认版本**。100% 纯本地运行，源码中彻底剔除所有远程云同步与敏感数据上传逻辑。账号、密码与 Cookie 严格保存在浏览器本地（`chrome.storage.local`）。 |
| **云端同步版** | `cloud` | `ExiaInvasion.v*-cloud.zip` | **兼容旧功能版本**。保留了与远程服务器（`backend.nikke-exia.com`）的账号与角色模板的**可选**云同步功能。仅供有云同步需求的用户在自担风险的前提下使用。 |

> 如果不手动开启（注册、登录、并手动开启同步）云端版本的同步功能，则云端版本与纯本地版本表现完全相同。

## 数据隐私说明

- 默认版本（main）：
- 所有数据（账号、密码、cookie、角色数据等）均保存在本地。
	
	- 获取账号数据时会连接到blablalink。
	- 检测更新时会连接到github。
	- 除此之外不会有任何与外部的通信。

- 云端同步版（cloud）：
  - 未登录账号的情况下：与默认版本完全相同。
	- 登录账号的情况下：
		- 默认版本所有的网络活动外，还会连接到[backend.nikke-exia.com](https://backend.nikke-exia.com)以同步账号列表(不含账号、密码。包含cookie)和妮姬模板。
		- 当手动开启账号/密码同步时，会还会同步账号和密码。
  - 服务后端的源码参见 [ExiaBackend](https://github.com/ExiaProject/ExiaBackend)
>  - **本项目维护者不会继续维护后端服务器/源码。**
>  - **本项目维护者也不会继续维护本项目中的云同步功能的更新。**
>  - **本项目维护者对账号/密码/Cookie丢失或被盗等任何风险不承担责任。**


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
    - **导出 JSON** 将在 **运行** 完毕后输出表格的同时，输出用于制表的账号原始 json 格式的数据。
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

## 声明

本项目与 NIKKE 游戏或其开发商或发行商没有任何隶属关系。
本项目使用的所有图标、角色立绘、背景图等素材均属于 Shift Up 所有，不受 GPL-3.0 协议约束。 

本项目的运行可能违反 NIKKE 游戏的用户协议。

项目开发者和维护者不对因使用本项目或与本项目相关的任何事件导致的任何损失承担责任。

## 交流/反馈

QQ群：755798635