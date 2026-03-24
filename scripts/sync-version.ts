#!/usr/bin/env bun
/**
 * Reads version from package.json and syncs it to:
 *   - src-tauri/tauri.conf.json  (used by Tauri installer / app title bar)
 *   - src-tauri/Cargo.toml       (must match tauri.conf.json for cargo build)
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const root = resolve(import.meta.dir, "..");

const pkgPath = resolve(root, "package.json");
const { version } = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version: string };

// ── tauri.conf.json ──────────────────────────────────────────────────────────
const tauriConfPath = resolve(root, "src-tauri/tauri.conf.json");
const tauriConf = JSON.parse(readFileSync(tauriConfPath, "utf-8"));
tauriConf.version = version;
writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + "\n");

// ── Cargo.toml ───────────────────────────────────────────────────────────────
const cargoPath = resolve(root, "src-tauri/Cargo.toml");
const cargo = readFileSync(cargoPath, "utf-8").replace(
  /^version\s*=\s*"[^"]*"/m,
  `version = "${version}"`
);
writeFileSync(cargoPath, cargo);

console.log(`[sync-version] ${version} → tauri.conf.json, Cargo.toml`);
