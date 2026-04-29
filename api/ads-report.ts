export const config = { runtime: 'edge' }

const WINDSOR_ACCOUNT_ID = '2837959129738933'
const WINDSOR_FIELDS = [
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

const REPORT_SYSTEM_PROMPT = `You are an expert Facebook Ads manager for PIP University, an online education platform for salon professionals. You follow "The Profitable Ads Procedure" SOP based on the Meta Andromeda algorithm.

CAMPAIGN STRUCTURE:
- BOF RETARGETING: Hot leads. ABO, ThruPlay optimization, $3-5/day per ad set, frequency cap 2x/7 days.
- MOF RETARGETING: Warm leads. Excludes BOF audience and purchasers.
- TOF COLD: US Female 25-65, broad. ABO, 25-30 unique ads, $150-300/day total.

Budget allocation: BOF = 5-10%, MOF = 5-15%, TOF = 75-90%.

KEY RULES (flag violations):
- Never modify a winning ad set — only increase budget in place
- Never increase budget more than 20% at a time
- Healthy retargeting frequency: 1.5-3.0 (flag above 3.0)
- TOF CTR benchmark: 2-5%+ (current campaigns running 5-11% — exceptional)
- Retargeting CTR benchmark: 0.8-2%+
- Flag CPM that is 2x above campaign average
- Conversion tracking currently broken (all null) — flag as Priority #0

Output ONLY the final formatted report. No thinking, no calculations, no preamble. Start immediately with the report header.

Use HTML tags for formatting — Basecamp Chat renders HTML. Never use Markdown asterisks (**) or pound signs (#).

Output this exact structure, filled in with real numbers. Use <br> for line breaks between items so it's easy to read in chat:

<b>📊 Daily Ads Report — [DAY, MONTH DATE, YEAR]</b><br>
<br>
<b>💰 Spend — Last 7 Days</b><br>
Total: $X,XXX | TOF: $XXX | MOF: $XXX | BOF: $XXX<br>
<br>
<b>🚦 Status by Campaign</b><br>
✅ TOF Cold — CTR X%, CPC $X.XX — [one-line verdict]<br>
✅/⚠️/🔴 MOF Retargeting — Freq X.X, CTR X% — [one-line verdict]<br>
✅/⚠️/🔴 BOF Retargeting — Freq X.X, ThruPlays X — [one-line verdict]<br>
<br>
<b>🚨 Flags</b><br>
• [Specific issue referencing actual numbers. If none, write: No flags — all campaigns healthy.]<br>
<br>
<b>✅ Action Items</b><br>
1. [Specific action to take today]<br>
2. [Second action if needed]<br>

Rules: Use ✅ when metrics are within SOP benchmarks, ⚠️ when approaching a threshold, 🔴 when action is required. Flag frequency above 3.0, MOF budget above 15%, TOF budget below 75%.`

async function fetchAdsData(): Promise<string | null> {
  const key = process.env.WINDSOR_API_KEY
  const accountId = process.env.WINDSOR_FACEBOOK_ACCOUNT_ID || WINDSOR_ACCOUNT_ID

  const today = new Date()
  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(today.getDate() - 7)
  const dateTo   = today.toISOString().split('T')[0]
  const dateFrom = sevenDaysAgo.toISOString().split('T')[0]

  const params = new URLSearchParams({
    api_key:    key ?? '',
    date_from:  dateFrom,
    date_to:    dateTo,
    fields:     WINDSOR_FIELDS,
    account_id: accountId,
  })

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(`https://connectors.windsor.ai/facebook?${params}`, {
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) return null
    const json = await res.json()
    return JSON.stringify(json.data ?? json)
  } catch {
    return null   // timeout or network error — Claude still runs
  }
}

async function postToBasecamp(content: string): Promise<void> {
  const webhookUrl = process.env.BASECAMP_WEBHOOK_URL
  if (!webhookUrl) throw new Error('BASECAMP_WEBHOOK_URL is not set')

  const body = new URLSearchParams({ content })
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Basecamp error: ${res.status} — ${text}`)
  }
}

export default async function handler(request: Request): Promise<Response> {
  // Vercel sends CRON_SECRET as Bearer token on scheduled invocations
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const adsData = await fetchAdsData()

    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    })

    const userMessage = adsData
      ? `Generate the daily ads monitoring report for ${today}.\n\nFacebook Ads data (last 7 days):\n${adsData}`
      : `Generate a brief daily ads report for ${today}. Note that live data could not be fetched from the ad account today — flag this as an issue and ask the team to check the Windsor connection. Still provide any general SOP reminders relevant for a Monday morning check-in.`

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        system: REPORT_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    const anthropicJson = await anthropicRes.json() as {
      content?: { text: string }[]
      error?: { message: string }
    }

    if (!anthropicRes.ok) {
      throw new Error(`Anthropic error: ${anthropicJson.error?.message ?? anthropicRes.status}`)
    }

    const report = anthropicJson.content?.[0]?.text ?? 'Report generation failed.'

    await postToBasecamp(report)

    return new Response(JSON.stringify({ success: true, report }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'

    // Try to notify Basecamp even if something went wrong
    try {
      await postToBasecamp(`<b>⚠️ Ads Monitor Error</b>\n\nFailed to generate today's report: ${message}`)
    } catch { /* ignore secondary failure */ }

    return new Response(JSON.stringify({ success: false, error: message }), { status: 500 })
  }
}
