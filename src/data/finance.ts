import { addDays, formatWeekday, startOfDay } from '../lib/format'
import type { DemoState, ExpenseCategory, ExpenseTransaction, IncomeTransaction, Product, Transaction } from './types'

/*
 * Single source of truth for every financial figure in the app.
 *
 *   revenue          = sum of income totals
 *   hpp              = sum of quantity x product cost price (recorded on each sale)
 *   grossProfit      = revenue - hpp
 *   operatingExpenses= expenses whose category is not "HPP"
 *   totalCosts       = hpp + operatingExpenses
 *   netProfit        = revenue - hpp - operatingExpenses
 *
 * Expenses categorised as "HPP" are stock purchases. They leave the cash balance immediately,
 * but their cost is already recognised through `hpp` when the goods are sold, so they are
 * excluded from profit to avoid counting the same cost twice.
 *
 *   cashBalance      = initialCash + all income - all expense records
 */

export type Summary = {
  revenue: number
  hpp: number
  grossProfit: number
  operatingExpenses: number
  restockPurchases: number
  totalCosts: number
  netProfit: number
  cashIn: number
  cashOut: number
  incomeCount: number
  expenseCount: number
}

export type DailyPoint = {
  start: number
  label: string
  revenue: number
  costs: number
  netProfit: number
}

export type ProductPerformance = {
  productId: string
  name: string
  quantity: number
  revenue: number
  grossProfit: number
}

export type InventoryStats = {
  totalProducts: number
  totalStock: number
  stockValue: number
  low: Product[]
  out: Product[]
}

export type GoalProgress = {
  current: number
  target: number
  // Raw percentage (can exceed 100) and a clamped value for progress bars.
  percent: number
  barPercent: number
  remaining: number
  achieved: boolean
}

export type CategoryTotal = { category: ExpenseCategory; amount: number }

export type Metrics = {
  now: number
  products: Product[]
  today: Summary
  yesterdaySoFar: Summary
  week: Summary
  last30: Summary
  cashBalance: number
  daily: DailyPoint[]
  topProducts: ProductPerformance[]
  recent: Transaction[]
  inventory: InventoryStats
  savings: GoalProgress
  revenueGoal: GoalProgress
  expenseByCategory: CategoryTotal[]
  biggestExpense: ExpenseTransaction | null
  transactionCount: number
}

export const timeOf = (transaction: Transaction): number => Date.parse(transaction.occurredAt)

export const isIncome = (transaction: Transaction): transaction is IncomeTransaction => transaction.type === 'income'
export const isExpense = (transaction: Transaction): transaction is ExpenseTransaction => transaction.type === 'expense'

export const isLowStock = (product: Product): boolean => product.stock > 0 && product.stock <= product.minStock
export const isOutOfStock = (product: Product): boolean => product.stock <= 0

export const calcIncomeTotal = (quantity: number, unitPrice: number): number => Math.round(quantity * unitPrice)
export const calcHpp = (quantity: number, unitCost: number): number => Math.round(quantity * unitCost)

// `from` is inclusive and `to` is exclusive.
export function summarize(transactions: readonly Transaction[], from: number, to: number): Summary {
  let revenue = 0
  let hpp = 0
  let operatingExpenses = 0
  let restockPurchases = 0
  let incomeCount = 0
  let expenseCount = 0

  for (const transaction of transactions) {
    const time = timeOf(transaction)
    if (!(time >= from && time < to)) continue
    if (transaction.type === 'income') {
      revenue += transaction.total
      hpp += transaction.hpp
      incomeCount += 1
    } else {
      expenseCount += 1
      if (transaction.category === 'HPP') restockPurchases += transaction.amount
      else operatingExpenses += transaction.amount
    }
  }

  const totalCosts = hpp + operatingExpenses
  return {
    revenue,
    hpp,
    grossProfit: revenue - hpp,
    operatingExpenses,
    restockPurchases,
    totalCosts,
    netProfit: revenue - totalCosts,
    cashIn: revenue,
    cashOut: operatingExpenses + restockPurchases,
    incomeCount,
    expenseCount,
  }
}

export function calcCashBalance(initialCash: number, transactions: readonly Transaction[]): number {
  let balance = initialCash
  for (const transaction of transactions) {
    balance += transaction.type === 'income' ? transaction.total : -transaction.amount
  }
  return balance
}

