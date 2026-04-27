export const config = { runtime: 'edge' }

const WINDSOR_ACCOUNT_ID = '2837959129738933'
const WINDSOR_FIELDS = 'campaign,adset_name,spend,impressions,clicks,ctr,cpc,cpm,reach,frequency'

export default async function handler(request: Request): Promise<Response> {
  // Vercel automatically sends CRON_SECRET as Bearer token on cron invocations
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const key = process.env.WINDSOR_API_KEY
    const accountId = process.env.WINDSOR_FACEBOOK_ACCOUNT_ID || WINDSOR_ACCOUNT_ID
    const url = `https://connectors.windsor.ai/facebook?api_key=${key}&date_preset=last_7d&fields=${WINDSOR_FIELDS}&accounts=${accountId}`

    const windsorRes = await fetch(url)
    if (!windsorRes.ok) throw new Error(`Windsor API error: ${windsorRes.status}`)
    const windsorJson = await windsorRes.json()
    const adsData = JSON.stringify(windsorJson.data ?? windsorJson)

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
        system: `You are an expert Facebook Ads manager for PIP University, an online education platform for salon professionals. Generate a concise weekly performance report. Structure it as:
1. Total spend this week
2. Performance by campaign (CTR, CPC, CPM highlights)
3. Warning flags (frequency issues, CPM spikes, anything anomalous)
4. Top 3 action items for next week

Be direct, specific, and data-driven. No filler.`,
        messages: [{
          role: 'user',
          content: `Generate this week's Facebook Ads report for PIP University.\n\nData (last 7 days):\n${adsData}`,
        }],
      }),
    })

    const anthropicJson = await anthropicRes.json() as { content?: { text: string }[] }
    const report = anthropicJson.content?.[0]?.text ?? 'Report generation failed.'

    return new Response(JSON.stringify({ success: true, report }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ success: false, error: message }), { status: 500 })
  }
}
