import { createId } from '../lib/id'
import { formatNumber, formatRupiah } from '../lib/format'
import { buildMetrics, isLowStock, isOutOfStock, sortByNewest } from './finance'
import { findHighExpense } from './insights'
import type { AppNotification, DemoState, Transaction } from './types'

const HOUR = 3_600_000
const MAX_NOTIFICATIONS = 60
const REVENUE_MILESTONES = [50, 75, 100]
const SAVINGS_MILESTONES = [25, 50, 75, 100]

type Options = {
  now: number
  // The transaction that was just recorded (omit when seeding).
  transaction?: Transaction
  initial?: boolean
}

const reached = (milestones: number[], percent: number): number | undefined =>
  milestones.filter((milestone) => percent >= milestone).at(-1)

// Returns only notifications whose key does not exist yet, so every event notifies once.
export function collectNotifications(state: DemoState, { now, transaction, initial = false }: Options): AppNotification[] {
  const seen = new Set(state.notifications.map((notification) => notification.key))
  const created: AppNotification[] = []
  const ago = (ms: number) => new Date(now - ms).toISOString()
  const add = (notification: Omit<AppNotification, 'id' | 'read'> & { read?: boolean }) => {
    if (seen.has(notification.key)) return
    seen.add(notification.key)
    created.push({ id: createId('ntf'), read: false, ...notification })
  }

  const metrics = buildMetrics(state, now)

  state.products.forEach((product, index) => {
    if (isOutOfStock(product)) {
      add({
        key: `out-of-stock:${product.id}`,
        kind: 'out-of-stock',
        title: `Stok habis: ${product.name}`,
        message: `${product.name} sudah habis. Segera restock agar penjualan tidak terhenti.`,
        createdAt: ago(initial ? 5 * HOUR + index * 60_000 : 0),
        target: { page: 'Home', section: 'operational-overview' },
      })
    } else if (isLowStock(product)) {
      add({
        key: `low-stock:${product.id}`,
        kind: 'low-stock',
        title: `Stok menipis: ${product.name}`,
        message: `Sisa ${formatNumber(product.stock)} unit (batas minimum ${formatNumber(product.minStock)}).`,
        createdAt: ago(initial ? 2 * HOUR + index * 60_000 : 0),
        target: { page: 'Home', section: 'operational-overview' },
      })
    }
  })

  const newTransactions = initial ? sortByNewest(state.transactions).slice(0, 3) : transaction ? [transaction] : []
  for (const item of newTransactions) {
    add({
      key: `transaction:${item.id}`,
      kind: 'transaction',
      title: item.type === 'income' ? 'Penjualan baru' : 'Pengeluaran baru',
      message:
        item.type === 'income'
          ? `${formatNumber(item.quantity)} × ${item.productName} senilai ${formatRupiah(item.total)} (${item.paymentMethod}).`
          : `${item.name} senilai ${formatRupiah(item.amount)} (${item.category}).`,
      createdAt: item.createdAt,
      target: { page: 'Activities', transactionId: item.id },
    })
  }

  const revenueMilestone = reached(REVENUE_MILESTONES, metrics.revenueGoal.percent)
  if (revenueMilestone) {
    add({
      key: `revenue-target:${revenueMilestone}`,
      kind: 'revenue-target',
      title: revenueMilestone === 100 ? 'Target pendapatan tercapai' : `Target pendapatan ${revenueMilestone}% tercapai`,
      message:
        revenueMilestone === 100
          ? `Pendapatan 30 hari terakhir ${formatRupiah(metrics.revenueGoal.current)} melampaui target ${formatRupiah(metrics.revenueGoal.target)}.`
          : `Pendapatan 30 hari terakhir ${formatRupiah(metrics.revenueGoal.current)} dari target ${formatRupiah(metrics.revenueGoal.target)}.`,
      createdAt: ago(initial ? 26 * HOUR : 0),
      read: initial,
      target: { page: 'Home', section: 'business-goals' },
    })
  }

  const savingsMilestone = reached(SAVINGS_MILESTONES, metrics.savings.percent)
  if (savingsMilestone) {
    add({
      key: `savings-target:${savingsMilestone}`,
      kind: 'savings-target',
      title: savingsMilestone === 100 ? 'Target tabungan tercapai' : `Target tabungan ${savingsMilestone}% tercapai`,
      message: `Saldo kas ${formatRupiah(metrics.savings.current)} dari target tabungan ${formatRupiah(metrics.savings.target)}.`,
      createdAt: ago(initial ? 30 * HOUR : 0),
      read: initial,
      target: { page: 'Home', section: 'business-goals' },
    })
  }

  const topProduct = metrics.topProducts[0]
  if (topProduct && (initial || transaction?.type === 'income')) {
    add({
      key: `insight:top-product:${topProduct.productId}`,
      kind: 'insight',
      title: `Insight: ${topProduct.name} terlaris`,
      message: `${formatNumber(topProduct.quantity)} terjual dalam 7 hari terakhir dengan pendapatan ${formatRupiah(topProduct.revenue)}.`,
      createdAt: ago(initial ? 3 * HOUR : 0),
      target: { page: 'AI' },
    })
  }

  if (initial || transaction?.type === 'expense') {
    const high = findHighExpense(state.transactions, now)
    if (high && (initial || high.transaction.id === transaction?.id)) {
      add({
        key: `insight:high-expense:${high.transaction.id}`,
        kind: 'insight',
        title: 'Insight: pengeluaran tidak biasa',
        message: `"${high.transaction.name}" sebesar ${formatRupiah(high.transaction.amount)} jauh di atas rata-rata pengeluaran operasional.`,
        createdAt: initial ? high.transaction.createdAt : ago(0),
        target: { page: 'AI' },
      })
    }
  }

  return created
}

export function mergeNotifications(existing: AppNotification[], created: AppNotification[]): AppNotification[] {
  return [...created, ...existing]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, MAX_NOTIFICATIONS)
}
