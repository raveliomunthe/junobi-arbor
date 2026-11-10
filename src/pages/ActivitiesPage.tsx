import { useMemo, useState } from 'react'
import TransactionDetail from '../components/transactions/TransactionDetail'
import TransactionRow from '../components/transactions/TransactionRow'
import { fieldClass, glassCardPadded, secondaryButton } from '../components/ui/glass'
import { Icon } from '../components/ui/icons'
import PageShell from '../components/ui/PageShell'
import { expenseColor, incomeColor, transactionAmount, transactionTitle } from '../data/display'
import { sortByNewest, timeOf } from '../data/finance'
import { useAppData, useNow } from '../data/hooks'
import type { Transaction } from '../data/types'
import { addDays, formatDayHeading, formatRupiah, formatSignedRupiah, parseLocalDate, startOfDay, toDateValue } from '../lib/format'

type TypeFilter = 'all' | 'income' | 'expense'
type DatePreset = 'all' | 'today' | 'yesterday' | '7d' | '30d' | 'custom'

const PAGE_SIZE = 30

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'income', label: 'Pemasukan' },
  { value: 'expense', label: 'Pengeluaran' },
]

const DATE_OPTIONS: { value: DatePreset; label: string }[] = [
  { value: 'all', label: 'Semua tanggal' },
  { value: 'today', label: 'Hari ini' },
  { value: 'yesterday', label: 'Kemarin' },
  { value: '7d', label: '7 hari terakhir' },
  { value: '30d', label: '30 hari terakhir' },
  { value: 'custom', label: 'Pilih tanggal' },
]

// Returns [from, to) in ms, or null when the date filter should not restrict anything.
function dateRange(preset: DatePreset, customDate: string, now: number): [number, number] | null {
  const today = startOfDay(now)
  switch (preset) {
    case 'today':
      return [today, addDays(today, 1)]
    case 'yesterday':
      return [addDays(today, -1), today]
    case '7d':
      return [addDays(today, -6), addDays(today, 1)]
    case '30d':
      return [addDays(today, -29), addDays(today, 1)]
    case 'custom': {
      const day = parseLocalDate(customDate)
      return Number.isNaN(day) ? null : [day, addDays(day, 1)]
    }
    default:
      return null
  }
}

function searchText(transaction: Transaction): string {
  const amount = transactionAmount(transaction)
  return [
    transactionTitle(transaction),
    transaction.category,
    transaction.paymentMethod,
    transaction.notes,
    transaction.type === 'income' ? 'income pemasukan penjualan' : 'expense pengeluaran',
    String(amount),
    formatRupiah(amount),
  ]
    .join(' ')
    .toLowerCase()
}

