export type Responsive = {
  isMobile(): boolean
  subscribe(cb: (isMobile: boolean) => void): () => void
}

export function createResponsive(query = '(max-width: 768px)'): Responsive {
  const mql = matchMedia(query)
  const subs = new Set<(v: boolean) => void>()
  mql.addEventListener('change', e => { for (const s of subs) s(e.matches) })
  return {
    isMobile: () => mql.matches,
    subscribe(cb) { subs.add(cb); return () => subs.delete(cb) },
  }
}
