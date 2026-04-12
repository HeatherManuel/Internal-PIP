import { useState } from 'react'
import {
  FolderOpen, FileText, Loader2, RefreshCw,
  AlertCircle, CheckSquare, Square, ChevronDown,
  ChevronRight, Search, Info,
} from 'lucide-react'
import {
  useDriveConfig,
  ContentType,
  CONTENT_TYPE_META,
  type DriveFileConfig,
  type FolderGroup,
} from '@/hooks/useDriveConfig'

// ── Content Type Selector ─────────────────────────────────────────────────────

function ContentTypeBadge({
  value,
  onChange,
  compact = false,
}: {
  value: ContentType
  onChange: (v: ContentType) => void
  compact?: boolean
}) {
  const meta = CONTENT_TYPE_META[value]
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as ContentType)}
      className={`
        text-xs font-medium rounded-full border-0 cursor-pointer
        focus:outline-none focus:ring-1 focus:ring-pip-500
        ${meta.bg} ${meta.color}
        ${compact ? 'px-2 py-0.5' : 'px-3 py-1'}
      `}
      style={{ appearance: 'none' }}
    >
      {(Object.keys(CONTENT_TYPE_META) as ContentType[]).map((ct) => (
        <option key={ct} value={ct} className="bg-gray-900 text-gray-200">
          {CONTENT_TYPE_META[ct].label}
        </option>
      ))}
    </select>
  )
}

// ── Mime type icon label ──────────────────────────────────────────────────────

function mimeLabel(mime: string): string {
  const map: Record<string, string> = {
    'application/vnd.google-apps.document':     'Doc',
    'application/vnd.google-apps.spreadsheet':  'Sheet',
    'application/vnd.google-apps.presentation': 'Slides',
    'text/plain':    'TXT',
    'text/markdown': 'MD',
    'application/pdf': 'PDF',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  }
  return map[mime] ?? 'File'
}

// ── Folder Row ────────────────────────────────────────────────────────────────

