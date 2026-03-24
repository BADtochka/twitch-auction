#!/usr/bin/env bun
/**
 * Usage: bun scripts/bump-version.ts [patch|minor|major]
 * Defaults to patch.
 *
 * Bumps version in package.json, syncs to tauri.conf.json and Cargo.toml,
 * then stages all three files.
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { execSync } from "child_process";

const type = (process.argv[2] ?? "patch") as "patch" | "minor" | "major";
if (!["patch", "minor", "major"].includes(type)) {
  console.error(`Unknown bump type "${type}". Use patch, minor, or major.`);
  process.exit(1);
}

const root = resolve(import.meta.dir, "..");

// ── Bump package.json ────────────────────────────────────────────────────────
const pkgPath = resolve(root, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version: string };
const [maj, min, pat] = pkg.version.split(".").map(Number);
const next =
  type === "major" ? `${maj + 1}.0.0`
  : type === "minor" ? `${maj}.${min + 1}.0`
  : `${maj}.${min}.${pat + 1}`;

pkg.version = next;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

// ── Sync to tauri.conf.json ──────────────────────────────────────────────────
const tauriConfPath = resolve(root, "src-tauri/tauri.conf.json");
const tauriConf = JSON.parse(readFileSync(tauriConfPath, "utf-8"));
tauriConf.version = next;
writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + "\n");

// ── Sync to Cargo.toml ───────────────────────────────────────────────────────
const cargoPath = resolve(root, "src-tauri/Cargo.toml");
const cargo = readFileSync(cargoPath, "utf-8").replace(
  /^version\s*=\s*"[^"]*"/m,
  `version = "${next}"`
);
writeFileSync(cargoPath, cargo);

// ── Stage files ──────────────────────────────────────────────────────────────
execSync("git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml", {
  cwd: root,
  stdio: "inherit",
});

console.log(`Bumped: ${pkg.version.replace(next, "?")} → ${next} (patch was ${type})`);
console.log(`Staged: package.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml`);
