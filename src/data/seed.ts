import { addDays, startOfDay } from '../lib/format'
import { createId } from '../lib/id'
import { buildMetrics } from './finance'
import { collectNotifications, mergeNotifications } from './notifications'
import { WELCOME_MESSAGE } from './assistant'
import { PAYMENT_METHODS } from './types'
import type { DemoState, ExpenseCategory, ExpenseTransaction, IncomeTransaction, PaymentMethod, Product, Transaction } from './types'

export const STATE_VERSION = 1
export const INITIAL_CASH = 8_500_000

const HOUR = 3_600_000
const MINUTE = 60_000

type SeedProduct = Product & { popularity: number }

const SEED_PRODUCTS: SeedProduct[] = [
  { id: 'p-kopi-susu', name: 'Kopi Susu Gula Aren', category: 'Minuman', price: 18_000, cost: 7_500, stock: 64, minStock: 20, popularity: 5 },
  { id: 'p-es-teh', name: 'Es Teh Manis', category: 'Minuman', price: 6_000, cost: 1_800, stock: 120, minStock: 30, popularity: 4 },
  { id: 'p-kopi-hitam', name: 'Kopi Hitam', category: 'Minuman', price: 12_000, cost: 4_000, stock: 48, minStock: 20, popularity: 2 },
  { id: 'p-air', name: 'Air Mineral 600ml', category: 'Minuman', price: 5_000, cost: 3_000, stock: 90, minStock: 24, popularity: 2 },
  { id: 'p-geprek', name: 'Nasi Ayam Geprek', category: 'Makanan', price: 22_000, cost: 11_500, stock: 35, minStock: 15, popularity: 4 },
  { id: 'p-mie', name: 'Mie Goreng Spesial', category: 'Makanan', price: 18_000, cost: 8_500, stock: 28, minStock: 12, popularity: 3 },
  { id: 'p-roti', name: 'Roti Bakar Cokelat', category: 'Makanan', price: 15_000, cost: 6_000, stock: 6, minStock: 12, popularity: 3 },
  { id: 'p-pisang', name: 'Pisang Goreng Keju', category: 'Camilan', price: 12_000, cost: 4_500, stock: 9, minStock: 12, popularity: 2 },
  { id: 'p-dimsum', name: 'Dimsum Ayam (4 pcs)', category: 'Camilan', price: 20_000, cost: 9_500, stock: 0, minStock: 10, popularity: 2 },
  { id: 'p-keripik', name: 'Keripik Singkong 200g', category: 'Camilan', price: 14_000, cost: 6_500, stock: 52, minStock: 15, popularity: 1 },
]

const PAYMENT_WEIGHTS: Record<PaymentMethod, number> = { Cash: 40, QRIS: 35, 'Bank Transfer': 10, 'E-Wallet': 15 }
const SALE_NOTES = ['', '', '', '', 'Pesanan kantor', 'Pesanan online', 'Langganan harian', 'Acara arisan']
const RESTOCK_NAMES = ['Belanja bahan baku pasar', 'Restock kopi & susu', 'Belanja ayam & bumbu', 'Pembelian roti & pisang']

// Small deterministic PRNG so the seed data looks the same on every first launch.
function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pickWeighted<T>(items: readonly T[], weight: (item: T) => number, random: () => number): T {
  const total = items.reduce((sum, item) => sum + weight(item), 0)
  let roll = random() * total
  for (const item of items) {
    roll -= weight(item)
    if (roll < 0) return item
  }
  return items[items.length - 1]
}

const roundTo = (value: number, step: number) => Math.round(value / step) * step
const ceilTo = (value: number, step: number) => Math.ceil(value / step) * step

type ExpenseSeed = { day: number; name: string; category: ExpenseCategory; amount: number; method: PaymentMethod; hour: number }

