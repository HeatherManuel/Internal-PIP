import { useState, useRef, useEffect } from 'react'
import { Send, RefreshCw } from 'lucide-react'
import { Header } from '@/components/layout/Header'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTED_PROMPTS = [
  'Which campaign should I scale right now?',
  'What\'s causing the high frequency in MOF?',
  'Compare TOF vs retargeting efficiency',
  'What creative changes would improve CTR?',
]

const DATE_RANGES = [
  { label: '7 days',  days: 7  },
  { label: '14 days', days: 14 },
  { label: '30 days', days: 30 },
  { label: '60 days', days: 60 },
  { label: '90 days', days: 90 },
]

async function callAdsChat(messages: Message[], fetchData: boolean, days: number): Promise<string> {
  const res = await fetch('/api/ads-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, fetchData, days }),
  })

  let data: { content?: string; error?: string } = {}
  try {
    data = await res.json() as { content?: string; error?: string }
  } catch {
    // Vercel returned a non-JSON error page (e.g. timeout / crash)
    throw new Error(res.status === 504 ? 'Request timed out — try a shorter date range.' : `Server error (${res.status}). Please try again.`)
  }

  if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`)
  return data.content ?? 'No response.'
}

export function AdsManager() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [days, setDays] = useState(30)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    runInitialAnalysis()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function runInitialAnalysis(selectedDays = days) {
    setInitializing(true)
    setMessages([])
    const userMsg: Message = {
      role: 'user',
      content: `Give me a performance summary of the current campaigns (last ${selectedDays} days). Highlight what's working, what's not, and your top 3 priorities.`,
    }
    try {
      const content = await callAdsChat([userMsg], true, selectedDays)
      setMessages([userMsg, { role: 'assistant', content }])
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setMessages([{
        role: 'assistant',
        content: `⚠️ Failed to load ad data.\n\nError: ${msg}`,
      }])
    } finally {
      setInitializing(false)
    }
  }

  async function sendMessage(text?: string) {
    const messageText = text ?? input
    if (!messageText.trim() || loading || initializing) return

    const userMsg: Message = { role: 'user', content: messageText }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setLoading(true)

    try {
      const content = await callAdsChat(next, false, days)
      setMessages([...next, { role: 'assistant', content }])
    } catch {
      setMessages([...next, { role: 'assistant', content: 'Error getting response. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)]">
      <Header
        title="Ads Manager"
        subtitle="AI-powered Facebook Ads analysis · PIP University 2"
        actions={
          <div className="flex items-center gap-2">
            <select
              value={days}
              onChange={(e) => {
                const d = Number(e.target.value)
                setDays(d)
                runInitialAnalysis(d)
              }}
              disabled={initializing || loading}
              className="text-sm bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-pip-600 cursor-pointer disabled:opacity-40"
            >
              {DATE_RANGES.map((r) => (
                <option key={r.days} value={r.days}>{r.label}</option>
              ))}
            </select>
            <button
              onClick={() => runInitialAnalysis()}
              disabled={initializing || loading}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-40"
            >
              <RefreshCw size={14} className={initializing ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        }
      />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4 min-h-0">
        {initializing ? (
          <div className="pip-card flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-pip-600 border-t-transparent rounded-full animate-spin shrink-0" />
            <p className="text-sm text-gray-400">Fetching campaign data and running analysis...</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-pip-600 text-white'
                    : 'bg-gray-800 text-gray-200 border border-gray-700'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3.5">
              <div className="flex gap-1.5 items-center">
                <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0ms]" />
                <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:150ms]" />
                <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Suggested prompts — only show when idle after initial load */}
      {!initializing && !loading && messages.length <= 2 && (
        <div className="flex flex-wrap gap-2 pb-3">
          {SUGGESTED_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => sendMessage(p)}
              className="text-xs px-3 py-1.5 rounded-full bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-colors"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-gray-800 pt-4 shrink-0">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Ask about your campaigns..."
            disabled={loading || initializing}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-pip-600 transition-colors disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || initializing || !input.trim()}
            className="p-2.5 bg-pip-600 hover:bg-pip-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            <Send size={16} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  )
}
