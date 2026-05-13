# UnrealHub

**A fast, lightweight, open-source alternative to the Epic Games Launcher for Unreal Engine developers.**

[RU](README.md) | **EN**

Tired of waiting for the Epic Games Launcher to load just to open a project? **UnrealHub** is a focused desktop app built around one job: managing Unreal Engine projects and installed engine versions, fast.

![UnrealHub Screenshot](github-assets/projects-main.png)

## Epic Games Launcher vs UnrealHub

| Feature | Epic Games Launcher | UnrealHub |
|---|---|---|
| **Launch speed** | ~10–15 seconds | **< 1 second** |
| **Focus** | Store & games | **Just your projects** |
| **Telemetry / tracking** | Yes | **No (open source)** |
| **Offline mode** | Clunky | **Native** |

## Why UnrealHub

- **Instant launch.** All your UE projects in one window, one-click to open.
- **No bloat.** No storefronts, no ads, no background trackers.

---

## Features

### Engine management
Automatically discovers every Unreal Engine version installed on the machine. View and manage all of them in a single screen.

Settings includes a **"Find Epic Games / UE"** button that scans the standard install locations (`C:\Program Files\Epic Games`, `D:\Epic Games`, etc.) and adds any engines it finds in one click.

<img src="github-assets/engine-versions.png" width="700">

### Advanced project management
Each project card shows its real disk usage. Right-click context menu lets you clone, delete, wipe `Saved`/`Intermediate`, or create smart **.zip backups** without leaving the app.

<img src="github-assets/context-menu.png" width="700">

### Customization & tags
Override project names and cover art straight from the launcher.
<img src="github-assets/edit-project.png" width="700">

Build your own organization system with tags.
<img src="github-assets/tag-system.png" width="700">

### Developer tools

**Project notes (Markdown supported)**
Jot down ideas, TODOs, and project details directly in the built-in notes panel.
<img src="github-assets/project-notes.png" width="700">

**Task Board (Kanban)**
Built-in drag-and-drop Kanban per project. **Now also available as a dedicated sidebar tab** — a tile grid of every project that has a board, click a tile to open it.
<img src="github-assets/task-board.png" width="700">

**Source control**
- **Git** — commit history and branches visualized inside the app (for projects with `.git`).
- **Diversion** — integration through the local `dv` CLI (commit history, workspace status, branches).
- **Per-project VCS choice**: in Edit Project you can pick *Default / Git / Diversion / Both / None* — only the buttons you want will show up on that project's card.

<img src="github-assets/git-history.png" width="700">

**Plugin & config editor**
Toggle `.uproject` plugins or edit settings like `DefaultEngine.ini` without ever opening the engine.
<img src="github-assets/ini-editor.png" width="700">

### Marketplace & Epic auth
Sign in to Epic Games through a built-in OAuth window, browse your Marketplace library, and download assets to your Vault Cache. No token hassle — auth works out of the box.

---

## Installation

**Download the latest `.exe` from [Releases](../../releases)**

One-click install — download and you're up in seconds.

## Flow Launcher integration
Want even more speed? There's a [Flow Launcher](https://www.flowlauncher.com/) plugin so you can search and open any UE project right from your keyboard via `Alt + Space`.

## Localization
UI in three languages: **English**, **Русский**, **Türkçe**. Switch in Settings → Appearance → Language.

## Development

<details>
<summary>Dev setup</summary>

```bash
# Install dependencies
npm install

# Run in dev mode
npm run dev

# Build the installer
npm run build
```

The installer lands in the `release/` folder.

**Stack:** Electron, React + TypeScript, Vite, TailwindCSS, `simple-git` (Git), native `dv` CLI calls (Diversion), `keytar` (OS keychain for tokens).

</details>

## License
Open source under MIT — fork, modify, ship. This is a personal fork with extra features on top of the original UnrealHub.
