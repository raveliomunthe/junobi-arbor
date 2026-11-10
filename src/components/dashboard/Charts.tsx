import type { DailyPoint } from '../../data/finance'
import { formatCompactRupiah, formatRupiah } from '../../lib/format'

const W = 420
const H = 210
const LEFT = 44
const RIGHT = 8
const TOP = 12
const BOTTOM = 26
const PLOT_W = W - LEFT - RIGHT
const PLOT_H = H - TOP - BOTTOM
const TICKS = 4

function niceMax(value: number): number {
  if (value <= 0) return 1
  const exponent = 10 ** Math.floor(Math.log10(value))
  const fraction = value / exponent
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
  return nice * exponent
}

function Axes({ max, daily }: { max: number; daily: DailyPoint[] }) {
  const group = PLOT_W / daily.length
  return (
    <>
      {Array.from({ length: TICKS + 1 }, (_, index) => {
        const y = TOP + PLOT_H - (index / TICKS) * PLOT_H
        return (
          <g key={index}>
            <line x1={LEFT} x2={W - RIGHT} y1={y} y2={y} stroke="#2d2d2d" strokeOpacity={index === 0 ? 0.3 : 0.1} />
            <text x={LEFT - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#555555">
              {formatCompactRupiah((max * index) / TICKS)}
            </text>
          </g>
        )
      })}
      {daily.map((point, index) => (
        <text key={point.start} x={LEFT + group * (index + 0.5)} y={H - 8} textAnchor="middle" fontSize="10" fill="#555555">
          {point.label}
        </text>
      ))}
    </>
  )
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#555555]">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

const hasData = (daily: DailyPoint[]) => daily.some((point) => point.revenue > 0 || point.costs > 0)

function NoData() {
  return <p className="py-10 text-center text-sm text-[#555555]">Belum ada transaksi dalam 7 hari terakhir.</p>
}

export function RevenueExpensesChart({ daily }: { daily: DailyPoint[] }) {
  if (!hasData(daily)) return <NoData />
  const max = niceMax(Math.max(...daily.map((point) => Math.max(point.revenue, point.costs))))
  const group = PLOT_W / daily.length
  const barWidth = Math.min(18, group * 0.3)
  const y = (value: number) => TOP + PLOT_H - (value / max) * PLOT_H

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Grafik batang pendapatan dan pengeluaran 7 hari terakhir" className="h-auto w-full">
        <Axes max={max} daily={daily} />
        {daily.map((point, index) => {
          const center = LEFT + group * (index + 0.5)
          return (
            <g key={point.start}>
              <rect x={center - barWidth - 1} y={y(point.revenue)} width={barWidth} height={TOP + PLOT_H - y(point.revenue)} rx="3" fill="#2d2d2d">
                <title>{`${point.label}: pendapatan ${formatRupiah(point.revenue)}`}</title>
              </rect>
              <rect x={center + 1} y={y(point.costs)} width={barWidth} height={TOP + PLOT_H - y(point.costs)} rx="3" fill="#a3a39e">
                <title>{`${point.label}: pengeluaran ${formatRupiah(point.costs)}`}</title>
              </rect>
            </g>
          )
        })}
      </svg>
      <Legend items={[{ label: 'Pendapatan', color: '#2d2d2d' }, { label: 'Pengeluaran (HPP + operasional)', color: '#a3a39e' }]} />
    </div>
  )
}

export function RevenueTrendChart({ daily }: { daily: DailyPoint[] }) {
  if (!hasData(daily)) return <NoData />
  const max = niceMax(Math.max(...daily.map((point) => point.revenue)))
  const group = PLOT_W / daily.length
  const points = daily.map((point, index) => ({
    x: LEFT + group * (index + 0.5),
    y: TOP + PLOT_H - (point.revenue / max) * PLOT_H,
    point,
  }))
  const line = points.map((item, index) => `${index === 0 ? 'M' : 'L'}${item.x.toFixed(1)} ${item.y.toFixed(1)}`).join(' ')
  const area = `${line} L${points[points.length - 1].x.toFixed(1)} ${TOP + PLOT_H} L${points[0].x.toFixed(1)} ${TOP + PLOT_H} Z`

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Grafik tren pendapatan 7 hari terakhir" className="h-auto w-full">
        <Axes max={max} daily={daily} />
        <path d={area} fill="#2d2d2d" fillOpacity="0.08" />
        <path d={line} fill="none" stroke="#2d2d2d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((item) => (
          <circle key={item.point.start} cx={item.x} cy={item.y} r="4" fill="#f4f5f2" stroke="#2d2d2d" strokeWidth="2">
            <title>{`${item.point.label}: ${formatRupiah(item.point.revenue)}`}</title>
          </circle>
        ))}
      </svg>
      <Legend items={[{ label: 'Pendapatan harian (hari ini masih berjalan)', color: '#2d2d2d' }]} />
    </div>
  )
}
