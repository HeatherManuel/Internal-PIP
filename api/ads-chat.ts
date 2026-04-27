export const config = { runtime: 'edge' }

const WINDSOR_ACCOUNT_ID = '2837959129738933'
const WINDSOR_FIELDS = 'campaign,adset_name,spend,impressions,clicks,ctr,cpc,cpm,reach,frequency'

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

When analyzing data, always reference the SOP rules. If something violates a rule (e.g., too many ad sets, modifying winning campaigns), flag it. Be direct and specific — reference actual numbers from the data.`

async function fetchAdsData(): Promise<string> {
  const key = process.env.WINDSOR_API_KEY
  const accountId = process.env.WINDSOR_FACEBOOK_ACCOUNT_ID || WINDSOR_ACCOUNT_ID

  const today = new Date()
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(today.getDate() - 30)
  const dateTo   = today.toISOString().split('T')[0]
  const dateFrom = thirtyDaysAgo.toISOString().split('T')[0]

  const params = new URLSearchParams({
    api_key:    key ?? '',
    date_from:  dateFrom,
    date_to:    dateTo,
    fields:     WINDSOR_FIELDS,
    account_id: accountId,
  })
  const url = `https://connectors.windsor.ai/facebook?${params}`

  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Windsor API error: ${res.status} — ${body}`)
  }
  const json = await res.json()
  return JSON.stringify(json.data ?? json)
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  try {
    const { messages, fetchData } = await request.json() as {
      messages: { role: string; content: string }[]
      fetchData?: boolean
    }

    let systemPrompt = SYSTEM_PROMPT

    if (fetchData) {
      const adsData = await fetchAdsData()
      systemPrompt += `\n\nCurrent Facebook Ads data (last 30 days):\n${adsData}`
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      }),
    })

    const data = await res.json() as { content?: { text: string }[]; error?: { message: string }; type?: string }

    if (!res.ok || data.type === 'error') {
      throw new Error(`Anthropic error: ${data.error?.message ?? res.status}`)
    }

    const content = data.content?.[0]?.text ?? 'No response generated.'

    return new Response(JSON.stringify({ content }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return new Response(JSON.stringify({ error: message }), { status: 500 })
  }
}
