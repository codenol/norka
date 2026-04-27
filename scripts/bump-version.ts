#!/usr/bin/env bun
/**
 * Version bump script — updates all version fields and prepares CHANGELOG.
 *
 * Usage:
 *   bun scripts/bump-version.ts 0.13.0
 *   bun scripts/bump-version.ts patch   # 0.12.0 → 0.12.1
 *   bun scripts/bump-version.ts minor   # 0.12.0 → 0.13.0
 *   bun scripts/bump-version.ts major   # 0.12.0 → 1.0.0
 */

import { readFileSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'

const FILES = {
  pkg: 'package.json',
  tauri: 'desktop/tauri.conf.json',
  changelog: 'CHANGELOG.md',
}

function readJson(path: string) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeJson(path: string, data: object) {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n')
}

function bumpSemver(current: string, bump: string): string {
  const [major, minor, patch] = current.split('.').map(Number)
  if (bump === 'major') return `${major + 1}.0.0`
  if (bump === 'minor') return `${major}.${minor + 1}.0`
  if (bump === 'patch') return `${major}.${minor}.${patch + 1}`
  // treat as explicit version
  if (/^\d+\.\d+\.\d+/.test(bump)) return bump
  throw new Error(`Unknown bump type: ${bump}. Use major | minor | patch | x.y.z`)
}

const arg = process.argv[2]
if (!arg) {
  console.error('Usage: bun scripts/bump-version.ts <major|minor|patch|x.y.z>')
  process.exit(1)
}

const pkg = readJson(FILES.pkg)
const current = pkg.version as string
const next = bumpSemver(current, arg)

if (next === current) {
  console.error(`Version is already ${current}`)
  process.exit(1)
}

// --- package.json ---
pkg.version = next
writeJson(FILES.pkg, pkg)
console.log(`✓ package.json: ${current} → ${next}`)

// --- desktop/tauri.conf.json ---
const tauri = readJson(FILES.tauri)
tauri.version = next
writeJson(FILES.tauri, tauri)
console.log(`✓ desktop/tauri.conf.json: ${current} → ${next}`)

// --- CHANGELOG.md ---
const today = new Date().toISOString().slice(0, 10)
const changelog = readFileSync(FILES.changelog, 'utf8')
const newEntry = `## ${next} — ${today}\n\n### Features\n\n- \n\n### Fixes\n\n- \n`
const updated = changelog.replace('## Unreleased\n', `## Unreleased\n\n${newEntry}`)
writeFileSync(FILES.changelog, updated)
console.log(`✓ CHANGELOG.md: added ## ${next} entry`)

// --- git tag suggestion ---
console.log(`\nNext steps:`)
console.log(`  1. Fill in CHANGELOG.md — ## ${next} section`)
console.log(`  2. git add -A && git commit -m "chore: release v${next}"`)
console.log(`  3. git tag v${next}`)
console.log(`  4. git push && git push --tags`)
