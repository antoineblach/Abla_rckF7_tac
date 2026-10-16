// File download fallback for manual exports (SPEC 8.6, 8.7) and for the exports when no folder
// is chosen (SPEC 9.1).
function downloadBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 1000)
}

export function downloadText(fileName: string, text: string): void {
  downloadBlob(fileName, new Blob([text], { type: 'application/json' }))
}

export function downloadBytes(fileName: string, bytes: Uint8Array, mime: string): void {
  downloadBlob(fileName, new Blob([bytes.slice()], { type: mime }))
}
