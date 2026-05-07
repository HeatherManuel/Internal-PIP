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
].join(',')

const REPORT_SYSTEM_PROMPT = `You are an expert Facebook Ads manager for PIP University, an online education platform for salon professionals. You follow "The Profitable Ads Procedure" SOP based on the Meta Andromeda algorithm.

CAMPAIGN STRUCTURE:
- BOF RETARGETING: Hot leads. ABO, ThruPlay optimization, $3-5/day per ad set, frequency cap 2x/7 days.
- MOF RETARGETING: Warm leads. Engagement optimization. Excludes BOF audience and purchasers.
- TOF COLD: US Female 25-65, broad. ABO, 25-30 unique ads, $150-300/day total.
- C2 DM LEAD GEN: Also a TOF campaign. Combine its spend with TOF COLD when calculating TOF's percentage of total budget. Never flag C2 as pulling budget away from TOF — they are both TOF.

OPTIMIZATION: All campaigns optimize for ThruPlay and engagement — NOT conversions. Null conversion values are expected and normal. Never flag missing conversions as an error.

Budget allocation: BOF = 5-10%, MOF = 5-15%, TOF (TOF COLD + C2 DM LEAD GEN combined) = 75-90%.

KEY RULES (flag violations):
- Never modify a winning ad set — only increase budget in place
- Never increase budget more than 20% at a time
- Healthy retargeting frequency: 1.5-3.0 (flag above 3.0)
- TOF CTR benchmark: 2-5%+ (current campaigns running 5-11% — exceptional)
- Retargeting CTR benchmark: 0.8-2%+
- Flag CPM that is 2x above campaign average

Output ONLY the final formatted report. No thinking, no calculations, no preamble. Start immediately with the report header.

Use HTML tags for formatting — Basecamp Chat renders HTML. Never use Markdown asterisks (**) or pound signs (#).

The spend totals and per-campaign breakdowns will be pre-calculated and provided to you — use those exact numbers, do not recalculate.

Output this exact structure:

<b>📊 Daily Ads Report — [DAY, MONTH DATE, YEAR]</b><br>
<br>
<b>💰 Spend — Last 7 Days</b><br>
Total: $X,XXX | TOF: $XXX (XX%) | MOF: $XXX (XX%) | BOF: $XXX (XX%)<br>
<br>
<b>🚦 Status by Campaign</b><br>
✅/⚠️/🔴 TOF Cold — CTR X%, CPC $X.XX — [one-line verdict]<br>
✅/⚠️/🔴 MOF Retargeting — Freq X.X, CTR X% — [one-line verdict]<br>
✅/⚠️/🔴 BOF Retargeting — Freq X.X, ThruPlays X — [one-line verdict]<br>
<br>
<b>🚨 Flags</b><br>
• [Specific issue with actual numbers. If none: No flags — all campaigns healthy.]<br>
<br>
<b>✅ Action Items</b><br>
1. [Specific action to take today]<br>
2. [Second action if needed]<br>

Rules: Use ✅ within SOP benchmarks, ⚠️ approaching a threshold, 🔴 action required. Flag: frequency above 3.0, MOF budget above 15%, TOF budget below 75%. Keep every bullet and action item to one sentence — be direct, no run-ons. Always finish the report completely before stopping.`

// Raw row from Windsor
interface AdRow {
  campaign?:    string
  adset_name?:  string
  ad_name?:     string
  spend?:       number | string
  impressions?: number | string
  clicks?:      number | string
  ctr?:         number | string
  cpc?:         number | string
  cpm?:         number | string
  frequency?:   number | string
  video_thruplay_watched_actions?: number | string
  [key: string]: unknown
}

interface CampaignSummary {
  spend:       number
  impressions: number
  clicks:      number
  thruplays:   number
  adSets:      Map<string, { spend: number; frequency: number; thruplays: number; clicks: number; impressions: number }>
  ads:         { name: string; spend: number; ctr: number; cpc: number; thruplays: number }[]
}

function toNum(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') return parseFloat(v) || 0
  return 0
}

