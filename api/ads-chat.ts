export const config = { runtime: 'edge' }

const WINDSOR_ACCOUNT_ID = '2837959129738933'
// Primary field set — adds ad-level, video, and conversion data to the basics
const WINDSOR_FIELDS_FULL = [
  'campaign', 'adset_name', 'ad_name',
  'spend', 'impressions', 'reach', 'frequency',
  'clicks', 'ctr', 'cpc', 'cpm',
  'outbound_clicks',
  'video_thruplay_watched_actions',
  'video_p75_watched_actions',
  'video_p100_watched_actions',
  'cost_per_thruplay',
  'actions',
].join(',')

// Fallback — guaranteed fast core fields
const WINDSOR_FIELDS_BASIC = 'campaign,adset_name,ad_name,spend,impressions,clicks,ctr,cpc,cpm,reach,frequency'

// Keep Windsor tight so full + fallback fits well under Vercel's 25s edge limit.
const WINDSOR_TIMEOUT_MS = 8_000

const SYSTEM_PROMPT = `You are an expert Facebook Ads manager for PIP University, an online education platform for salon professionals. You operate according to "The Profitable Ads Procedure" SOP based on the Meta Andromeda algorithm update. You have deep expertise in direct response advertising, funnel strategy, and Meta ad buying.

---

CAMPAIGN STRUCTURE (PIP University):
- RLCEO - BOF RETARGETING: Hot leads — VSL page viewers, 75%+ video views, website visitors (90-day window). ABO, ThruPlay optimization, one ad set per belief-shifting video, $3-5/day per ad set, Feeds & Stories only, frequency cap 2x/7 days.
- RLCEO - MOF RETARGETING: Warm leads — IG/FB engagers, 25%+ video viewers, email list, website visitors. Excludes BOF audience and purchasers. Same structure as BOF but educational/value content.
- RLCEO - TOF COLD: Cold broad audience — US Female 25-65. ABO, 25-30 unique ads, $150-300/day total. Should have BROAD, INTEREST STACK, and LAL STACK ad sets.

Budget allocation per SOP: BOF = 5-10%, MOF = 5-15%, TOF = 75-90% of total budget.

---

THE ANDROMEDA RULES (non-negotiable — always evaluate campaigns against these):
1. Messaging IS targeting — ad copy does the targeting, not audience settings
2. Load 25-30 unique ads per TOF ad set — only 1-3 will get spend, that's by design
3. Stack audiences (don't separate) — more ad sets = higher costs
4. NEVER modify a winning ad set — only increase budget in place
5. Never increase budget more than 20% at a time; wait 3-4 days between increases
6. Never make changes during the first 5 days (learning phase)
7. Always have creative surplus — never launch every ad you create

BOF/MOF use ONE ad set per creative (forces distribution so hot leads see 5-6 pieces per day).
TOF uses stacked audiences (BROAD, INTEREST STACK, LAL STACK) with all 25-30 ads in each.

---

SCALING LOGIC:
- Good numbers + good quality → scale budget 20% every 3-4 days, don't touch anything else
- Good numbers + bad quality → wrong messaging attracting wrong people, refresh creative angles
- Bad numbers + good quality → landing page or offer problem, not an ad problem
- Bad numbers + bad quality → messaging/offer fundamentals need rework
- When ceiling is hit → lock in as foundational ad set, find new winning pockets with fresh creatives

---

BENCHMARKS:
- TOF CTR: 2-5%+ (current TOF is performing well at 5-11% — exceptional)
- Retargeting CTR: 0.8-2%+
- Healthy retargeting frequency: 1.5-3.0 (above 3.5 = fatigue, flag at 3.0)
- Flag CPM that is 2x above campaign average
- Minimum test spend before killing: 2x target CAC
- Conversion tracking is currently broken (all null) — this is ALWAYS priority #0

---

HIGH-TICKET ECONOMICS:
- 25% Rule: Allowable CAC = LTV × 25%
- 1.5x Test Rule: Spend at least 1.5x allowable CAC before killing any test
- This is a high-ticket coaching/education offer — optimize for call bookings and enrollment quality, not just volume

---

AI CREATIVE SETTINGS: All Advantage+ creative features should be OFF (highlight positive comment OFF, site links OFF, all other AI features OFF).

---

DATA ACCESS: You DO have live access to PIP University's Facebook Ads account. Campaign data is automatically pulled via Windsor.ai each session and is included below. You have the following metrics for every campaign, ad set, and individual ad — do NOT ask the user to paste or provide any of this:
- Spend, impressions, reach, frequency
- Clicks, CTR, CPC, unique clicks, outbound clicks & CTR
- CPM
- Video: ThruPlay count, 25/50/75/100% completions, average watch time, cost per ThruPlay
- All conversion actions (leads, purchases, calls booked) and cost per action

When asked whether you can access the ad account, confirm yes — live data is already loaded. Never ask the user to copy/paste data from Ads Manager.

When analyzing data, always reference the SOP rules. If something violates a rule (e.g., too many ad sets, modifying winning campaigns), flag it. Be direct and specific — reference actual numbers from the data.`

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s — try a shorter date range.`)), ms)
    ),
  ])
}

async function windsorFetch(fields: string, dateFrom: string, dateTo: string): Promise<Response> {
  const key = process.env.WINDSOR_API_KEY
  const accountId = process.env.WINDSOR_FACEBOOK_ACCOUNT_ID || WINDSOR_ACCOUNT_ID
  const params = new URLSearchParams({
    api_key:    key ?? '',
    date_from:  dateFrom,
    date_to:    dateTo,
    fields,
    account_id: accountId,
  })
  return withTimeout(
    fetch(`https://connectors.windsor.ai/facebook?${params}`),
    WINDSOR_TIMEOUT_MS,
    'Windsor API'
  )
}

