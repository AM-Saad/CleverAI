// server/api/form-sync.post.ts
export default defineEventHandler(async (event) => {
  const textDecoder = new TextDecoder()
  const bad = (m: string) => { setResponseStatus(event, 400); return { ok: false, error: m } }

  // 1) Parse multipart (SW uses FormData)
  let raw: string | null = null
  try {
    const parts = await readMultipartFormData(event)
    const dataPart = parts?.find(p => p.name === 'data')
    if (dataPart?.data) raw = textDecoder.decode(dataPart.data)
  } catch {}

  // 2) Fallback: JSON body
  if (!raw) {
    try {
      const body = await readBody<{ data?: unknown } | unknown>(event)
      raw = JSON.stringify((body && (body as any).data !== undefined) ? (body as any).data : body)
    } catch {}
  }
  if (!raw) return bad('Missing payload: expected multipart "data" or JSON body')

  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return bad('Invalid JSON in "data"') }

  const list = Array.isArray(parsed) ? parsed : [parsed]
  const sample = list.slice(0, 3).map((it: any) => ({
    id: String(it?.id ?? ''), email: String(it?.email ?? ''), createdAt: Number(it?.createdAt ?? Date.now())
  }))

  // 3) Minimal throttle to test SW retry (per-IP, burst 2)
  // NOTE: in-memory; fine for local/dev, not for multi-instance prod.
  const ip = getRequestIP(event) || 'unknown'
  const key = `fs:${ip}`
  const now = Date.now()
  event.context.__rate ||= new Map<string, number[]>()
  const map: Map<string, number[]> = event.context.__rate
  const windowMs = 10_000 // 10s window
  const maxReq = 2
  const arr = (map.get(key) || []).filter(ts => now - ts < windowMs)
  arr.push(now)
  map.set(key, arr)
  if (arr.length > maxReq) {
    setResponseStatus(event, 429)
    setHeader(event, 'Retry-After', '3') // seconds
    setHeader(event, 'Cache-Control', 'no-store')
    return { ok: false, error: 'Throttled. Try later.' }
  }

  // 4) (Optional) Persist to DB later
  setHeader(event, 'Cache-Control', 'no-store')
  return { ok: true, received: list.length, sample }
})
