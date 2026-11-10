import { percentChange } from '../../data/finance'
import type { Metrics } from '../../data/finance'
import { formatPercent, formatRupiah, formatSignedRupiah } from '../../lib/format'
import { glassCardPadded } from '../ui/glass'
import { Icon } from '../ui/icons'
import type { IconName } from '../ui/icons'

type Card = {
  title: string
  value: number
  icon: IconName
  // Whether a higher value is good news (false for expenses).
  upIsGood: boolean
  change: number | null | undefined
  caption: string
}

function Indicator({ card }: { card: Card }) {
  if (card.change === undefined) return <p className="mt-1 text-xs text-[#555555]">{card.caption}</p>
  if (card.change === null) return <p className="mt-1 text-xs text-[#555555]">Belum ada pembanding kemarin</p>
  if (Math.abs(card.change) < 0.05) return <p className="mt-1 text-xs text-[#555555]">Sama seperti kemarin</p>
  const up = card.change > 0
  const good = up === card.upIsGood
  return (
    <p className={`mt-1 flex items-center gap-1 text-xs font-bold ${good ? 'text-[#1f7a4d]' : 'text-[#b3261e]'}`}>
      <Icon name={up ? 'trend-up' : 'trend-down'} className="size-3.5" />
      {up ? '+' : '-'}
      {formatPercent(Math.abs(card.change))}
      <span className="font-medium text-[#555555]">vs kemarin (jam sama)</span>
    </p>
  )
}

export default function SummaryCards({ metrics }: { metrics: Metrics }) {
  const { today, yesterdaySoFar, cashBalance } = metrics
  const cards: Card[] = [
    {
      title: 'Total Pendapatan Hari Ini',
      value: today.revenue,
      icon: 'income',
      upIsGood: true,
      change: percentChange(today.revenue, yesterdaySoFar.revenue),
      caption: '',
    },
    {
      title: 'Total Pengeluaran Hari Ini',
      value: today.totalCosts,
      icon: 'expense',
      upIsGood: false,
      change: percentChange(today.totalCosts, yesterdaySoFar.totalCosts),
      caption: '',
    },
    {
      title: 'Estimasi Keuntungan Hari Ini',
      value: today.netProfit,
      icon: 'profit',
      upIsGood: true,
      change: percentChange(today.netProfit, yesterdaySoFar.netProfit),
      caption: '',
    },
    {
      title: 'Saldo Kas',
      value: cashBalance,
      icon: 'wallet',
      upIsGood: true,
      change: undefined,
      caption: `Hari ini: ${formatSignedRupiah(today.cashIn - today.cashOut)} (masuk ${formatRupiah(today.cashIn)}, keluar ${formatRupiah(today.cashOut)})`,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <article key={card.title} className={glassCardPadded}>
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-xs font-bold text-[#555555]">{card.title}</h2>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/60">
              <Icon name={card.icon} className="size-4" />
            </span>
          </div>
          <p className="mt-2 text-xl font-black break-words">{formatRupiah(card.value)}</p>
          <Indicator card={card} />
        </article>
      ))}
    </div>
  )
}
