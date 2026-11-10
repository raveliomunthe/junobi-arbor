import type { GoalProgress, InventoryStats, ProductPerformance } from '../../data/finance'
import type { Insight } from '../../data/insights'
import { formatNumber, formatPercent, formatRupiah } from '../../lib/format'
import { Icon } from '../ui/icons'
import type { IconName } from '../ui/icons'

const emptyText = 'text-sm text-[#555555]'

export function TopProducts({ products }: { products: ProductPerformance[] }) {
  const top = products.slice(0, 5)
  if (top.length === 0) return <p className={emptyText}>Belum ada penjualan dalam 7 hari terakhir.</p>
  const maxQuantity = Math.max(...top.map((item) => item.quantity))
  return (
    <ol className="space-y-3">
      {top.map((item, index) => (
        <li key={item.productId}>
          <div className="flex items-center gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/60 text-xs font-black">{index + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-sm font-bold">{item.name}</p>
                <p className="shrink-0 text-xs font-bold">{formatNumber(item.quantity)} terjual</p>
              </div>
              <p className="text-xs text-[#555555]">
                {formatRupiah(item.revenue)} · laba kotor {formatRupiah(item.grossProfit)}
              </p>
              <div aria-hidden="true" className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/60">
                <div className="h-full rounded-full bg-[#2d2d2d]" style={{ width: `${(item.quantity / maxQuantity) * 100}%` }} />
              </div>
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}

function Stat({ icon, label, value, warn }: { icon: IconName; label: string; value: number; warn?: boolean }) {
  return (
    <div className="rounded-2xl bg-white/40 p-3">
      <span className={`flex size-8 items-center justify-center rounded-full bg-white/60 ${warn ? 'text-[#b3261e]' : ''}`}>
        <Icon name={icon} className="size-4" />
      </span>
      <p className="mt-2 text-xl font-black">{formatNumber(value)}</p>
      <p className="text-xs text-[#555555]">{label}</p>
    </div>
  )
}

export function OperationalOverview({ inventory }: { inventory: InventoryStats }) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat icon="box" label="Total produk" value={inventory.totalProducts} />
        <Stat icon="layers" label="Total stok (unit)" value={inventory.totalStock} />
        <Stat icon="alert" label="Stok menipis" value={inventory.low.length} warn={inventory.low.length > 0} />
        <Stat icon="ban" label="Stok habis" value={inventory.out.length} warn={inventory.out.length > 0} />
      </div>
      <div className="mt-3 space-y-2" aria-live="polite">
        {inventory.out.map((product) => (
          <p key={product.id} className="flex items-center gap-2 rounded-2xl bg-[#b3261e]/10 px-3 py-2 text-xs font-bold text-[#b3261e]">
            <Icon name="ban" className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{product.name}</span>
            <span>Stok habis</span>
          </p>
        ))}
        {inventory.low.map((product) => (
          <p key={product.id} className="flex items-center gap-2 rounded-2xl bg-white/50 px-3 py-2 text-xs font-bold">
            <Icon name="alert" className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{product.name}</span>
            <span>
              Sisa {formatNumber(product.stock)} (min. {formatNumber(product.minStock)})
            </span>
          </p>
        ))}
        {inventory.out.length === 0 && inventory.low.length === 0 && <p className={emptyText}>Semua stok produk dalam kondisi aman.</p>}
      </div>
    </div>
  )
}

function ProgressBar({ label, hint, goal, icon }: { label: string; hint: string; goal: GoalProgress; icon: IconName }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-bold">
          <Icon name={icon} className="size-4" />
          {label}
        </p>
        <p className="text-sm font-black">{formatPercent(Math.min(goal.percent, 999))}</p>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(goal.barPercent)}
        className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/60"
      >
        <div className="h-full rounded-full bg-[#2d2d2d] transition-[width] duration-500" style={{ width: `${goal.barPercent}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-[#555555]">
        {formatRupiah(goal.current)} dari {formatRupiah(goal.target)} · {hint}
      </p>
      <p className={`text-xs font-bold ${goal.achieved ? 'text-[#1f7a4d]' : ''}`}>
        {goal.achieved ? 'Target tercapai 🎉' : `Kurang ${formatRupiah(goal.remaining)} lagi`}
      </p>
    </div>
  )
}

export function GoalsPanel({ savings, revenueGoal }: { savings: GoalProgress; revenueGoal: GoalProgress }) {
  return (
    <div className="space-y-5">
      <ProgressBar label="Target tabungan" hint="diukur dari saldo kas" goal={savings} icon="savings" />
      <ProgressBar label="Target pendapatan" hint="30 hari terakhir" goal={revenueGoal} icon="target" />
    </div>
  )
}

const toneStyle: Record<Insight['tone'], { icon: IconName; color: string }> = {
  positive: { icon: 'trend-up', color: 'text-[#1f7a4d]' },
  warning: { icon: 'alert', color: 'text-[#b3261e]' },
  info: { icon: 'spark', color: 'text-[#2d2d2d]' },
}

export function InsightsList({ insights, onSelect }: { insights: Insight[]; onSelect?: (insight: Insight) => void }) {
  if (insights.length === 0) return <p className={emptyText}>Belum ada insight. Catat beberapa transaksi untuk memulai.</p>
  return (
    <ul className="grid gap-2 md:grid-cols-2">
      {insights.map((insight) => {
        const style = toneStyle[insight.tone]
        const body = (
          <>
            <span className={`flex size-8 shrink-0 items-center justify-center rounded-full bg-white/60 ${style.color}`}>
              <Icon name={style.icon} className="size-4" />
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block text-sm font-bold">{insight.title}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-[#555555]">{insight.text}</span>
            </span>
          </>
        )
        const base = 'flex h-full w-full items-start gap-3 rounded-2xl bg-white/40 p-3'
        return (
          <li key={insight.id}>
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(insight)}
                className={`${base} transition-[transform,background-color] hover:bg-white/70 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2d2d2d]`}
              >
                {body}
              </button>
            ) : (
              <div className={base}>{body}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
