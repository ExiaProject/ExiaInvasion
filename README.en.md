<div align="center">
	<img src="https://sg-cdn.blablalink.com/socialmedia/_58913bdbcfe6bf42a8d5e92a0483c9c9d7fc3dfa-1200x1200-ori_s_80_50_ori_q_80.webp" alt="icon" width="200"><br>
	<h1>ExiaInvasion</h1>
</div>
<p align="center">
    <a href="https://github.com/IsolateOB/ExiaInvasion/releases/latest"><img src="https://img.shields.io/github/v/release/IsolateOB/ExiaInvasion?include_prereleases&style=for-the-badge" alt="GitHub release"></a>
    <a href="https://discord.gg/fRW7PbYZAB"><img src="https://img.shields.io/discord/1039859228640288770?label=Discord&logo=discord&logoColor=white&color=5865F2&style=for-the-badge" alt="Discord"></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-GPL3.0-blue.svg?style=for-the-badge" alt="GPL3.0"></a>
</p>

[简体中文](README.md)

**ExiaInvasion** is an open-source **browser extension** that retrieves Nikke character data from personal accounts on [blablalink](https://www.blablalink.com/) and generates progression tables.

## Example Output

![Example output](示例输出.png)

## Notice

- Requires **Edge**, **Chrome**, or another **Chromium**-based browser.
- Only Simplified Chinese and English tables are currently supported.

## Usage

- ### Installation

  Unzip the package. In your browser, open `chrome://extensions/` or `edge://extensions/`, enable **Developer mode**, click **Load unpacked extension**, and select the extracted folder.

- ### Updates

  Empty the extension folder and extract the new version into it. **Do not reinstall the extension**, or your saved accounts and Nikkes will be lost.

- ### Main Page

  - #### Crawler

    - Click **Manage Accounts & Nikkes** to open the **Management Page**.
    - **Merge and Save as ZIP** merges all generated files into a ZIP archive for download after **Run** finishes.
    - **Save Cookie During Runtime** automatically saves the account's **Cookie** while running, allowing the next run to skip the login step. Saved cookies are visible on the **Management** page.
    - **Export JSON** outputs the raw account data used to generate the table alongside the table after **Run** finishes, including the `game_uid` field.
    - **Activate Tab During Runtime** switches to the tab operated by the script when logging in with an **account and password**. It is mainly useful for checking errors and completing manual human verification.
    - **Save Current Account Cookie** saves the current browser's login Cookie for [blablalink](https://www.blablalink.com/). Saved cookies are visible on the **Management** page.
    - The default view shows concise logs. **Copy Full Logs** and **Download Full Logs** provide diagnostic details, which are also sent to the browser's `console.debug`.

  - #### Merge

    - If Excel files are selected, `merged.xlsx` is exported (using the same sorting options as Excel merging: Name Ascending/Descending or Synchro Level Ascending/Descending).
    - If JSON files are selected, `merged.json` is exported (the JSON files are packed into an array and sorted using the same option).
    - If both types are selected, both files are exported.

- ### Management Page

  - #### Accounts

    - Enter and save **Email** and **Password**.
    - When **Email**, **Password**, and **Cookie** are all present, the **Cookie** is used by default.
    - When the **Enable** switch is on, **Run** fetches data for that account row.

  - #### Nikkes

    - **Priority** is a subjective rating. It determines the background color of the Nikke in the table.
    - When configuring **Stats**, every stat is still collected and counted regardless of whether it is selected. Unselected stats are hidden during table generation and can be expanded for viewing.
    - The **Global output** row at the top of the table controls the same output field for all Nikkes at once. Each checkbox supports **checked, indeterminate, and unchecked** states.

  - #### Settings

    - **Level 400 Stats**: when enabled, simulated HP, ATK, and DEF are always calculated at level 400; the actual Synchro level is unchanged. When disabled, simulated stats use the current Synchro level and character data.

## AEL Formula

AEL (Attack Element Limit Break Score) is a compact metric for evaluating a character's output potential with its current gear and limit break. The score is exported as `AtkElemLbScore` in JSON and can be shown or hidden in the sheet.

- ### Formula

	**AEL** = (1 + 0.9 × ATK% from attack stats) × (1 + (Elem% from element-advantage stats + 10%)) × (1 + 3% × Limit Break + 2% × Core Refinement)
