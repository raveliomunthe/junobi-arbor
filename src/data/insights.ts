import { formatNumber, formatRupiah } from '../lib/format'
import { percentChange, timeOf } from './finance'
import type { Metrics } from './finance'
import type { ExpenseTransaction, Product, Transaction } from './types'

export type Insight = {
  id: string
  tone: 'positive' | 'warning' | 'info'
  title: string
  text: string
  // Home section the insight relates to (used for navigation).
  section: 'operational-overview' | 'business-goals' | 'business-performance'
}

const median = (values: number[]): number => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

const margin = (product: Product): number => (product.price > 0 ? (product.price - product.cost) / product.price : 0)

const names = (products: Product[], limit = 3): string => {
  const shown = products.slice(0, limit).map((product) => product.name)
  const extra = products.length - shown.length
  return extra > 0 ? `${shown.join(', ')} dan ${extra} lainnya` : shown.join(', ')
}

// The largest recent operating expense that is far above the usual amount, if any.
export function findHighExpense(
  transactions: readonly Transaction[],
  now: number,
  withinDays = 7,
): { transaction: ExpenseTransaction; typical: number } | null {
  const operating = transactions.filter(
    (transaction): transaction is ExpenseTransaction => transaction.type === 'expense' && transaction.category !== 'HPP',
  )
  const typical = median(operating.map((transaction) => transaction.amount))
  const since = now - withinDays * 86_400_000
  let found: { transaction: ExpenseTransaction; typical: number } | null = null
  for (const transaction of operating) {
    if (timeOf(transaction) < since) continue
    if (
      transaction.amount >= 500_000 &&
      transaction.amount >= typical * 2.5 &&
      (!found || transaction.amount > found.transaction.amount)
    ) {
      found = { transaction, typical }
    }
  }
  return found
}

export function generateInsights(metrics: Metrics, transactions: readonly Transaction[]): Insight[] {
  const insights: Insight[] = []
  const { topProducts, daily, inventory, revenueGoal, savings } = metrics

  const best = topProducts[0]
  if (best) {
    insights.push({
      id: 'best-product',
      tone: 'positive',
      title: `Produk terlaris: ${best.name}`,
      text: `${formatNumber(best.quantity)} terjual dalam 7 hari terakhir dengan pendapatan ${formatRupiah(best.revenue)} dan laba kotor ${formatRupiah(best.grossProfit)}.`,
      section: 'business-performance',
    })
  }

  const completeDays = daily.slice(0, -1)
  const recentAvg = completeDays.slice(-3).reduce((sum, day) => sum + day.revenue, 0) / 3
  const priorAvg = completeDays.slice(0, 3).reduce((sum, day) => sum + day.revenue, 0) / 3
  const trend = priorAvg > 0 ? percentChange(recentAvg, priorAvg) : null
  if (trend !== null) {
    const rounded = Math.abs(Math.round(trend))
    if (trend >= 5) {
      insights.push({
        id: 'revenue-trend',
        tone: 'positive',
        title: `Pendapatan naik ${rounded}%`,
        text: `Rata-rata pendapatan harian 3 hari terakhir (${formatRupiah(recentAvg)}) lebih tinggi dari 3 hari sebelumnya (${formatRupiah(priorAvg)}).`,
        section: 'business-performance',
      })
    } else if (trend <= -5) {
      insights.push({
        id: 'revenue-trend',
        tone: 'warning',
        title: `Pendapatan turun ${rounded}%`,
        text: `Rata-rata pendapatan harian 3 hari terakhir (${formatRupiah(recentAvg)}) lebih rendah dari 3 hari sebelumnya (${formatRupiah(priorAvg)}).`,
        section: 'business-performance',
      })
    } else {
      insights.push({
        id: 'revenue-trend',
        tone: 'info',
        title: 'Pendapatan relatif stabil',
        text: `Rata-rata pendapatan harian sekitar ${formatRupiah(recentAvg)}, perubahan hanya ${rounded}% dari periode sebelumnya.`,
        section: 'business-performance',
      })
    }
  }

  const highExpense = findHighExpense(transactions, metrics.now)
  if (highExpense) {
    insights.push({
      id: 'high-expense',
      tone: 'warning',
      title: 'Pengeluaran tidak biasa terdeteksi',
      text: `"${highExpense.transaction.name}" sebesar ${formatRupiah(highExpense.transaction.amount)} jauh di atas pengeluaran operasional biasa (sekitar ${formatRupiah(highExpense.typical)}). Pastikan ini pengeluaran satu kali.`,
      section: 'business-performance',
    })
  }

  const needRestock = [...inventory.out, ...inventory.low]
  if (needRestock.length > 0) {
    insights.push({
      id: 'low-stock',
      tone: 'warning',
      title: `${needRestock.length} produk perlu restock`,
      text: `${names(needRestock)} ${inventory.out.length > 0 ? `(${inventory.out.length} habis)` : 'hampir habis'}. Stok kosong berarti penjualan hilang.`,
      section: 'operational-overview',
    })
  } else {
    insights.push({
      id: 'low-stock',
      tone: 'positive',
      title: 'Stok aman',
      text: 'Semua produk berada di atas batas stok minimum.',
      section: 'operational-overview',
    })
  }

  if (revenueGoal.target > 0) {
    insights.push({
      id: 'revenue-goal',
      tone: revenueGoal.achieved ? 'positive' : 'info',
      title: revenueGoal.achieved ? 'Target pendapatan tercapai' : `Target pendapatan ${Math.floor(revenueGoal.percent)}%`,
      text: revenueGoal.achieved
        ? `Pendapatan 30 hari terakhir ${formatRupiah(revenueGoal.current)} sudah melampaui target ${formatRupiah(revenueGoal.target)}.`
        : `Tinggal ${formatRupiah(revenueGoal.remaining)} lagi untuk mencapai target ${formatRupiah(revenueGoal.target)}.`,
      section: 'business-goals',
    })
  }

  if (savings.target > 0 && !revenueGoal.achieved) {
    insights.push({
      id: 'savings-goal',
      tone: 'info',
      title: `Target tabungan ${Math.floor(savings.percent)}%`,
      text: savings.achieved
        ? 'Saldo kas sudah mencapai target tabungan.'
        : `Saldo kas ${formatRupiah(savings.current)} dari target ${formatRupiah(savings.target)}; masih kurang ${formatRupiah(savings.remaining)}.`,
      section: 'business-goals',
    })
  }

  return insights
}