// Returns ad data as a JSON string, or null if Windsor can't be reached.
// Never throws — Windsor failure is non-fatal; Claude still loads without data.
async function fetchAdsData(days: number = 30): Promise<string | null> {
  const today = new Date()
  const startDate = new Date(today)
  startDate.setDate(today.getDate() - days)
  const dateTo   = today.toISOString().split('T')[0]
  const dateFrom = startDate.toISOString().split('T')[0]

  // 1. Try full rich fields
  try {
    const res = await windsorFetch(WINDSOR_FIELDS_FULL, dateFrom, dateTo)
    if (res.ok) {
      const json = await res.json()
      return JSON.stringify(json.data ?? json)
    }
  } catch { /* timeout or network error — fall through */ }

  // 2. Fall back to basic fields
  try {
    const res = await windsorFetch(WINDSOR_FIELDS_BASIC, dateFrom, dateTo)
    if (res.ok) {
      const json = await res.json()
      return JSON.stringify(json.data ?? json)
    }
  } catch { /* still failed — return null so Claude loads anyway */ }

  return null
}

function jsonError(message: string, status = 500): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonError('Method not allowed', 405)
  }

  try {
    const { messages, fetchData, days } = await request.json() as {
      messages: { role: string; content: string }[]
      fetchData?: boolean
      days?: number
    }

    const rangeDays = Math.min(Math.max(days ?? 30, 1), 90)

    let systemPrompt = SYSTEM_PROMPT

    if (fetchData) {
      const adsData = await fetchAdsData(rangeDays)
      if (adsData) {
        systemPrompt += `\n\nCurrent Facebook Ads data (last ${rangeDays} days):\n${adsData}`
      } else {
        systemPrompt += `\n\nNOTE: Live ad data could not be fetched right now (Windsor API unavailable). Let the user know data is temporarily unavailable and ask them to hit Refresh in a moment. You can still answer general SOP and strategy questions.`
      }
    }

    // Request a streaming response from Anthropic
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        stream: true,
        system: systemPrompt,
        messages,
      }),
    })

    if (!anthropicRes.ok) {
      // Non-streaming error — parse and forward it
      const errData = await anthropicRes.json() as { error?: { message: string } }
      return jsonError(`Anthropic error: ${errData.error?.message ?? anthropicRes.status}`)
    }

    // Pipe Anthropic's SSE stream directly to the browser.
    // As long as bytes are flowing the Vercel edge timeout doesn't fire.
    return new Response(anthropicRes.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return jsonError(message)
  }
}
