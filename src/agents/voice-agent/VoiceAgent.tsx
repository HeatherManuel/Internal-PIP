import { useState } from 'react'
import {
  Loader2, Wand2, Copy, Check, RefreshCw,
  DatabaseZap, AlertCircle, CheckCircle2,
  Clock, ChevronDown, ChevronUp, Settings2,
} from 'lucide-react'
import { Header }           from '@/components/layout/Header'
import { DriveFileManager } from './DriveFileManager'
import { useDriveSync }     from '@/hooks/useDriveSync'
import { useDriveConfig }   from '@/hooks/useDriveConfig'
import { supabase }         from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

interface VoiceAgentOutput {
  headline:     string
  primaryText:  string
  callToAction: string
  hashtags:     string[]
}

type Tab = 'generate' | 'sync'

// ── Sync Panel ────────────────────────────────────────────────────────────────

function DriveSyncPanel({ onManageSources }: { onManageSources: () => void }) {
  const {
    state, summary, results, syncLog,
    errorMsg, totalChunks, runSync,
  } = useDriveSync()

  const { stats } = useDriveConfig()

  const [showLog,     setShowLog]     = useState(false)
  const [showResults, setShowResults] = useState(false)

  const statusIcon = (s: string) => {
    if (s === 'synced')  return <CheckCircle2 size={13} className="text-green-400" />
    if (s === 'error')   return <AlertCircle  size={13} className="text-red-400" />
    if (s === 'syncing') return <Loader2      size={13} className="text-pip-400 animate-spin" />
    return <Clock size={13} className="text-gray-500" />
  }

  const mimeLabel = (mime: string) => {
    const map: Record<string, string> = {
      'application/vnd.google-apps.document':     'Doc',
      'application/vnd.google-apps.spreadsheet':  'Sheet',
      'application/vnd.google-apps.presentation': 'Slides',
      'text/plain': 'TXT', 'application/pdf': 'PDF',
    }
    return map[mime] ?? mime.split('/')[1]
  }

  return (
    <div className="space-y-4">
      {/* Ready-to-sync summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-800/40 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-pip-300">{stats.readyToSync}</p>
          <p className="text-xs text-gray-500">Files approved for sync</p>
        </div>
        <div className="bg-gray-800/40 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-white">{totalChunks.toLocaleString()}</p>
          <p className="text-xs text-gray-500">Files in knowledge base</p>
        </div>
      </div>

      {stats.readyToSync === 0 && totalChunks === 0 && (
        <div className="flex items-start gap-2 bg-yellow-950/30 border border-yellow-900/50 rounded-lg px-3 py-2.5 text-xs text-yellow-400">
          <AlertCircle size={13} className="shrink-0 mt-0.5" />
          <span>
            No files approved yet.{' '}
            <button onClick={onManageSources} className="underline hover:no-underline">
              Open Manage Sources
            </button>{' '}
            to classify your Drive files first.
          </span>
        </div>
      )}

      {/* Sync controls */}
      <div className="flex gap-2">
        <button
          onClick={() => runSync(false)}
          disabled={state === 'running' || stats.readyToSync === 0}
          className="pip-button-primary flex-1 flex items-center justify-center gap-2"
        >
          {state === 'running'
            ? <><Loader2 size={14} className="animate-spin" /> Syncing…</>
            : <><RefreshCw size={14} /> Sync Approved Files</>}
        </button>
        <button
          onClick={() => runSync(true)}
          disabled={state === 'running' || stats.readyToSync === 0}
          className="pip-button-secondary flex items-center gap-1.5 text-xs text-yellow-400"
          title="Force re-embed all approved files"
        >
          Force re-sync
        </button>
      </div>

      {state === 'error' && errorMsg && (
        <div className="bg-red-950/50 border border-red-800 text-red-400 text-sm rounded-lg px-3 py-2 flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          {errorMsg}
        </div>
      )}

      {state === 'done' && summary && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Synced',  value: summary.synced,  color: 'text-green-400' },
            { label: 'Skipped', value: summary.skipped, color: 'text-gray-400' },
            { label: 'Errors',  value: summary.errors,  color: 'text-red-400' },
          ].map((s) => (
            <div key={s.label} className="bg-gray-800/60 rounded-lg p-2 text-center">
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {results.length > 0 && (
        <div>
          <button
            onClick={() => setShowResults(!showResults)}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200"
          >
            {showResults ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {showResults ? 'Hide' : 'Show'} results ({results.length})
          </button>
          {showResults && (
            <div className="mt-2 space-y-0.5 max-h-40 overflow-y-auto">
              {results.map((r) => (
                <div key={r.fileId} className="flex items-center gap-2 text-xs py-1">
                  {statusIcon(r.status)}
                  <span className="text-gray-300 flex-1 truncate">{r.fileName}</span>
                  {r.status === 'synced' && <span className="text-gray-500">{r.chunks} chunks</span>}
                  {r.status === 'error'  && <span className="text-red-400 truncate max-w-32" title={r.error}>{r.error}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {syncLog.length > 0 && (
        <div>
          <button
            onClick={() => setShowLog(!showLog)}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200"
          >
            {showLog ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {showLog ? 'Hide' : 'View'} indexed files ({syncLog.length})
          </button>
          {showLog && (
            <div className="mt-2 space-y-0.5 max-h-48 overflow-y-auto">
              {syncLog.map((f) => (
                <div key={f.file_id} className="flex items-center gap-2 text-xs py-1 border-b border-gray-800/40 last:border-0">
                  {statusIcon(f.status)}
                  <span className="text-gray-300 flex-1 truncate">{f.file_name}</span>
                  <span className="text-gray-600">{mimeLabel(f.mime_type)}</span>
                  <span className="text-gray-600">{f.chunks_created} ch</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Generate Panel ────────────────────────────────────────────────────────────

function GeneratePanel() {
  const [brief,    setBrief]    = useState('')
  const [platform, setPlatform] = useState<'meta' | 'instagram' | 'youtube'>('meta')
  const [tone,     setTone]     = useState<'professional' | 'playful' | 'urgent' | 'inspirational'>('professional')
  const [loading,  setLoading]  = useState(false)
  const [output,   setOutput]   = useState<VoiceAgentOutput | null>(null)
  const [error,    setError]    = useState<string | null>(null)
  const [copied,   setCopied]   = useState(false)

  const { totalChunks } = useDriveSync()

  const handleGenerate = async () => {
    if (!brief.trim()) return
    setLoading(true)
    setError(null)
    setOutput(null)

    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-voice-copy', {
        body: { brief: brief.trim(), platform, tone },
      })
      if (fnError) throw fnError
      if (data?.error) throw new Error(data.error)
      setOutput(data as VoiceAgentOutput)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate output. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const copyAll = () => {
    if (!output) return
    navigator.clipboard.writeText(
      `Headline: ${output.headline}\n\n${output.primaryText}\n\nCTA: ${output.callToAction}\n\n${output.hashtags.join(' ')}`
    )
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <div className="pip-card space-y-4">
        {totalChunks === 0 && (
          <div className="flex items-center gap-2 bg-yellow-950/30 border border-yellow-900/50 rounded-lg px-3 py-2 text-xs text-yellow-400">
            <AlertCircle size={13} className="shrink-0" />
            No synced content yet — go to the Sync tab to pull in your Drive files.
          </div>
        )}
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
            <select value={platform} onChange={(e) => setPlatform(e.target.value as typeof platform)} className="pip-input">
              <option value="meta">Meta / Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="youtube">YouTube</option>
            </select>
          </div>
          <div>
            <label className="pip-label">Tone</label>
            <select value={tone} onChange={(e) => setTone(e.target.value as typeof tone)} className="pip-input">
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
          {loading
            ? <><Loader2 size={16} className="animate-spin" /> Generating…</>
            : <><Wand2 size={16} /> Generate with My Voice</>}
        </button>
        {error && (
          <div className="bg-red-950/50 border border-red-800 text-red-400 text-sm rounded-lg px-3 py-2">{error}</div>
        )}
      </div>

      <div className="pip-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium text-white">Output</h2>
          {output && (
            <button onClick={copyAll} className="pip-button-secondary flex items-center gap-1.5 text-xs py-1.5 px-3">
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copied!' : 'Copy all'}
            </button>
          )}
        </div>
        {!output && !loading && (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <p className="text-4xl mb-3">🎙️</p>
            <p className="text-gray-500 text-sm max-w-48">
              Describe what you're promoting and generate copy that sounds like <em>you</em>
            </p>
          </div>
        )}
        {loading && (
          <div className="flex flex-col items-center justify-center h-64">
            <Loader2 size={24} className="animate-spin text-pip-400 mb-3" />
            <p className="text-gray-500 text-sm">Reading your voice…</p>
          </div>
        )}
        {output && (
          <div className="space-y-5">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Headline</p>
              <p className="text-white font-semibold text-lg leading-snug">{output.headline}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Primary Text</p>
              <p className="text-gray-300 text-sm leading-relaxed">{output.primaryText}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">CTA</p>
                <span className="inline-block bg-pip-600/20 text-pip-300 text-sm px-3 py-1 rounded-full font-medium">{output.callToAction}</span>
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
  )
}

// ── Main Agent ────────────────────────────────────────────────────────────────

export function VoiceAgent() {
  const [activeTab,    setActiveTab]    = useState<Tab>('generate')
  const [showSources,  setShowSources]  = useState(false)
  const { stats } = useDriveConfig()
  const { totalChunks } = useDriveSync()

  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: string }[] = [
    {
      id:    'generate',
      label: 'Generate',
      icon:  <Wand2 size={14} />,
    },
    {
      id:    'sync',
      label: 'Sync',
      icon:  <DatabaseZap size={14} />,
      badge: stats.readyToSync > 0 && totalChunks === 0 ? '!' : undefined,
    },
  ]

  return (
    <div>
      <Header
        title="🎙️ Voice Agent"
        subtitle="Generate ad copy and content in your exact voice, powered by your Drive files."
      />

      {/* Tab bar + Manage Sources button */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-pip-600 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <span className="flex items-center gap-1.5">
                {tab.icon}
                {tab.label}
              </span>
              {tab.badge && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                  activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowSources(!showSources)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
            showSources
              ? 'bg-gray-800 border-gray-600 text-gray-200'
              : 'border-gray-800 text-gray-500 hover:text-gray-300 hover:border-gray-700'
          }`}
        >
          <Settings2 size={14} />
          Manage Sources
          {stats.unclassified > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full font-bold bg-yellow-500/20 text-yellow-400">
              {stats.unclassified}
            </span>
          )}
        </button>
      </div>

      {/* Manage Sources panel — collapsible */}
      {showSources && (
        <div className="pip-card mb-6">
          <DriveFileManager />
        </div>
      )}

      {/* Tab content */}
      {activeTab === 'generate' && <GeneratePanel />}
      {activeTab === 'sync' && (
        <div className="pip-card max-w-lg">
          <DriveSyncPanel onManageSources={() => { setShowSources(true) }} />
        </div>
      )}
    </div>
  )
}