function buildExpenseSeeds(random: () => number): ExpenseSeed[] {
  const seeds: ExpenseSeed[] = [
    { day: 26, name: 'Sewa kios bulanan', category: 'Operational', amount: 2_500_000, method: 'Bank Transfer', hour: 10 },
    { day: 20, name: 'Internet & WiFi', category: 'Operational', amount: 350_000, method: 'E-Wallet', hour: 11 },
    { day: 12, name: 'Tagihan listrik', category: 'Operational', amount: 480_000, method: 'Bank Transfer', hour: 10 },
    { day: 9, name: 'Servis blender', category: 'Others', amount: 250_000, method: 'Cash', hour: 15 },
    { day: 5, name: 'Gas LPG 12kg', category: 'Operational', amount: 195_000, method: 'Cash', hour: 9 },
    { day: 1, name: 'Perbaikan mesin espresso', category: 'Operational', amount: 1_850_000, method: 'Bank Transfer', hour: 14 },
    { day: 0, name: 'Plastik & kemasan', category: 'Operational', amount: 120_000, method: 'Cash', hour: 8 },
  ]
  for (const day of [24, 17, 10, 3]) {
    seeds.push({ day, name: 'Gaji karyawan mingguan', category: 'Employee Salaries', amount: 1_500_000, method: 'Bank Transfer', hour: 17 })
  }
  for (let day = 1; day <= 29; day += 3) {
    seeds.push({
      day,
      name: RESTOCK_NAMES[Math.floor(day / 3) % RESTOCK_NAMES.length],
      category: 'HPP',
      amount: roundTo(1_200_000 + random() * 700_000, 10_000),
      method: random() > 0.5 ? 'Cash' : 'Bank Transfer',
      hour: 6,
    })
  }
  for (let day = 2; day <= 29; day += 4) {
    seeds.push({ day, name: 'Ongkir belanja pasar', category: 'Transportation', amount: roundTo(45_000 + random() * 45_000, 5_000), method: 'Cash', hour: 7 })
  }
  return seeds
}

export function createSeedState(now: number): DemoState {
  const random = mulberry32(20261110)
  const todayStart = startOfDay(now)
  const transactions: Transaction[] = []
  const products: Product[] = SEED_PRODUCTS.map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
    price: product.price,
    cost: product.cost,
    stock: product.stock,
    minStock: product.minStock,
  }))

  for (let day = 29; day >= 0; day--) {
    const dayStart = addDays(todayStart, -day)
    const isToday = day === 0
    const windowStart = dayStart + (isToday && now - dayStart < 9 * HOUR ? 0 : 8 * HOUR)
    const windowEnd = isToday ? now - MINUTE : dayStart + 21.5 * HOUR
    if (windowEnd <= windowStart) continue

    const weekday = new Date(dayStart).getDay()
    const growth = 0.85 + 0.3 * ((29 - day) / 29)
    let count = Math.round((10 + random() * 4 + (weekday === 0 || weekday === 6 ? 3 : 0)) * growth)
    if (isToday) count = Math.max(2, Math.round((count * (windowEnd - windowStart)) / (13.5 * HOUR)))

    for (let index = 0; index < count; index++) {
      const product = pickWeighted(SEED_PRODUCTS, (item) => item.popularity, random)
      const quantity = 3 + Math.floor(random() * 8)
      const occurred = new Date(windowStart + Math.floor(random() * (windowEnd - windowStart))).setSeconds(0, 0)
      const sale: IncomeTransaction = {
        id: createId('trx'),
        type: 'income',
        occurredAt: new Date(occurred).toISOString(),
        createdAt: new Date(occurred).toISOString(),
        paymentMethod: pickWeighted(PAYMENT_METHODS, (method) => PAYMENT_WEIGHTS[method], random),
        notes: SALE_NOTES[Math.floor(random() * SALE_NOTES.length)],
        category: product.category,
        productId: product.id,
        productName: product.name,
        quantity,
        unitPrice: product.price,
        unitCost: product.cost,
        total: quantity * product.price,
        hpp: quantity * product.cost,
      }
      transactions.push(sale)
    }
  }

  for (const seed of buildExpenseSeeds(random)) {
    const dayStart = addDays(todayStart, -seed.day)
    const occurred = Math.min(dayStart + seed.hour * HOUR + Math.floor(random() * 50) * MINUTE, now - 5 * MINUTE)
    const expense: ExpenseTransaction = {
      id: createId('trx'),
      type: 'expense',
      occurredAt: new Date(occurred).toISOString(),
      createdAt: new Date(occurred).toISOString(),
      paymentMethod: seed.method,
      notes: '',
      category: seed.category,
      name: seed.name,
      amount: seed.amount,
    }
    transactions.push(expense)
  }

  const base: DemoState = {
    version: STATE_VERSION,
    initialCash: INITIAL_CASH,
    products,
    transactions,
    goals: { savingsTarget: 0, revenueTarget: 0 },
    notifications: [],
    chat: [{ id: createId('msg'), role: 'assistant', text: WELCOME_MESSAGE, createdAt: new Date(now).toISOString() }],
  }

  // Targets are sized from the seeded figures so the demo starts with visible, believable progress.
  const metrics = buildMetrics(base, now)
  const goals = {
    savingsTarget: ceilTo(metrics.cashBalance / 0.6, 5_000_000),
    revenueTarget: ceilTo(metrics.last30.revenue / 0.8, 5_000_000),
  }
  const withGoals: DemoState = { ...base, goals }
  return {
    ...withGoals,
    notifications: mergeNotifications([], collectNotifications(withGoals, { now, initial: true })),
  }
}