function ActivitiesPage({ focusTransactionId }: { focusTransactionId?: string }) {
  const { data } = useAppData()
  const now = useNow()
  const [query, setQuery] = useState('')
  const [type, setType] = useState<TypeFilter>('all')
  const [preset, setPreset] = useState<DatePreset>('all')
  const [customDate, setCustomDate] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(focusTransactionId ?? null)
  const [paging, setPaging] = useState({ key: '', limit: PAGE_SIZE })

  const filterKey = [query, type, preset, customDate].join('|')
  const limit = paging.key === filterKey ? paging.limit : PAGE_SIZE
  const hasFilters = query.trim() !== '' || type !== 'all' || preset !== 'all'

  const filtered = useMemo(() => {
    const range = dateRange(preset, customDate, now)
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
    return sortByNewest(data.transactions).filter((transaction) => {
      if (type !== 'all' && transaction.type !== type) return false
      if (range) {
        const time = timeOf(transaction)
        if (time < range[0] || time >= range[1]) return false
      }
      if (tokens.length > 0) {
        const text = searchText(transaction)
        if (!tokens.every((token) => text.includes(token))) return false
      }
      return true
    })
  }, [data.transactions, query, type, preset, customDate, now])

  const totals = useMemo(() => {
    let income = 0
    let expense = 0
    for (const transaction of filtered) {
      if (transaction.type === 'income') income += transaction.total
      else expense += transaction.amount
    }
    return { income, expense }
  }, [filtered])

  const visible = useMemo(() => filtered.slice(0, limit), [filtered, limit])
  const groups = useMemo(() => {
    const result: { day: number; items: Transaction[] }[] = []
    for (const transaction of visible) {
      const day = startOfDay(timeOf(transaction))
      const last = result[result.length - 1]
      if (last && last.day === day) last.items.push(transaction)
      else result.push({ day, items: [transaction] })
    }
    return result
  }, [visible])

  const selected = selectedId ? data.transactions.find((transaction) => transaction.id === selectedId) : undefined

  const clearFilters = () => {
    setQuery('')
    setType('all')
    setPreset('all')
    setCustomDate('')
  }

  const typeButton = (active: boolean) =>
    `rounded-full px-4 py-2 text-xs font-bold transition-[transform,background-color] active:scale-[0.97] ${active ? 'bg-[#2d2d2d] text-[#F5F5F5]' : 'bg-white/50 text-[#2d2d2d] hover:bg-white/80'}`

  return (
    <PageShell title="Activities">
      <div className="space-y-3">
        <div className={`${glassCardPadded} space-y-3`}>
          <label className="relative block">
            <span className="sr-only">Cari transaksi</span>
            <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 mt-[3px] size-4 -translate-y-1/2 text-[#555555]" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari nama, kategori, metode pembayaran, catatan, atau nominal"
              className={`${fieldClass} !pl-9`}
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Filter jenis transaksi" className="flex gap-2">
              {TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={type === option.value}
                  onClick={() => setType(option.value)}
                  className={typeButton(type === option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs font-bold">
              <span className="sr-only">Filter tanggal</span>
              <select
                value={preset}
                onChange={(event) => setPreset(event.target.value as DatePreset)}
                className={`${fieldClass} !mt-0 !w-auto`}
              >
                {DATE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            {preset === 'custom' && (
              <label className="flex items-center gap-2 text-xs font-bold">
                <span className="sr-only">Tanggal</span>
                <input
                  type="date"
                  value={customDate}
                  max={toDateValue(now)}
                  onChange={(event) => setCustomDate(event.target.value)}
                  className={`${fieldClass} !mt-0 !w-auto`}
                />
              </label>
            )}
            {hasFilters && (
              <button type="button" onClick={clearFilters} className={secondaryButton}>
                Reset filter
              </button>
            )}
          </div>
          {preset === 'custom' && customDate === '' && (
            <p className="text-xs text-[#555555]">Pilih tanggal untuk menyaring transaksi pada hari tersebut.</p>
          )}
        </div>

        {data.transactions.length === 0 ? (
          <div className={`${glassCardPadded} py-12 text-center`}>
            <p className="text-base font-black">Belum ada aktivitas</p>
            <p className="mt-1 text-sm text-[#555555]">Tekan tombol + di navbar untuk mencatat penjualan atau pengeluaran pertama Anda.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className={`${glassCardPadded} py-12 text-center`}>
            <p className="text-base font-black">Tidak ada transaksi yang cocok</p>
            <p className="mt-1 text-sm text-[#555555]">Coba kata kunci atau filter yang berbeda.</p>
            <button type="button" onClick={clearFilters} className={`mt-4 ${secondaryButton}`}>Reset filter</button>
          </div>
        ) : (
          <>
            <p className="px-1 text-xs text-[#555555]" aria-live="polite">
              {filtered.length} transaksi ·{' '}
              <span className={`font-bold ${incomeColor}`}>Pemasukan {formatRupiah(totals.income)}</span> ·{' '}
              <span className={`font-bold ${expenseColor}`}>Pengeluaran {formatRupiah(totals.expense)}</span>
            </p>
            {groups.map((group) => {
              const net = group.items.reduce(
                (sum, transaction) => sum + (transaction.type === 'income' ? transaction.total : -transaction.amount),
                0,
              )
              return (
                <section key={group.day} aria-label={formatDayHeading(group.day, now)} className={glassCardPadded}>
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="text-sm font-black">{formatDayHeading(group.day, now)}</h2>
                    <p className="text-xs font-bold text-[#555555]">Arus kas {formatSignedRupiah(net)}</p>
                  </div>
                  <ul className="mt-3 space-y-2">
                    {group.items.map((transaction) => (
                      <li key={transaction.id}>
                        <TransactionRow transaction={transaction} timeOnly onSelect={(item) => setSelectedId(item.id)} />
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
            {filtered.length > visible.length && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setPaging({ key: filterKey, limit: limit + PAGE_SIZE })}
                  className={secondaryButton}
                >
                  Tampilkan lebih banyak ({filtered.length - visible.length} lagi)
                </button>
              </div>
            )}
          </>
        )}
      </div>
      {selected && <TransactionDetail transaction={selected} onClose={() => setSelectedId(null)} />}
    </PageShell>
  )
}

export default ActivitiesPage