function FolderRow({
  group,
  selectedIds,
  onToggleFolder,
  onSelectAll,
  onBulkTag,
  onTagFile,
}: {
  group: FolderGroup
  selectedIds: Set<string>
  onToggleFolder: (folderId: string | null) => void
  onSelectAll: (fileIds: string[], selected: boolean) => void
  onBulkTag: (fileIds: string[], type: ContentType) => void
  onTagFile: (fileId: string, type: ContentType) => void
}) {
  const [open, setOpen] = useState(true)
  const fileIds = group.files.map((f) => f.file_id)
  const allSelected = fileIds.every((id) => selectedIds.has(id))
  const someSelected = fileIds.some((id) => selectedIds.has(id))

  return (
    <div className="border border-gray-800 rounded-xl overflow-hidden">
      {/* Folder header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-800/40 select-none">
        <button
          onClick={() => onSelectAll(fileIds, !allSelected)}
          className="text-gray-500 hover:text-gray-300 transition-colors shrink-0"
        >
          {allSelected
            ? <CheckSquare size={15} className="text-pip-400" />
            : someSelected
              ? <CheckSquare size={15} className="text-gray-500" />
              : <Square size={15} />}
        </button>

        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 flex-1 text-left"
        >
          {open ? <ChevronDown size={14} className="text-gray-500" /> : <ChevronRight size={14} className="text-gray-500" />}
          <FolderOpen size={15} className="text-yellow-500/70 shrink-0" />
          <span className="text-sm font-medium text-gray-200">{group.folderName}</span>
          <span className="text-xs text-gray-600 ml-1">({group.files.length})</span>
        </button>

        {/* Bulk tag dropdown for this folder */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-600">Tag all:</span>
          <select
            className="text-xs bg-gray-700 border border-gray-600 text-gray-300 rounded-lg px-2 py-1 cursor-pointer focus:outline-none focus:ring-1 focus:ring-pip-500"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                onBulkTag(fileIds, e.target.value as ContentType)
                e.target.value = ''
              }
            }}
          >
            <option value="" disabled>Choose…</option>
            {(Object.keys(CONTENT_TYPE_META) as ContentType[])
              .filter((ct) => ct !== 'unclassified')
              .map((ct) => (
                <option key={ct} value={ct}>{CONTENT_TYPE_META[ct].label}</option>
              ))}
          </select>
        </div>
      </div>

      {/* File rows */}
      {open && (
        <div className="divide-y divide-gray-800/50">
          {group.files.map((file) => (
            <FileRow
              key={file.file_id}
              file={file}
              selected={selectedIds.has(file.file_id)}
              onToggle={() => onToggleFolder(file.file_id)}
              onTag={(type) => onTagFile(file.file_id, type)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── File Row ──────────────────────────────────────────────────────────────────

function FileRow({
  file,
  selected,
  onToggle,
  onTag,
}: {
  file: DriveFileConfig
  selected: boolean
  onToggle: () => void
  onTag: (type: ContentType) => void
}) {
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${selected ? 'bg-pip-900/20' : 'hover:bg-gray-800/30'}`}>
      <button onClick={onToggle} className="text-gray-600 hover:text-gray-300 transition-colors shrink-0">
        {selected ? <CheckSquare size={14} className="text-pip-400" /> : <Square size={14} />}
      </button>

      <FileText size={13} className="text-gray-600 shrink-0" />

      <span className="flex-1 text-sm text-gray-300 truncate" title={file.file_name}>
        {file.file_name}
      </span>

      <span className="text-xs text-gray-600 shrink-0 w-10 text-right">
        {mimeLabel(file.mime_type)}
      </span>

      <ContentTypeBadge
        value={file.content_type}
        onChange={onTag}
        compact
      />
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function DriveFileManager() {
  const {
    folderGroups, stats, loading,
    discoverState, discoverError,
    saving, discoverFiles, updateFile, bulkUpdateFiles,
  } = useDriveConfig()

  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set())
  const [search,       setSearch]       = useState('')
  const [filterType,   setFilterType]   = useState<ContentType | 'all'>('all')

  // ── Selection helpers ─────────────────────────────────────────────────────
  const toggleSelect = (fileId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(fileId) ? next.delete(fileId) : next.add(fileId)
      return next
    })
  }

  const selectRange = (fileIds: string[], selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      fileIds.forEach((id) => selected ? next.add(id) : next.delete(id))
      return next
    })
  }

  const clearSelection = () => setSelectedIds(new Set())

  // ── Filter + search groups ────────────────────────────────────────────────
  const filteredGroups = folderGroups
    .map((group) => ({
      ...group,
      files: group.files.filter((f) => {
        const matchSearch = search === '' || f.file_name.toLowerCase().includes(search.toLowerCase())
        const matchType   = filterType === 'all' || f.content_type === filterType
        return matchSearch && matchType
      }),
    }))
    .filter((g) => g.files.length > 0)

  const isDiscovering = discoverState === 'running'
  const hasFiles      = stats.total > 0

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-medium text-white text-base">Drive File Manager</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Tags auto-save instantly — only scan again when you add new files to Drive
          </p>
        </div>
        <button
          onClick={discoverFiles}
          disabled={isDiscovering || loading}
          className="pip-button-primary flex items-center gap-2 text-sm py-2"
        >
          {isDiscovering
            ? <><Loader2 size={14} className="animate-spin" /> Scanning…</>
            : <><RefreshCw size={14} /> {hasFiles ? 'Scan for New Files' : 'Scan Drive'}</>}
        </button>
      </div>

      {/* Error */}
      {discoverState === 'error' && discoverError && (
        <div className="bg-red-950/50 border border-red-800 text-red-400 text-sm rounded-lg px-3 py-2 flex items-center gap-2">
          <AlertCircle size={14} className="shrink-0" />
          {discoverError}
        </div>
      )}

      {/* Loading from DB — don't flash the empty state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="animate-spin text-pip-400 mr-2" />
          <span className="text-gray-500 text-sm">Loading your file classifications…</span>
        </div>
      )}

      {/* Empty state — only shown after DB load confirms no files exist */}
      {!loading && !hasFiles && !isDiscovering && discoverState !== 'error' && (
        <div className="pip-card text-center py-10">
          <FolderOpen size={32} className="text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400 text-sm font-medium mb-1">No files discovered yet</p>
          <p className="text-gray-600 text-xs max-w-72 mx-auto">
            Click <strong className="text-gray-400">Scan Drive</strong> to see all files your service account can access. Nothing is embedded until you classify and approve files here.
          </p>
        </div>
      )}

      {!loading && hasFiles && (
        <>
          {/* Stats bar */}
          <div className="grid grid-cols-3 gap-2 xl:grid-cols-6">
            {(Object.keys(CONTENT_TYPE_META) as ContentType[]).map((ct) => {
              const meta  = CONTENT_TYPE_META[ct]
              const count = stats[ct as keyof typeof stats] as number
              return (
                <button
                  key={ct}
                  onClick={() => setFilterType(filterType === ct ? 'all' : ct)}
                  className={`rounded-lg px-3 py-2 text-center transition-all border ${
                    filterType === ct
                      ? `${meta.bg} border-current ${meta.color}`
                      : 'bg-gray-800/40 border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <p className={`text-lg font-bold ${filterType === ct ? meta.color : 'text-white'}`}>{count}</p>
                  <p className="text-xs text-gray-500 leading-none mt-0.5">{meta.label}</p>
                </button>
              )
            })}
          </div>

          {/* Info callout */}
          {stats.unclassified > 0 && (
            <div className="flex items-start gap-2 bg-yellow-950/30 border border-yellow-900/50 rounded-lg px-3 py-2.5 text-xs text-yellow-400">
              <Info size={13} className="shrink-0 mt-0.5" />
              <span>
                <strong>{stats.unclassified} file{stats.unclassified !== 1 ? 's' : ''}</strong> not yet classified.
                Unclassified files are never synced. Use <strong>Tag all</strong> on a folder or tag individual files.
              </span>
            </div>
          )}

          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 bg-pip-900/30 border border-pip-800/50 rounded-lg px-4 py-2.5">
              <span className="text-sm text-pip-300 font-medium">{selectedIds.size} selected</span>
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs text-gray-500">Tag as:</span>
                {(Object.keys(CONTENT_TYPE_META) as ContentType[])
                  .filter((ct) => ct !== 'unclassified')
                  .map((ct) => {
                    const meta = CONTENT_TYPE_META[ct]
                    return (
                      <button
                        key={ct}
                        disabled={saving}
                        onClick={() => {
                          bulkUpdateFiles([...selectedIds], ct)
                          clearSelection()
                        }}
                        className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${meta.bg} ${meta.color} hover:opacity-80`}
                      >
                        {meta.label}
                      </button>
                    )
                  })}
                <button onClick={clearSelection} className="text-xs text-gray-500 hover:text-gray-300 ml-2">
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Search + filter row */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Search files…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pip-input pl-8 text-sm py-1.5"
              />
            </div>
            {filterType !== 'all' && (
              <button
                onClick={() => setFilterType('all')}
                className="text-xs text-gray-400 hover:text-gray-200 whitespace-nowrap"
              >
                Clear filter
              </button>
            )}
            <span className="text-xs text-gray-600 whitespace-nowrap">
              {stats.readyToSync} ready to sync
            </span>
          </div>

          {/* File groups */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-pip-400" />
            </div>
          ) : (
            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {filteredGroups.length === 0 ? (
                <p className="text-center text-gray-600 text-sm py-6">No files match your search.</p>
              ) : (
                filteredGroups.map((group) => (
                  <FolderRow
                    key={group.folderId ?? '__root__'}
                    group={group}
                    selectedIds={selectedIds}
                    onToggleFolder={toggleSelect}
                    onSelectAll={selectRange}
                    onBulkTag={(ids, type) => { bulkUpdateFiles(ids, type); clearSelection() }}
                    onTagFile={updateFile}
                  />
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
