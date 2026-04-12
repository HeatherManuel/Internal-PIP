/**
 * sync-drive-content — Supabase Edge Function
 *
 * Reads 40 specific Google Drive files by hardcoded ID, extracts their text,
 * and upserts into the drive_content table as plain text.
 *
 * No embeddings. No WASM. No vector operations.
 * Simple: authenticate → fetch file text → store it.
 *
 * POST /functions/v1/sync-drive-content
 * Body (optional): { force?: boolean }
 *   force=true  — re-fetch and overwrite all files even if already synced
 *   force=false — skip files that already have raw_text (default)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── CORS ──────────────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ── Canonical file list ───────────────────────────────────────────────────────
// File IDs sourced directly from Google Drive via Supabase drive_file_config.
// content_type: voice_training | curriculum_reference | market_research

const FILES = [
  // ICA / Market Research
  { id: '1CIZVSPdQINN_vG33TS1GU8elqAv9gHBWCdu37GyCPMM', name: 'PPS RLCEO | Ashley Thomas',                                            type: 'market_research'      },

  // Voice Training
  { id: '1OEXahf54cJFprxZoWF_mw5Hsq90QurHG3yvyss8Td3Y', name: '2024/25 Emails Sent out',                                              type: 'voice_training'       },
  { id: '1pspy_SabxYiWF6OEZ4HA1IHz6B_rlb0v4R4HinMjbPQ', name: '2026 Emails',                                                          type: 'voice_training'       },
  { id: '1Y-18khXtpcxV7xQge7-ux6tRQtpqG3ArLw4kY44INyU', name: '2026 Salon Owner syllabus Email sequence',                             type: 'voice_training'       },
  { id: '1V1gd9orKH3kiBx9xl3aPv_WPd8-_lQRE6xrp5d88vPE', name: 'Captions',                                                             type: 'voice_training'       },
  { id: '14FpZpn1DG-f0Y4SDULiiQzCpKBYzzR4JrDH1vj1LIu4', name: 'HM owned FB Ad Scripts',                                              type: 'voice_training'       },

  // Curriculum Reference
  { id: '1W8V-YbrmgfwNOSrYSaJcwLbmZzAKYKnCNc7oBij0Lcs', name: 'Owners Behind The Chair',                                             type: 'curriculum_reference' },
  { id: '1A5f0nNbAsE_QiwfVCnH14ZO9Wb7AZ21GcGP5NS6Xk-o', name: 'Small Teams Communication',                                           type: 'curriculum_reference' },
  { id: '1-Tv4_GZz9bt10i-oT34pADBRjuV5CsTgvrSMetT-4bQ', name: 'Bechmarks to know like the back of your hand',                        type: 'curriculum_reference' },
  { id: '1spSXAaiQ4WkqhIthq-C8czTy2SvI6SjFRQtDqdMXkdI', name: 'Breakthroughs in Communication',                                      type: 'curriculum_reference' },
  { id: '1_ZYmYYu-ScEXDSLK6mUyB-PRA1X7wSiJXCs8w1rq2TM', name: 'Building out your Training Program',                                  type: 'curriculum_reference' },
  { id: '19X0Wrx495l6P8xyfo2LmolepuGIH2CJwSpAY0r4FP3k', name: 'Cancellation Guideline',                                               type: 'curriculum_reference' },
  { id: '1U1S8zEdWuJJWhryJwl6yAlK8Ce2jofwrTZ-Ue_wsZmo', name: 'Content Examples that make up a training program',                    type: 'curriculum_reference' },
  { id: '1V3m0HYtSzzsTnL0eE0gwouFsYsSVLP1sBmIK6HqAsJE', name: 'Front Desk Job description / Leadership role',                        type: 'curriculum_reference' },
  { id: '19zW4Vg6uIUJoPRVdJOqGsbC6WEtsoUHsOQS9TauepLE', name: 'GHT Career Path (1)',                                                  type: 'curriculum_reference' },
  { id: '1ryptKiJow_5k-9HJF2LwzydUi8Sqsey2pr453RWisQc', name: 'GHT Career Path (2)',                                                  type: 'curriculum_reference' },
  { id: '1lxnqrfpcHEyG5LHych8dRlc5fq0OPNaOWqmaIH62YVc', name: 'GHT Career Path (3)',                                                  type: 'curriculum_reference' },
  { id: '1tFxSkEPwhxT_vzBJYLANO51rWmKKibSYFAKMKRwTqaU', name: 'How to get a ton of Leads from the school in 1 visit',                type: 'curriculum_reference' },
  { id: '1-IlWVxBQ4N293Thx38h6lM-5QEidDOKAn76UWPXSJE4', name: 'Little to No revenue available for hiring?',                          type: 'curriculum_reference' },
  { id: '1wGShgwh0DqzVKh6h-M0S3TxuxpHrRV-PG9ljTmVy9KA', name: 'Making our first distributions (1)',                                  type: 'curriculum_reference' },
  { id: '1QuJ5z5LW13ybJgCYC70yyMWyXIHxLZqMhQAJhSXyvJ8', name: 'Making our first distributions (2)',                                  type: 'curriculum_reference' },
  { id: '1vZw_iqcmbwA1J0RMqKMzSVRbg0T2GeP-8AwJrt8FEdg', name: 'Making our first distributions (3)',                                  type: 'curriculum_reference' },
  { id: '1KxdgGGDIotoawnDc_KU_3H7pVTe7BDSSKGOOO7-oSLQ', name: 'Monthly & Quarterly meetings to implement',                            type: 'curriculum_reference' },
  { id: '1Go7I1p6Op8pe2DLF9sGrqAg3ZARuYIzNv7cIvBAIVC0', name: 'Operation Mastery (1)',                                                type: 'curriculum_reference' },
  { id: '1zIQa73FYq5qFH4S3neFAcWF_80pOIKpX7tx4Q1uiDig', name: 'Operation Mastery (2)',                                                type: 'curriculum_reference' },
  { id: '1awqY_THCvgE3jTBiL-FSpCBzk8fTDJ-B6mBTwIjUAbk', name: 'Operationalizing Core Values (1)',                                    type: 'curriculum_reference' },
  { id: '1HtwbyY7NK4ELoW-G96Q0eza6ujZKg3SGVsJzPIBMCSo', name: 'Operationalizing Core Values (2)',                                    type: 'curriculum_reference' },
  { id: '1puzPY7snt1TmyRACHjSFzSDpBtPYo3sMKRAM3zT-a5E', name: 'Overview of the Company Expense sheet',                               type: 'curriculum_reference' },
  { id: '1xYEPY1Ty9kGrIuQ7kqJ1ZC0Vao7-VFMYW1Bq2qQ111U', name: 'Owners Behind The Chair (2)',                                         type: 'curriculum_reference' },
  { id: '1Ez-DApRF7uVklUrZ8DAmWcid621d2y1vL41J-iVnuEQ', name: 'Owners Behind The Chair (3)',                                          type: 'curriculum_reference' },
  { id: '1I73K_Rx1SpBgt0yWsX_T-boug-TTSrRijQuABLFWsBw', name: 'Past Video Script Examples',                                           type: 'curriculum_reference' },
  { id: '1xmJIYF7xm958tR5S9dSGDfdfRWlHZcnRVRaQKiEMCZY', name: 'Priming Rituals & Daily Tracker',                                     type: 'curriculum_reference' },
  { id: '1YkboB3HA2Yp3We0DFoXKDJd5Lyypd-rHme8FOYND6E0', name: 'Profit off the Top',                                                  type: 'curriculum_reference' },
  { id: '1mkJ1diPePXI-AtvGlXphCea7hA1BjtOGTW42bDvVjmc', name: 'RLCEO Inventory and Budgeting (1)',                                    type: 'curriculum_reference' },
  { id: '1rLc_0eDhwq-EacZ2Rz1jxsSXsY1U-yCyQ9RvM5aQyCc', name: 'RLCEO Inventory and Budgeting (2)',                                    type: 'curriculum_reference' },
  { id: '1EtsucvqfBv_ucZjqepeLBM6z3wtj-cxSYTzg5C4pPx0', name: 'The A Method Auditioning process',                                    type: 'curriculum_reference' },
  { id: '1cx_ogwY3tJJb9zNeUSM2ysCNePPOJgiBtg5NTW66gu0', name: 'The Who How and When to Evaluating a Career Path (1)',                 type: 'curriculum_reference' },
  { id: '1LFLcGxttoluLsrEuY3gV0-y_RrFL2w9KeA4c-zChJsg', name: 'The Who How and When to Evaluating a Career Path (2)',                 type: 'curriculum_reference' },
  { id: '1_E-wFkaP6FtrGD3q8oXQYmaeDc9t48aAZ_zl26xrI1E', name: 'Training Shifts',                                                     type: 'curriculum_reference' },
  { id: '1V7ngzAj_IHyffG6Ptd5rZfCyb3sNiUGCV_ccGcm6f18', name: 'Why you should hire in Clusters and how to afford it',                type: 'curriculum_reference' },
] as const

// ── Google Auth ───────────────────────────────────────────────────────────────

interface ServiceAccountCredentials {
  client_email: string
  private_key:  string
  token_uri:    string
}

function parseCredentials(): ServiceAccountCredentials {
  const b64 = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_B64')
  if (!b64) throw new Error('GOOGLE_SERVICE_ACCOUNT_B64 env var is missing')
  return JSON.parse(atob(b64)) as ServiceAccountCredentials
}

async function getGoogleAccessToken(creds: ServiceAccountCredentials): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const claim = {
    iss:   creds.client_email,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud:   creds.token_uri,
    iat:   now,
    exp:   now + 3600,
  }

  const pem      = creds.private_key.replace(/\\n/g, '\n')
  const pemBody  = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, '')
  const keyBytes = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0))

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyBytes.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign'],
  )

  const b64url = (s: string) =>
    btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  const header  = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = b64url(JSON.stringify(claim))
  const input   = `${header}.${payload}`

  const sig    = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(input))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  const res = await fetch(creds.token_uri, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${input}.${sigB64}`,
  })
  if (!res.ok) throw new Error(`Google token exchange failed: ${await res.text()}`)
  const { access_token } = await res.json()
  return access_token as string
}

// ── Drive text extraction ─────────────────────────────────────────────────────

const GOOGLE_WORKSPACE_EXPORT: Record<string, string> = {
  'application/vnd.google-apps.document':     'text/plain',
  'application/vnd.google-apps.spreadsheet':  'text/csv',
  'application/vnd.google-apps.presentation': 'text/plain',
}

async function extractText(fileId: string, token: string): Promise<string | null> {
  const auth = { headers: { Authorization: `Bearer ${token}` } }

  // Get file metadata to determine mime type
  const metaRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType`,
    auth,
  )
  if (!metaRes.ok) {
    console.warn(`[sync] metadata fetch failed for ${fileId}: ${metaRes.status}`)
    return null
  }
  const meta = await metaRes.json() as { id: string; name: string; mimeType: string }

  // Google Workspace docs → export as plain text
  const exportMime = GOOGLE_WORKSPACE_EXPORT[meta.mimeType]
  if (exportMime) {
    const exportUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportMime)}`
    const res = await fetch(exportUrl, auth)
    if (!res.ok) {
      console.warn(`[sync] export failed for ${meta.name}: ${res.status}`)
      return null
    }
    return res.text()
  }

  // Plain text / markdown → download directly
  if (meta.mimeType === 'text/plain' || meta.mimeType === 'text/markdown') {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      auth,
    )
    if (!res.ok) return null
    return res.text()
  }

  // PDF / DOCX → Drive can export these as plain text too
  if (
    meta.mimeType === 'application/pdf' ||
    meta.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const exportUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text%2Fplain`
    const res = await fetch(exportUrl, auth)
    if (!res.ok) return null
    return res.text()
  }

  console.warn(`[sync] unsupported mime type for ${meta.name}: ${meta.mimeType}`)
  return null
}

// ── Main Handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    let force = false
    try { force = (await req.json()).force ?? false } catch { /* empty body ok */ }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Skip files that are already synced (unless force=true)
    let toSync = [...FILES]
    if (!force) {
      const { data: existing } = await supabase
        .from('drive_content')
        .select('file_id')
        .not('raw_text', 'is', null)
        .not('error', 'is', null)  // re-sync errored files

      // Actually: skip only successfully synced files
      const { data: synced } = await supabase
        .from('drive_content')
        .select('file_id')
        .not('raw_text', 'is', null)
        .is('error', null)

      const syncedIds = new Set((synced ?? []).map((r: { file_id: string }) => r.file_id))
      toSync = FILES.filter((f) => !syncedIds.has(f.id))
      console.log(`[sync] ${syncedIds.size} already synced, ${toSync.length} to process`)
    } else {
      console.log(`[sync] force=true — re-syncing all ${FILES.length} files`)
    }

    if (toSync.length === 0) {
      return respond({ message: 'All files already synced.', synced: 0, errors: 0 })
    }

    // Authenticate with Google
    const creds = parseCredentials()
    const token = await getGoogleAccessToken(creds)

    const results: Array<{ fileId: string; name: string; status: string; chars?: number; error?: string }> = []

    for (const file of toSync) {
      console.log(`[sync] Extracting: ${file.name}`)
      try {
        const text = await extractText(file.id, token)

        if (!text || text.trim().length < 50) {
          console.warn(`[sync] Too short or empty: ${file.name}`)
          await supabase.from('drive_content').upsert({
            file_id:      file.id,
            file_name:    file.name,
            content_type: file.type,
            raw_text:     null,
            error:        'Empty or too short after extraction',
            updated_at:   new Date().toISOString(),
          }, { onConflict: 'file_id' })
          results.push({ fileId: file.id, name: file.name, status: 'skipped' })
          continue
        }

        await supabase.from('drive_content').upsert({
          file_id:      file.id,
          file_name:    file.name,
          content_type: file.type,
          raw_text:     text.trim(),
          error:        null,
          synced_at:    new Date().toISOString(),
          updated_at:   new Date().toISOString(),
        }, { onConflict: 'file_id' })

        console.log(`[sync] ✓ ${file.name} — ${text.length} chars`)
        results.push({ fileId: file.id, name: file.name, status: 'synced', chars: text.length })

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[sync] ✗ ${file.name}:`, msg)
        await supabase.from('drive_content').upsert({
          file_id:      file.id,
          file_name:    file.name,
          content_type: file.type,
          raw_text:     null,
          error:        msg,
          updated_at:   new Date().toISOString(),
        }, { onConflict: 'file_id' })
        results.push({ fileId: file.id, name: file.name, status: 'error', error: msg })
      }
    }

    const summary = {
      total:   results.length,
      synced:  results.filter((r) => r.status === 'synced').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      errors:  results.filter((r) => r.status === 'error').length,
    }

    console.log('[sync] Done:', summary)
    return respond({ summary, results })

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[sync] Fatal:', message)
    return respond({ error: message }, 500)
  }
})
