import { useMemo, useRef, useState } from 'react'

function formatBytes(bytes) {
  if (!bytes) return '0 KB'

  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** index

  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`
}

export default function DocumentUpload({
  label = 'Upload document',
  helperText = 'Accepted: PDF, JPG, PNG, DOCX',
  accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx',
  maxFiles = 3,
  onFilesChange,
}) {
  const fileInputRef = useRef(null)
  const [files, setFiles] = useState([])

  const totalSize = useMemo(
    () => files.reduce((sum, file) => sum + (file.size || 0), 0),
    [files],
  )

  const addFiles = (incomingFiles) => {
    const selected = Array.from(incomingFiles || [])
    const existingKeys = new Set(files.map((file) => `${file.name}-${file.size}-${file.lastModified}`))

    const nextFiles = selected
      .filter((file) => !existingKeys.has(`${file.name}-${file.size}-${file.lastModified}`))
      .map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        status: 'Ready',
        lastModified: file.lastModified,
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      }))

    const merged = [...files, ...nextFiles].slice(0, maxFiles)
    setFiles(merged)
    onFilesChange?.(merged)
  }

  const handleInputChange = (event) => {
    addFiles(event.target.files)
    event.target.value = ''
  }

  const removeFile = (fileId) => {
    const removedFile = files.find((file) => file.id === fileId)

    if (removedFile?.previewUrl) {
      URL.revokeObjectURL(removedFile.previewUrl)
    }

    const updated = files.filter((file) => file.id !== fileId)
    setFiles(updated)
    onFilesChange?.(updated)
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{helperText}</p>
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
        >
          Select file
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={maxFiles > 1}
        className="hidden"
        onChange={handleInputChange}
      />

      <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-800/60">
        {files.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No documents selected yet.</p>
        ) : (
          <div className="space-y-3">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {file.previewUrl ? (
                    <img src={file.previewUrl} alt={file.name} className="h-12 w-12 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-50 text-lg text-primary dark:bg-slate-800">
                      📄
                    </div>
                  )}

                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{file.name}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>{formatBytes(file.size)}</span>
                      <span>•</span>
                      <span className="font-medium text-primary">{file.status}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removeFile(file.id)}
                  className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:border-red-400 hover:text-red-500 dark:border-slate-600 dark:text-slate-300"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {files.length > 0 && (
        <div className="mt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>{files.length}/{maxFiles} files</span>
          <span>Total: {formatBytes(totalSize)}</span>
        </div>
      )}
    </div>
  )
}