<div align="center">
  <img src="public/bitdown.svg" width="80" height="80" alt="BitDown Logo" />

  # BitDown

  **A high-performance BitTorrent client built with Tauri 2 + Rust + React**

  [![Latest Release](https://img.shields.io/github/v/release/YOUR_GITHUB_USERNAME/bitdown?style=for-the-badge&color=0078D4&label=Download%20Installer)](https://github.com/YOUR_GITHUB_USERNAME/bitdown/releases/latest)
  [![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)
  [![Platform](https://img.shields.io/badge/platform-Windows-blue?style=for-the-badge&logo=windows)](https://github.com/YOUR_GITHUB_USERNAME/bitdown/releases/latest)

  ### [⬇ Download Latest Windows Installer](https://github.com/YOUR_GITHUB_USERNAME/bitdown/releases/latest)

  > Click the badge above or the link to go to the **Releases** page, then download the `.exe` setup file.
</div>

---

## Features

- Full BitTorrent engine (librqbit) — DHT, PEX, UPnP, magnet links, .torrent files
- Adaptive HTTP streaming preview of downloading video files (port 54321)
- TMDB integration — auto-fetches poster, rating, year for movies/shows
- RSS feed manager with auto-download filters
- Remote control WebSocket API (port 54322)
- Privacy mode: proxy support, IP blocklists
- Glassmorphic dark theme — black/grey with vivid blue accents
- Tray icon, per-torrent speed graphs, label system

---

## Requirements (to build from source)

| Tool | Version | Notes |
|---|---|---|
| [Node.js](https://nodejs.org/) | 20 LTS+ | Includes npm |
| [Rust](https://rustup.rs/) | stable (1.77+) | Install via rustup |
| [Visual Studio 2022](https://visualstudio.microsoft.com/) | 17.x | Workload: **Desktop development with C++** |
| Windows SDK | 10.0.26100+ | Installed automatically with VS |
| WebView2 Runtime | any | Pre-installed on Windows 11 / Edge |

> **Visual Studio 2026 users:** See [Custom MSVC Config](#custom-msvc-config) below.

---

## Setup (new machine)

```powershell
# 1. Clone the repository
git clone https://github.com/YOUR_GITHUB_USERNAME/bitdown.git
cd bitdown

# 2. Install Node dependencies
npm install

# 3. Copy .env.example → .env and add your TMDB API key
#    (free at https://www.themoviedb.org/settings/api)
Copy-Item .env.example .env
notepad .env

# 4. Run the dev server (first run compiles Rust — takes ~3 min)
npx tauri dev
```

### Build a release installer

```powershell
npx tauri build
# Output: src-tauri\target\release\bundle\nsis\BitDown_*_x64-setup.exe
```

---

## Custom MSVC Config

If you have **Visual Studio 2026** or a conflicting `rustc` on PATH (e.g. from Chocolatey):

```powershell
Copy-Item src-tauri\.cargo\config.toml.example src-tauri\.cargo\config.toml
notepad src-tauri\.cargo\config.toml
```

Edit the paths to match your VS installation. On **VS 2022** with a clean `rustup` install this file is **not needed**.

---

## GitHub Actions — Automatic Releases

Pushing a version tag triggers the workflow which compiles a full Windows installer and uploads it to GitHub Releases automatically.

```powershell
git tag v1.0.1
git push --tags
```

The workflow will:
1. Set the version in `tauri.conf.json` from the tag
2. Compile the full Rust + React app in release mode
3. Create a GitHub Release with the NSIS `.exe` installer attached

### Required GitHub Secret

Go to **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|---|---|
| `TMDB_API_KEY` | Your TMDB API key from themoviedb.org |

---

## Project Structure

```
bitdown/
├── src/                      # React + TypeScript frontend
│   ├── components/           # UI components (Toolbar, Sidebar, TorrentList, …)
│   ├── stores/               # Zustand state (torrentStore, settingsStore)
│   ├── hooks/                # useTauriEvents, etc.
│   └── lib/                  # tauri-commands.ts, types.ts
├── src-tauri/                # Rust backend
│   ├── src/
│   │   ├── engine/           # TorrentManager (librqbit wrapper)
│   │   ├── db/               # SQLite via sqlx
│   │   ├── streaming/        # HTTP byte-range server (port 54321)
│   │   ├── intelligence/     # TMDB metadata client
│   │   ├── rss/              # RSS feed manager
│   │   ├── sync/             # WebSocket remote control (port 54322)
│   │   └── commands/         # Tauri IPC commands
│   └── icons/                # App icons (PNG, ICO)
├── public/
│   └── bitdown.svg           # Toolbar logo
├── .env.example              # Environment variable template
└── .github/workflows/
    └── release.yml           # Auto-release on git tag push
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Tauri 2.11 |
| Backend | Rust 1.77+ / librqbit 8.1.1 |
| Frontend | React 18 / TypeScript / Vite 6 |
| UI | shadcn/ui + Tailwind CSS v3 |
| State | Zustand 5 |
| Database | SQLite via sqlx 0.8 |
| Streaming | axum 0.7 HTTP server |

---

## License

MIT
