export const config = { runtime: 'edge' }

async function saveToSupabase(summary: string): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase env vars not set')

  const res = await fetch(`${url}/rest/v1/ads_session_summaries`, {
    method: 'POST',
    headers: {
      'apikey':        key,
      'Authorization': `Bearer ${key}`,
      'Content-Type':  'application/json',
      'Prefer':        'return=minimal',
    },
    body: JSON.stringify({ summary }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Supabase error: ${res.status} — ${text}`)
  }
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  try {
    const { messages } = await request.json() as {
      messages: { role: string; content: string }[]
    }

    // Need at least a few exchanges to be worth summarizing
    if (!messages || messages.length < 4) {
      return new Response(JSON.stringify({ success: false, reason: 'Session too short to summarize' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       process.env.ANTHROPIC_API_KEY ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 300,
        system: `You are creating a memory note for a Facebook Ads management session at PIP University. Write 3-5 bullet points (max 200 words total) capturing what was discussed so future sessions have continuity. Focus on: specific metrics and numbers mentioned, decisions made, actions recommended, flags raised, and anything still unresolved. Be specific. Past tense. No fluff.`,
        messages: [
          ...messages,
          {
            role:    'user',
            content: 'Summarize this session in 3-5 bullet points for future reference.',
          },
        ],
      }),
    })

    const data = await anthropicRes.json() as { content?: { text: string }[] }
    const summary = data.content?.[0]?.text ?? ''

    if (summary) {
      await saveToSupabase(summary)
    }

    return new Response(JSON.stringify({ success: true, summary }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ success: false, error: message }), { status: 500 })
  }
}
