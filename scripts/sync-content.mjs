/**
 * sync-content.mjs
 *
 * Triggers the sync-drive-content edge function.
 * Skips files already synced unless --force is passed.
 *
 * Usage:
 *   node scripts/sync-content.mjs           # sync only unsynced files
 *   node scripts/sync-content.mjs --force   # re-fetch all 40 files
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir   = dirname(fileURLToPath(import.meta.url))
const envRaw  = readFileSync(resolve(__dir, '../.env.local'), 'utf8')
const env     = {}
for (const line of envRaw.split('\n')) {
  const t = line.trim(); if (!t || t.startsWith('#')) continue
  const eq = t.indexOf('='); if (eq < 0) continue
  env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim()
}

const SUPABASE_URL     = env['VITE_SUPABASE_URL']
const SERVICE_ROLE_KEY = env['SUPABASE_SERVICE_ROLE_KEY']
const FORCE            = process.argv.includes('--force')

console.log(`\nTriggering sync-drive-content${FORCE ? ' (force)' : ''}…\n`)

const res  = await fetch(`${SUPABASE_URL}/functions/v1/sync-drive-content`, {
  method:  'POST',
  headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
  body:    JSON.stringify({ force: FORCE }),
})

const body = await res.json()

if (!res.ok) {
  console.error('❌  Failed:', body?.error ?? res.status)
  process.exit(1)
}

if (body.message) {
  console.log('✅ ', body.message)
  process.exit(0)
}

const { summary, results } = body
console.log(`Total:   ${summary.total}`)
console.log(`Synced:  ${summary.synced}`)
console.log(`Skipped: ${summary.skipped}`)
console.log(`Errors:  ${summary.errors}\n`)

for (const r of results) {
  const icon = r.status === 'synced' ? '✓' : r.status === 'error' ? '✗' : '–'
  const detail = r.chars ? ` (${r.chars.toLocaleString()} chars)` : r.error ? ` — ${r.error}` : ''
  console.log(` ${icon} [${r.status}] ${r.name}${detail}`)
}
