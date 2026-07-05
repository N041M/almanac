# @almanac/desktop — Tauri shell

The desktop client. A thin [Tauri](https://tauri.app) host that loads the shared
Vite/React renderer (`@almanac/web`) in the OS-native webview — low memory,
small binary (decision D3). All logic stays in the platform-agnostic core.

## Prerequisites

Native builds need the **Rust toolchain** (not bundled): install via
[rustup](https://rustup.rs), plus the OS webview deps Tauri lists for your
platform. The JS side needs `pnpm install` at the repo root.

## Run / build

```sh
# from the repo root
pnpm --filter @almanac/desktop dev     # launches the app (builds the web renderer first)
pnpm --filter @almanac/desktop build   # produces a native bundle
```

`tauri.conf.json` wires the web renderer: `beforeDevCommand`/`beforeBuildCommand`
build `@almanac/web`, `frontendDist` points at its `dist/`, and `devUrl` at its
dev server (`http://localhost:5173`).

## Not yet done

- App icons (`src-tauri/icons/`) — generate with `pnpm --filter @almanac/desktop tauri icon <png>`.
- A native `StoragePort` adapter (SQLite/filesystem) to replace the web
  `localStorage` adapter for the desktop build.