export function generateRecommendations(metrics: Metrics): string[] {
  const recommendations: string[] = []
  const { inventory, topProducts, products, week, expenseByCategory, savings, now } = metrics

  const needRestock = [...inventory.out, ...inventory.low]
  if (needRestock.length > 0) {
    recommendations.push(
      `Restock ${names(needRestock)} lebih dulu. Produk yang habis tidak bisa dijual dan menurunkan pendapatan harian.`,
    )
  }

  const sold = new Set(topProducts.map((product) => product.productId))
  const margins = products.filter((product) => product.stock > 0).sort((a, b) => margin(b) - margin(a))
  const promo = margins.find((product) => margin(product) >= 0.5)
  if (promo) {
    recommendations.push(
      `Dorong penjualan ${promo.name} (margin ${Math.round(margin(promo) * 100)}%). Tawarkan sebagai paket atau tambahan saat pelanggan memesan.`,
    )
  }

  const slow = products
    .filter((product) => product.stock > product.minStock * 2)
    .map((product) => ({ product, sold: topProducts.find((entry) => entry.productId === product.id)?.quantity ?? 0 }))
    .filter((entry) => entry.sold < entry.product.minStock / 2 || !sold.has(entry.product.id))
    .sort((a, b) => b.product.stock - a.product.stock)[0]
  if (slow) {
    recommendations.push(
      `Buat promo untuk ${slow.product.name}: stok ${formatNumber(slow.product.stock)} tetapi hanya terjual ${formatNumber(slow.sold)} dalam 7 hari.`,
    )
  }

  const biggest = expenseByCategory[0]
  if (biggest) {
    recommendations.push(
      `Pengeluaran terbesar 30 hari terakhir ada di kategori ${biggest.category} (${formatRupiah(biggest.amount)}). Bandingkan harga pemasok atau cari alternatif yang lebih hemat.`,
    )
  }

  const avgDailyProfit = week.netProfit / 7
  if (savings.target > 0 && !savings.achieved && avgDailyProfit > 0) {
    const days = Math.ceil(savings.remaining / avgDailyProfit)
    recommendations.push(
      `Dengan laba rata-rata ${formatRupiah(avgDailyProfit)} per hari, target tabungan tercapai sekitar ${formatNumber(days)} hari lagi. Sisihkan sebagian laba setiap hari agar lebih konsisten.`,
    )
  }

  if (week.revenue > 0 && week.netProfit / week.revenue < 0.2) {
    recommendations.push(
      `Margin laba bersih 7 hari terakhir hanya ${Math.round((week.netProfit / week.revenue) * 100)}%. Pertimbangkan menaikkan harga produk dengan margin rendah atau menekan biaya operasional.`,
    )
  }

  if (recommendations.length === 0) {
    recommendations.push(`Kondisi usaha stabil per ${new Date(now).toLocaleDateString('id-ID')}. Pertahankan pencatatan transaksi harian.`)
  }
  return recommendations.slice(0, 5)
}
