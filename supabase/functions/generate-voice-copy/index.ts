/**
 * generate-voice-copy — Supabase Edge Function
 *
 * Fetches voice-training content from drive_content, then uses Claude to
 * generate ad copy that matches the user's writing style.
 *
 * POST /functions/v1/generate-voice-copy
 * Body: { brief: string, platform: 'meta' | 'instagram' | 'youtube', tone: string }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

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
    const { brief, platform, tone } = await req.json()
    if (!brief?.trim()) return respond({ error: 'brief is required' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Fetch voice training samples — these define how the user writes
    const { data: voiceFiles } = await supabase
      .from('drive_content')
      .select('file_name, raw_text')
      .eq('content_type', 'voice_training')
      .not('raw_text', 'is', null)
      .limit(8)

    // If not enough voice samples, pull from all synced content
    let sourceFiles = voiceFiles ?? []
    if (sourceFiles.length < 3) {
      const { data: allFiles } = await supabase
        .from('drive_content')
        .select('file_name, raw_text')
        .not('raw_text', 'is', null)
        .limit(8)
      sourceFiles = allFiles ?? []
    }

    if (sourceFiles.length === 0) {
      return respond({ error: 'No content found in knowledge base. Run a sync first.' }, 422)
    }

    // Build voice context — cap at 30K chars to stay within limits
    let voiceContext = sourceFiles
      .map((f: { file_name: string; raw_text: string }) =>
        `[${f.file_name}]\n${f.raw_text.slice(0, 4000)}`)
      .join('\n\n---\n\n')

    if (voiceContext.length > 30000) {
      voiceContext = voiceContext.slice(0, 30000) + '\n\n[... content truncated ...]'
    }

    const platformGuide: Record<string, string> = {
      meta:      'a Facebook/Meta ad with an attention-grabbing headline, story-driven primary text (2–4 paragraphs), a clear CTA, and 3–5 hashtags.',
      instagram: 'an Instagram caption with a strong hook, conversational 1–3 paragraph body, and 5–8 hashtags.',
      youtube:   'a YouTube description/script opener with a bold first line, value proposition, 2–3 short paragraphs, and 3–5 hashtags.',
    }

    const toneGuide: Record<string, string> = {
      professional:   'polished, authoritative, credible',
      playful:        'fun, energetic, relatable, uses light humor',
      urgent:         'direct, creates urgency, drives immediate action',
      inspirational:  'motivating, empowering, emotionally resonant',
    }

    const prompt = `You are a copywriter who writes exclusively in the voice of the content creator whose writing samples are provided below. Study their word choices, sentence rhythm, punctuation habits, how they open paragraphs, and their communication style.

VOICE SAMPLES:
${voiceContext}

---

Write ${platformGuide[platform] ?? platformGuide.meta}

BRIEF: ${brief.trim()}

TONE: ${toneGuide[tone] ?? toneGuide.professional}

Mirror this person's specific voice precisely — their cadence, phrasing, level of directness, and favorite sentence structures. Do NOT write generic marketing copy.

Respond ONLY with valid JSON in this exact format (no markdown, no explanation):
{
  "headline": "...",
  "primaryText": "...",
  "callToAction": "...",
  "hashtags": ["...", "..."]
}`

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured on this project')

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 1024,
        messages:   [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Claude API error ${res.status}: ${errText}`)
    }

    const claudeData = await res.json()
    const text = claudeData.content?.[0]?.text ?? ''

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Claude returned an unexpected format. Please try again.')

    const output = JSON.parse(jsonMatch[0])
    return respond(output)

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[generate-voice-copy] Error:', message)
    return respond({ error: message }, 500)
  }
})
