import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface SyncResult {
  fileId:   string
  fileName: string
  status:   'synced' | 'skipped' | 'error'
  chunks?:  number
  error?:   string
}

interface SyncSummary {
  synced:  number
  skipped: number
  errors:  number
}

interface SyncLogEntry {
  file_id:        string
  file_name:      string
  status:         string
  mime_type:      string
  chunks_created: number
}

type SyncState = 'idle' | 'running' | 'done' | 'error'

export function useDriveSync() {
  const [state,       setState]       = useState<SyncState>('idle')
  const [summary,     setSummary]     = useState<SyncSummary | null>(null)
  const [results,     setResults]     = useState<SyncResult[]>([])
  const [syncLog,     setSyncLog]     = useState<SyncLogEntry[]>([])
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null)
  const [totalChunks, setTotalChunks] = useState(0)

  useEffect(() => { loadTotalChunks() }, [])

  async function loadTotalChunks() {
    try {
      const { count } = await supabase
        .from('drive_content')
        .select('*', { count: 'exact', head: true })
        .not('raw_text', 'is', null)
      setTotalChunks(count ?? 0)
    } catch {
      // table may not exist yet
    }
  }

  async function runSync(force: boolean) {
    setState('running')
    setErrorMsg(null)
    setSummary(null)
    setResults([])

    try {
      const { data, error } = await supabase.functions.invoke('sync-drive-content', {
        body: { action: 'sync', force },
      })
      if (error) throw error

      const d = data as { results?: SyncResult[]; syncLog?: SyncLogEntry[] }
      const r = d.results ?? []
      setResults(r)
      setSyncLog(d.syncLog ?? [])
      setSummary({
        synced:  r.filter((x) => x.status === 'synced').length,
        skipped: r.filter((x) => x.status === 'skipped').length,
        errors:  r.filter((x) => x.status === 'error').length,
      })
      setState('done')
      await loadTotalChunks()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Sync failed')
      setState('error')
    }
  }

  return { state, summary, results, syncLog, errorMsg, totalChunks, runSync }
}
