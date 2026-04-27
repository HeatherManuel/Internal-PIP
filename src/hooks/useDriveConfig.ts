import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export type ContentType =
  | 'unclassified'
  | 'voice_sample'
  | 'approved'
  | 'reference'
  | 'exclude'

export const CONTENT_TYPE_META: Record<ContentType, { label: string; bg: string; color: string }> = {
  unclassified: { label: 'Unclassified', bg: 'bg-gray-800',    color: 'text-gray-400'   },
  voice_sample: { label: 'Voice Sample', bg: 'bg-pip-900/40',  color: 'text-pip-300'    },
  approved:     { label: 'Approved',     bg: 'bg-green-900/40',color: 'text-green-400'  },
  reference:    { label: 'Reference',    bg: 'bg-blue-900/40', color: 'text-blue-400'   },
  exclude:      { label: 'Exclude',      bg: 'bg-red-900/40',  color: 'text-red-400'    },
}

export interface DriveFileConfig {
  file_id:      string
  file_name:    string
  mime_type:    string
  content_type: ContentType
  folder_id:    string | null
  folder_name:  string | null
}

export interface FolderGroup {
  folderId:   string | null
  folderName: string
  files:      DriveFileConfig[]
}

interface Stats {
  total:        number
  unclassified: number
  voice_sample: number
  approved:     number
  reference:    number
  exclude:      number
  readyToSync:  number
}

const EMPTY_STATS: Stats = {
  total: 0, unclassified: 0, voice_sample: 0,
  approved: 0, reference: 0, exclude: 0, readyToSync: 0,
}

export function useDriveConfig() {
  const [folderGroups,   setFolderGroups]   = useState<FolderGroup[]>([])
  const [stats,          setStats]          = useState<Stats>(EMPTY_STATS)
  const [loading,        setLoading]        = useState(true)
  const [saving,         setSaving]         = useState(false)
  const [discoverState,  setDiscoverState]  = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [discoverError,  setDiscoverError]  = useState<string | null>(null)

  useEffect(() => { loadFiles() }, [])

  async function loadFiles() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('drive_file_configs')
        .select('*')
        .order('folder_name', { ascending: true })
      if (error) throw error

      const files = (data ?? []) as DriveFileConfig[]
      setFolderGroups(groupByFolder(files))
      setStats(computeStats(files))
    } catch {
      // silently fail — drive may not be configured yet
    } finally {
      setLoading(false)
    }
  }

  async function discoverFiles() {
    setDiscoverState('running')
    setDiscoverError(null)
    try {
      const { error } = await supabase.functions.invoke('sync-drive-content', {
        body: { action: 'discover' },
      })
      if (error) throw error
      await loadFiles()
      setDiscoverState('done')
    } catch (err) {
      setDiscoverError(err instanceof Error ? err.message : 'Discovery failed')
      setDiscoverState('error')
    }
  }

  async function updateFile(fileId: string, type: ContentType) {
    setSaving(true)
    await supabase
      .from('drive_file_configs')
      .update({ content_type: type })
      .eq('file_id', fileId)
    setSaving(false)
    setFolderGroups((prev) =>
      prev.map((g) => ({
        ...g,
        files: g.files.map((f) =>
          f.file_id === fileId ? { ...f, content_type: type } : f
        ),
      }))
    )
  }

  async function bulkUpdateFiles(fileIds: string[], type: ContentType) {
    setSaving(true)
    await supabase
      .from('drive_file_configs')
      .update({ content_type: type })
      .in('file_id', fileIds)
    setSaving(false)
    setFolderGroups((prev) =>
      prev.map((g) => ({
        ...g,
        files: g.files.map((f) =>
          fileIds.includes(f.file_id) ? { ...f, content_type: type } : f
        ),
      }))
    )
  }

  return {
    folderGroups, stats, loading, saving,
    discoverState, discoverError,
    discoverFiles, updateFile, bulkUpdateFiles,
  }
}

function groupByFolder(files: DriveFileConfig[]): FolderGroup[] {
  const map = new Map<string, FolderGroup>()
  for (const f of files) {
    const key = f.folder_id ?? '__root__'
    if (!map.has(key)) {
      map.set(key, { folderId: f.folder_id, folderName: f.folder_name ?? 'My Drive', files: [] })
    }
    map.get(key)!.files.push(f)
  }
  return Array.from(map.values())
}

function computeStats(files: DriveFileConfig[]): Stats {
  const s = { ...EMPTY_STATS, total: files.length }
  for (const f of files) {
    s[f.content_type] = (s[f.content_type] ?? 0) + 1
  }
  s.readyToSync = s.approved + s.voice_sample
  return s
}
