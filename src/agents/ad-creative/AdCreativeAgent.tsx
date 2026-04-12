import { useState } from 'react'
import { Loader2, Wand2, Copy, Check } from 'lucide-react'
import { Header } from '@/components/layout/Header'

interface AdCreativeOutput {
  headline: string
  primaryText: string
  callToAction: string
  hashtags: string[]
}

export function AdCreativeAgent() {
  const [brief, setBrief] = useState('')
  const [platform, setPlatform] = useState<'meta' | 'instagram' | 'youtube'>('meta')
  const [tone, setTone] = useState<'professional' | 'playful' | 'urgent' | 'inspirational'>('professional')
  const [loading, setLoading] = useState(false)
  const [output, setOutput] = useState<AdCreativeOutput | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleGenerate = async () => {
    if (!brief.trim()) return
    setLoading(true)
    setError(null)
    setOutput(null)

    try {
      // TODO: wire to /api/agents/ad-creative or Supabase Edge Function
      // Stubbed output for UI validation
      await new Promise((r) => setTimeout(r, 1500))
      setOutput({
        headline: `Transform Your ${brief.split(' ')[0]} Results Today`,
        primaryText: `Stop settling for average. Our proven approach helps you achieve real results fast. Join thousands who've already made the switch — and never looked back.`,
        callToAction: 'Learn More',
        hashtags: ['#results', '#growth', '#marketing', `#${brief.split(' ')[0].toLowerCase()}`],
      })
    } catch (err) {
      setError('Failed to generate ad creative. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const copyAll = () => {
    if (!output) return
    const text = `Headline: ${output.headline}\n\n${output.primaryText}\n\nCTA: ${output.callToAction}\n\n${output.hashtags.join(' ')}`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <Header
        title="🎨 Ad Creative Agent"
        subtitle="Generate high-converting ad copy for Meta, Instagram, and YouTube."
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Input panel */}
        <div className="space-y-5">
          <div className="pip-card space-y-4">
            <h2 className="font-medium text-white">Brief</h2>

            <div>
              <label className="pip-label">What are you promoting?</label>
              <textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                className="pip-input resize-none"
                rows={4}
                placeholder="e.g. A coaching program for female entrepreneurs who want to scale to 6 figures without burnout"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="pip-label">Platform</label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as typeof platform)}
                  className="pip-input"
                >
                  <option value="meta">Meta / Facebook</option>
                  <option value="instagram">Instagram</option>
                  <option value="youtube">YouTube</option>
                </select>
              </div>
              <div>
                <label className="pip-label">Tone</label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value as typeof tone)}
                  className="pip-input"
                >
                  <option value="professional">Professional</option>
                  <option value="playful">Playful</option>
                  <option value="urgent">Urgent</option>
                  <option value="inspirational">Inspirational</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading || !brief.trim()}
              className="pip-button-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Wand2 size={16} />
                  Generate Ad Creative
                </>
              )}
            </button>

            {error && (
              <div className="bg-red-950/50 border border-red-800 text-red-400 text-sm rounded-lg px-3 py-2">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Output panel */}
        <div className="pip-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-white">Output</h2>
            {output && (
              <button
                onClick={copyAll}
                className="pip-button-secondary flex items-center gap-1.5 text-xs py-1.5 px-3"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? 'Copied!' : 'Copy all'}
              </button>
            )}
          </div>

          {!output && !loading && (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <p className="text-4xl mb-3">✨</p>
              <p className="text-gray-500 text-sm">Your ad creative will appear here</p>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center h-48">
              <Loader2 size={24} className="animate-spin text-pip-400 mb-3" />
              <p className="text-gray-500 text-sm">Crafting your ad…</p>
            </div>
          )}

          {output && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Headline</p>
                <p className="text-white font-semibold text-lg">{output.headline}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Primary Text</p>
                <p className="text-gray-300 text-sm leading-relaxed">{output.primaryText}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">CTA</p>
                  <span className="inline-block bg-pip-600/20 text-pip-300 text-sm px-3 py-1 rounded-full font-medium">
                    {output.callToAction}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Hashtags</p>
                  <p className="text-gray-400 text-sm">{output.hashtags.join(' ')}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
