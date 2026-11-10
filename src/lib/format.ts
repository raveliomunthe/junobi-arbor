const rupiah = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
})
const integer = new Intl.NumberFormat('id-ID')
const dateFormat = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
const longDateFormat = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const timeFormat = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })
const weekdayFormat = new Intl.DateTimeFormat('id-ID', { weekday: 'short' })

export const DAY_MS = 86_400_000

// Wall-clock read for event handlers; keeps components free of direct impure calls during render.
export const currentTime = (): number => Date.now()

export function formatRupiah(value: number): string {
  return rupiah.format(Math.round(value)).replace(/\u00a0/g, ' ')
}

export function formatSignedRupiah(value: number): string {
  return `${value >= 0 ? '+' : '-'}${formatRupiah(Math.abs(value))}`
}

export function formatCompactRupiah(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1).replace('.', ',').replace(/,0$/, '')} jt`
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)} rb`
  return `${sign}${Math.round(abs)}`
}

export function formatNumber(value: number): string {
  return integer.format(value)
}

const percentFormat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 })

export function formatPercent(value: number): string {
  return `${percentFormat.format(value)}%`
}

export function formatDate(ms: number): string {
  return dateFormat.format(ms)
}

export function formatTime(ms: number): string {
  return timeFormat.format(ms)
}

export function formatDateTime(ms: number): string {
  return `${formatDate(ms)}, ${formatTime(ms)}`
}

export function formatWeekday(ms: number): string {
  return weekdayFormat.format(ms)
}

export function startOfDay(ms: number): number {
  const date = new Date(ms)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

export function addDays(ms: number, days: number): number {
  const date = new Date(ms)
  date.setDate(date.getDate() + days)
  return date.getTime()
}

export function formatDayHeading(ms: number, now: number): string {
  const today = startOfDay(now)
  const day = startOfDay(ms)
  if (day === today) return 'Hari ini'
  if (day === addDays(today, -1)) return 'Kemarin'
  return longDateFormat.format(ms)
}

export function formatRelativeTime(ms: number, now: number): string {
  const diff = Math.max(0, now - ms)
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'Baru saja'
  if (minutes < 60) return `${minutes} menit lalu`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} jam lalu`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Kemarin'
  if (days < 30) return `${days} hari lalu`
  return formatDate(ms)
}

const pad = (value: number) => String(value).padStart(2, '0')

export function toDateValue(ms: number): string {
  const date = new Date(ms)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function toDateTimeLocalValue(ms: number): string {
  const date = new Date(ms)
  return `${toDateValue(ms)}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function parseLocalDate(value: string): number {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return Number.NaN
  return new Date(year, month - 1, day).getTime()
}
