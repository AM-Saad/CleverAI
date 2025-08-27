export const useCalcChunkSize = (fileSize: number): number => {
  const maxChunkSize = 5 * 1024 * 1024 // 5 MB
  const minChunkSize = 256 * 1024 // 256 KB
  let chunkSize = Math.ceil(fileSize / 100) // Example strategy to create 100 chunks
  chunkSize = Math.max(chunkSize, minChunkSize)
  chunkSize = Math.min(chunkSize, maxChunkSize)
  return chunkSize
}