// Pre-aggregate Windsor rows into clean per-campaign summaries
function aggregateData(rows: AdRow[]): string {
  const campaigns = new Map<string, CampaignSummary>()

  for (const row of rows) {
    const camp = row.campaign ?? 'Unknown'
    if (!campaigns.has(camp)) {
      campaigns.set(camp, { spend: 0, impressions: 0, clicks: 0, thruplays: 0, adSets: new Map(), ads: [] })
    }
    const c = campaigns.get(camp)!
    const spend      = toNum(row.spend)
    const impressions = toNum(row.impressions)
    const clicks     = toNum(row.clicks)
    const thruplays  = toNum(row.video_thruplay_watched_actions)
    const frequency  = toNum(row.frequency)

    c.spend       += spend
    c.impressions += impressions
    c.clicks      += clicks
    c.thruplays   += thruplays

    // Roll up ad set level
    const adSetKey = row.adset_name ?? 'Unknown'
    if (!c.adSets.has(adSetKey)) {
      c.adSets.set(adSetKey, { spend: 0, frequency: 0, thruplays: 0, clicks: 0, impressions: 0 })
    }
    const as = c.adSets.get(adSetKey)!
    as.spend       += spend
    as.clicks      += clicks
    as.impressions += impressions
    as.thruplays   += thruplays
    // Frequency: use latest non-zero value (it's a rolling metric, not additive)
    if (frequency > 0) as.frequency = frequency

    // Individual ad summary
    if (row.ad_name && spend > 0) {
      c.ads.push({
        name:      row.ad_name,
        spend:     spend,
        ctr:       c.impressions > 0 ? (clicks / impressions) * 100 : toNum(row.ctr),
        cpc:       toNum(row.cpc),
        thruplays: thruplays,
      })
    }
  }

  // Build summary object for Claude
  const totalSpend = Array.from(campaigns.values()).reduce((s, c) => s + c.spend, 0)
  const summary: Record<string, unknown> = { totalSpend: +totalSpend.toFixed(2), campaigns: {} }

  for (const [name, c] of campaigns.entries()) {
    const pct = totalSpend > 0 ? ((c.spend / totalSpend) * 100).toFixed(1) : '0'
    const campCTR = c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(2) : '0'

    // Sort ad sets by spend desc
    const adSetList = Array.from(c.adSets.entries())
      .sort((a, b) => b[1].spend - a[1].spend)
      .map(([n, as]) => ({
        name:      n,
        spend:     +as.spend.toFixed(2),
        frequency: +as.frequency.toFixed(2),
        thruplays: as.thruplays,
        ctr:       as.impressions > 0 ? +((as.clicks / as.impressions) * 100).toFixed(2) : 0,
      }))

    // Top ads by spend
    const topAds = c.ads
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 8)
      .map(a => ({ name: a.name, spend: +a.spend.toFixed(2), thruplays: a.thruplays }))

    ;(summary.campaigns as Record<string, unknown>)[name] = {
      spend:       +c.spend.toFixed(2),
      spendPct:    `${pct}%`,
      impressions: c.impressions,
      clicks:      c.clicks,
      blendedCTR:  `${campCTR}%`,
      thruplays:   c.thruplays,
      adSets:      adSetList,
      topAds,
    }
  }

  return JSON.stringify(summary, null, 2)
}

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

  // Try up to 3 times — cron cold starts can be slow
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 20000)
      const res = await fetch(`https://connectors.windsor.ai/facebook?${params}`, {
        signal: controller.signal,
      })
      clearTimeout(timer)
      if (!res.ok) continue
      const json = await res.json()
      const rows: AdRow[] = json.data ?? json
      return aggregateData(rows)
    } catch {
      // timeout or network error — retry once, then give up
    }
  }
  return null
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
      ? `Generate the daily ads monitoring report for ${today}.\n\nPre-aggregated campaign data (last 7 days, all math already done — use these exact figures):\n${adsData}`
      : `Generate a brief daily ads report for ${today}. Live data could not be fetched — flag this and ask the team to check the Windsor connection.`

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 900,
        system:     REPORT_SYSTEM_PROMPT,
        messages:   [{ role: 'user', content: userMessage }],
      }),
    })

    const anthropicJson = await anthropicRes.json() as {
      content?: { text: string }[]
      error?:   { message: string }
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
    try {
      await postToBasecamp(`<b>⚠️ Ads Monitor Error</b><br>Failed to generate today's report: ${message}`)
    } catch { /* ignore */ }
    return new Response(JSON.stringify({ success: false, error: message }), { status: 500 })
  }
}
