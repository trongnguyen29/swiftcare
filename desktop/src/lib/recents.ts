// Recently-opened patients, persisted in localStorage for quick access on Home.

export interface RecentPatient {
  ptnum: string
  name: string
  label: number
}

const KEY = 'recent_patients_v1'
const MAX = 10

export function getRecents(): RecentPatient[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as RecentPatient[]) : []
  } catch {
    return []
  }
}

export function recordRecent(p: {
  ptnum: string
  first_name: string | null
  last_name: string | null
  label: number
}): RecentPatient[] {
  const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || p.ptnum
  const entry: RecentPatient = { ptnum: p.ptnum, name, label: p.label }
  const list = [entry, ...getRecents().filter(r => r.ptnum !== p.ptnum)].slice(0, MAX)
  localStorage.setItem(KEY, JSON.stringify(list))
  return list
}
