export const config = { runtime: 'edge' }

export default async function handler(): Promise<Response> {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY

  if (!url || !key) {
    return new Response(JSON.stringify({ count: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const res = await fetch(
      `${url}/rest/v1/ads_session_summaries?select=id`,
      {
        headers: {
          'apikey':        key,
          'Authorization': `Bearer ${key}`,
          'Prefer':        'count=exact',
          'Range':         '0-0',
        },
      }
    )
    const contentRange = res.headers.get('content-range') ?? ''
    const count = parseInt(contentRange.split('/')[1] ?? '0', 10)
    return new Response(JSON.stringify({ count: isNaN(count) ? 0 : count }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify({ count: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