export function dailySeries(transactions: readonly Transaction[], now: number, days: number): DailyPoint[] {
  const today = startOfDay(now)
  return Array.from({ length: days }, (_, index) => {
    const start = addDays(today, index - (days - 1))
    const summary = summarize(transactions, start, addDays(start, 1))
    return { start, label: formatWeekday(start), revenue: summary.revenue, costs: summary.totalCosts, netProfit: summary.netProfit }
  })
}

export function productPerformance(
  transactions: readonly Transaction[],
  from: number,
  to: number,
): ProductPerformance[] {
  const byProduct = new Map<string, ProductPerformance>()
  for (const transaction of transactions) {
    if (transaction.type !== 'income') continue
    const time = timeOf(transaction)
    if (!(time >= from && time < to)) continue
    const entry = byProduct.get(transaction.productId) ?? {
      productId: transaction.productId,
      name: transaction.productName,
      quantity: 0,
      revenue: 0,
      grossProfit: 0,
    }
    entry.quantity += transaction.quantity
    entry.revenue += transaction.total
    entry.grossProfit += transaction.total - transaction.hpp
    byProduct.set(transaction.productId, entry)
  }
  return [...byProduct.values()].sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
}

export function inventoryStats(products: readonly Product[]): InventoryStats {
  return {
    totalProducts: products.length,
    totalStock: products.reduce((sum, product) => sum + Math.max(0, product.stock), 0),
    stockValue: products.reduce((sum, product) => sum + Math.max(0, product.stock) * product.cost, 0),
    low: products.filter(isLowStock).sort((a, b) => a.stock / a.minStock - b.stock / b.minStock),
    out: products.filter(isOutOfStock),
  }
}

export function goalProgress(current: number, target: number): GoalProgress {
  const percent = target > 0 ? (current / target) * 100 : 0
  return {
    current,
    target,
    percent,
    barPercent: Math.max(0, Math.min(100, percent)),
    remaining: Math.max(0, target - current),
    achieved: target > 0 && current >= target,
  }
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / Math.abs(previous)) * 100
}

export function buildMetrics(state: DemoState, now: number): Metrics {
  const { transactions, products, goals, initialCash } = state
  const todayStart = startOfDay(now)
  const tomorrowStart = addDays(todayStart, 1)
  const yesterdayStart = addDays(todayStart, -1)

  const today = summarize(transactions, todayStart, tomorrowStart)
  const yesterdaySoFar = summarize(transactions, yesterdayStart, Math.min(todayStart, yesterdayStart + (now - todayStart)))
  const weekFrom = addDays(todayStart, -6)
  const monthFrom = addDays(todayStart, -29)
  const week = summarize(transactions, weekFrom, tomorrowStart)
  const last30 = summarize(transactions, monthFrom, tomorrowStart)
  const cashBalance = calcCashBalance(initialCash, transactions)

  const totals = new Map<ExpenseCategory, number>()
  let biggestExpense: ExpenseTransaction | null = null
  for (const transaction of transactions) {
    if (transaction.type !== 'expense') continue
    if (timeOf(transaction) < monthFrom || timeOf(transaction) >= tomorrowStart) continue
    totals.set(transaction.category, (totals.get(transaction.category) ?? 0) + transaction.amount)
    if (!biggestExpense || transaction.amount > biggestExpense.amount) biggestExpense = transaction
  }

  return {
    now,
    products,
    today,
    yesterdaySoFar,
    week,
    last30,
    cashBalance,
    daily: dailySeries(transactions, now, 7),
    topProducts: productPerformance(transactions, weekFrom, tomorrowStart),
    recent: sortByNewest(transactions),
    inventory: inventoryStats(products),
    savings: goalProgress(cashBalance, goals.savingsTarget),
    revenueGoal: goalProgress(last30.revenue, goals.revenueTarget),
    expenseByCategory: [...totals.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
    biggestExpense,
    transactionCount: transactions.length,
  }
}

export function sortByNewest(transactions: readonly Transaction[]): Transaction[] {
  return [...transactions].sort((a, b) => timeOf(b) - timeOf(a) || Date.parse(b.createdAt) - Date.parse(a.createdAt))
}

