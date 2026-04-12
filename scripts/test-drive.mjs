/**
 * test-drive.mjs
 *
 * Proves the Google service account can authenticate and list Drive files.
 * No Edge Functions, no Supabase, no extra npm packages.
 * Requires Node.js 18+ (native fetch + crypto).
 *
 * Run: node scripts/test-drive.mjs
 */

import { readFileSync } from 'fs'
import { createSign }   from 'crypto'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// ── Load .env.local ───────────────────────────────────────────────────────────

const __dir    = dirname(fileURLToPath(import.meta.url))
const envPath  = resolve(__dir, '../.env.local')
const envLines = readFileSync(envPath, 'utf8').split('\n')
const env      = {}

for (const line of envLines) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eq  = trimmed.indexOf('=')
  if (eq < 0) continue
  const key = trimmed.slice(0, eq).trim()
  const val = trimmed.slice(eq + 1).trim()
  env[key]  = val
}

const b64 = env['GOOGLE_SERVICE_ACCOUNT_B64']
if (!b64) {
  console.error('❌  GOOGLE_SERVICE_ACCOUNT_B64 not found in .env.local')
  process.exit(1)
}

// ── Decode service account ────────────────────────────────────────────────────

let creds
try {
  const json = Buffer.from(b64, 'base64').toString('utf8')
  creds = JSON.parse(json)
  console.log('✅  Service account decoded successfully')
  console.log('    client_email:', creds.client_email)
  console.log('    project_id:  ', creds.project_id)
  console.log('    token_uri:   ', creds.token_uri)
} catch (err) {
  console.error('❌  Failed to decode/parse service account JSON:', err.message)
  process.exit(1)
}

// ── Build JWT ─────────────────────────────────────────────────────────────────

function base64url(str) {
  return Buffer.from(str).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const now = Math.floor(Date.now() / 1000)

const header  = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
const payload = base64url(JSON.stringify({
  iss:   creds.client_email,
  scope: 'https://www.googleapis.com/auth/drive.readonly',
  aud:   creds.token_uri,
  iat:   now,
  exp:   now + 3600,
}))

const signingInput = `${header}.${payload}`

// Node crypto — straightforward, no Web Crypto gymnastics needed
let privateKey = creds.private_key
// Handle literal \n sequences (can appear when JSON is stored in env)
if (privateKey.includes('\\n')) privateKey = privateKey.replace(/\\n/g, '\n')

let signature
try {
  const sign = createSign('RSA-SHA256')
  sign.update(signingInput)
  sign.end()
  signature = sign.sign(privateKey, 'base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  console.log('✅  JWT signed successfully')
} catch (err) {
  console.error('❌  JWT signing failed:', err.message)
  console.error('    Private key starts with:', privateKey.slice(0, 50))
  process.exit(1)
}

const jwt = `${signingInput}.${signature}`

// ── Exchange JWT for access token ─────────────────────────────────────────────

console.log('\n⏳  Exchanging JWT for Google access token…')

let accessToken
try {
  const tokenRes = await fetch(creds.token_uri, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })

  const tokenBody = await tokenRes.json()

  if (!tokenRes.ok) {
    console.error('❌  Token exchange failed:', JSON.stringify(tokenBody, null, 2))
    process.exit(1)
  }

  accessToken = tokenBody.access_token
  console.log('✅  Access token obtained (expires in', tokenBody.expires_in, 'seconds)')
} catch (err) {
  console.error('❌  Token exchange network error:', err.message)
  process.exit(1)
}

// ── List Drive files ──────────────────────────────────────────────────────────

const SUPPORTED_TYPES = [
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.spreadsheet',
  'application/vnd.google-apps.presentation',
  'text/plain',
  'text/markdown',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

const q = `trashed = false and (${SUPPORTED_TYPES.map((t) => `mimeType = '${t}'`).join(' or ')})`

console.log('\n⏳  Listing accessible Drive files…')

try {
  const url = new URL('https://www.googleapis.com/drive/v3/files')
  url.searchParams.set('pageSize', '50')
  url.searchParams.set('fields',   'files(id,name,mimeType,modifiedTime,parents)')
  url.searchParams.set('q', q)

  const driveRes  = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const driveBody = await driveRes.json()

  if (!driveRes.ok) {
    console.error('❌  Drive API error:', JSON.stringify(driveBody, null, 2))
    process.exit(1)
  }

  const files = driveBody.files ?? []

  if (files.length === 0) {
    console.log('⚠️   No files found. The service account may not have access to any files yet.')
    console.log('     Make sure you shared specific files or folders with:')
    console.log('    ', creds.client_email)
  } else {
    console.log(`✅  Found ${files.length} file(s):\n`)
    for (const f of files) {
      const type = f.mimeType.replace('application/vnd.google-apps.', 'Google ')
                             .replace('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'DOCX')
                             .replace('application/pdf', 'PDF')
                             .replace('text/plain', 'TXT')
                             .replace('text/markdown', 'MD')
      console.log(`  📄  ${f.name}`)
      console.log(`       id:       ${f.id}`)
      console.log(`       type:     ${type}`)
      console.log(`       modified: ${f.modifiedTime}`)
      console.log(`       parents:  ${(f.parents ?? []).join(', ') || 'none'}`)
      console.log()
    }
  }
} catch (err) {
  console.error('❌  Drive list error:', err.message)
  process.exit(1)
}
