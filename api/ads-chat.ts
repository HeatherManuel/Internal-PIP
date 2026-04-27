export const config = { runtime: 'edge' }

const WINDSOR_ACCOUNT_ID = '2837959129738933'
const WINDSOR_FIELDS = 'campaign,adset_name,spend,impressions,clicks,ctr,cpc,cpm,reach,frequency'

const SYSTEM_PROMPT = `You are an expert Facebook Ads manager for PIP University, an online education platform for salon professionals. You have deep expertise in direct response advertising, funnel strategy, and Meta ad buying.

PIP University's funnel structure:
- TOF (Top of Funnel): Cold broad audience — US Female 25-65
- MOF (Middle of Funnel): Retargeting IG/FB engagers, video viewers, email list, website visitors (90-day window)
- BOF (Bottom of Funnel): Retargeting VSL page viewers, 75%+ video views (90-day window)

Current campaigns: RLCEO - TOF COLD, RLCEO - MOF RETARGETING, RLCEO - BOF RETARGETING

Your role: Analyze campaign data and give specific, actionable recommendations like a seasoned ad buyer. Reference actual numbers. Be direct — not generic.

Key benchmarks:
- TOF CTR target: 2–5%+
- Retargeting CTR target: 0.8–2%+
- Healthy retargeting frequency: 1.5–3.0 (above 3.5 = audience fatigue)
- Flag CPM that is 2x above campaign average
- Conversion tracking is currently broken (all null) — always flag this as top priority

When you see a problem, say so directly. When something is working, say that too. Keep responses concise and scannable.`

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

    const data = await res.json() as { content?: { text: string }[] }
    const content = data.content?.[0]?.text ?? 'No response generated.'

    return new Response(JSON.stringify({ content }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return new Response(JSON.stringify({ error: message }), { status: 500 })
  }
}
