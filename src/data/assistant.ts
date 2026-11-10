import { formatNumber, formatRupiah } from '../lib/format'
import { percentChange } from './finance'
import type { Metrics } from './finance'
import { generateRecommendations } from './insights'

/*
 * Local, rule-based demo assistant. It reads the same metrics as the dashboard and answers by
 * keyword matching. No external AI service is called; replace `answerQuestion` with a real
 * service later and keep the same signature.
 */

export const SUGGESTED_QUESTIONS = [
  'Bagaimana kondisi keuangan usaha saya?',
  'Produk apa yang paling laris?',
  'Bagaimana cara meningkatkan keuntungan?',
  'Pengeluaran apa yang paling besar?',
  'Apa yang harus saya prioritaskan hari ini?',
] as const

type Intent = 'finance' | 'bestseller' | 'profit' | 'expenses' | 'priority' | 'stock' | 'goals' | 'greeting' | 'unknown'

const rules: { intent: Intent; words: string[] }[] = [
  { intent: 'priority', words: ['prioritas', 'prioritaskan', 'hari ini harus', 'apa yang harus', 'fokus'] },
  { intent: 'profit', words: ['tingkatkan', 'meningkatkan', 'naikkan', 'menaikkan', 'tambah untung', 'cara untung', 'keuntungan lebih', 'margin'] },
  { intent: 'bestseller', words: ['laris', 'terlaris', 'best seller', 'bestseller', 'paling banyak terjual', 'produk terbaik'] },
  { intent: 'expenses', words: ['pengeluaran', 'biaya', 'boros', 'beban'] },
  { intent: 'stock', words: ['stok', 'stock', 'persediaan', 'inventori', 'restock', 'habis'] },
  { intent: 'goals', words: ['target', 'tabungan', 'goal', 'menabung'] },
  { intent: 'finance', words: ['keuangan', 'kondisi', 'laba', 'untung', 'profit', 'saldo', 'kas', 'pendapatan', 'omzet', 'rugi', 'revenue'] },
  { intent: 'greeting', words: ['halo', 'hai', 'hi ', 'hello', 'selamat', 'terima kasih', 'makasih'] },
]

function detectIntent(question: string): Intent {
  const text = ` ${question.toLowerCase()} `
  for (const rule of rules) {
    if (rule.words.some((word) => text.includes(word))) return rule.intent
  }
  return 'unknown'
}

const bullet = (lines: string[]) => lines.map((line) => `• ${line}`).join('\n')

const change = (current: number, previous: number): string => {
  const value = percentChange(current, previous)
  if (value === null) return 'naik dari nol kemarin'
  const rounded = Math.round(Math.abs(value))
  if (rounded === 0) return 'sama seperti kemarin'
  return `${value > 0 ? 'naik' : 'turun'} ${rounded}% dibanding kemarin pada jam yang sama`
}

function financeAnswer(metrics: Metrics): string {
  const { today, week, cashBalance, savings, revenueGoal } = metrics
  const verdict =
    today.netProfit > 0
      ? 'Kondisi hari ini sehat: usaha mencetak laba.'
      : today.revenue === 0
        ? 'Belum ada penjualan tercatat hari ini.'
        : 'Hari ini biaya masih lebih besar dari pendapatan.'
  return [
    verdict,
    bullet([
      `Pendapatan hari ini ${formatRupiah(today.revenue)} (${change(today.revenue, metrics.yesterdaySoFar.revenue)}).`,
      `Pengeluaran hari ini ${formatRupiah(today.totalCosts)} (HPP ${formatRupiah(today.hpp)} + operasional ${formatRupiah(today.operatingExpenses)}).`,
      `Estimasi laba hari ini ${formatRupiah(today.netProfit)}.`,
      `7 hari terakhir: pendapatan ${formatRupiah(week.revenue)}, laba ${formatRupiah(week.netProfit)}.`,
      `Saldo kas ${formatRupiah(cashBalance)} (${Math.floor(savings.percent)}% dari target tabungan).`,
      `Target pendapatan 30 hari: ${Math.floor(revenueGoal.percent)}% tercapai.`,
    ]),
  ].join('\n')
}

function bestsellerAnswer(metrics: Metrics): string {
  const top = metrics.topProducts.slice(0, 3)
  if (top.length === 0) return 'Belum ada penjualan dalam 7 hari terakhir, jadi belum ada produk terlaris.'
  return [
    `Produk terlaris 7 hari terakhir adalah ${top[0].name}.`,
    bullet(
      top.map(
        (product, index) =>
          `${index + 1}. ${product.name}: ${formatNumber(product.quantity)} terjual, pendapatan ${formatRupiah(product.revenue)}, laba kotor ${formatRupiah(product.grossProfit)}.`,
      ),
    ),
  ].join('\n')
}

function profitAnswer(metrics: Metrics): string {
  const tips = generateRecommendations(metrics)
  const margin = metrics.week.revenue > 0 ? Math.round((metrics.week.netProfit / metrics.week.revenue) * 100) : 0
  return [`Margin laba bersih 7 hari terakhir ${margin}%. Beberapa cara meningkatkan keuntungan:`, bullet(tips)].join('\n')
}

function expensesAnswer(metrics: Metrics): string {
  const { expenseByCategory, biggestExpense } = metrics
  if (expenseByCategory.length === 0) return 'Belum ada pengeluaran tercatat dalam 30 hari terakhir.'
  const total = expenseByCategory.reduce((sum, entry) => sum + entry.amount, 0)
  const lines = expenseByCategory
    .slice(0, 3)
    .map((entry) => `${entry.category}: ${formatRupiah(entry.amount)} (${Math.round((entry.amount / total) * 100)}%)`)
  return [
    `Kategori pengeluaran terbesar 30 hari terakhir adalah ${expenseByCategory[0].category}.`,
    bullet(lines),
    biggestExpense
      ? `Pengeluaran tunggal terbesar: "${biggestExpense.name}" sebesar ${formatRupiah(biggestExpense.amount)}.`
      : '',
    'Catatan: kategori HPP adalah pembelian stok dan tidak dihitung dua kali dalam laba.',
  ]
    .filter(Boolean)
    .join('\n')
}

function stockAnswer(metrics: Metrics): string {
  const { inventory } = metrics
  const lines = [
    `Total ${formatNumber(inventory.totalProducts)} produk dengan ${formatNumber(inventory.totalStock)} unit stok (nilai modal ${formatRupiah(inventory.stockValue)}).`,
  ]
  if (inventory.out.length > 0) lines.push(`Habis: ${inventory.out.map((product) => product.name).join(', ')}.`)
  if (inventory.low.length > 0) {
    lines.push(`Menipis: ${inventory.low.map((product) => `${product.name} (sisa ${product.stock})`).join(', ')}.`)
  }
  if (inventory.out.length === 0 && inventory.low.length === 0) lines.push('Semua stok masih aman.')
  return lines.join('\n')
}

function goalsAnswer(metrics: Metrics): string {
  const { savings, revenueGoal } = metrics
  return bullet([
    `Target tabungan: ${formatRupiah(savings.current)} dari ${formatRupiah(savings.target)} (${Math.floor(savings.percent)}%). ${savings.achieved ? 'Sudah tercapai.' : `Kurang ${formatRupiah(savings.remaining)}.`}`,
    `Target pendapatan 30 hari: ${formatRupiah(revenueGoal.current)} dari ${formatRupiah(revenueGoal.target)} (${Math.floor(revenueGoal.percent)}%). ${revenueGoal.achieved ? 'Sudah tercapai.' : `Kurang ${formatRupiah(revenueGoal.remaining)}.`}`,
  ])
}

function priorityAnswer(metrics: Metrics): string {
  const items: string[] = []
  const { inventory, today, revenueGoal, savings } = metrics
  if (inventory.out.length > 0) items.push(`Restock produk yang habis: ${inventory.out.map((product) => product.name).join(', ')}.`)
  if (inventory.low.length > 0) items.push(`Siapkan restock untuk stok menipis: ${inventory.low.map((product) => product.name).join(', ')}.`)
  if (today.revenue === 0) items.push('Catat penjualan pertama hari ini agar dashboard dan laba terus akurat.')
  else if (today.netProfit <= 0) items.push('Tinjau biaya hari ini; pendapatan belum menutup HPP dan biaya operasional.')
  if (!revenueGoal.achieved) items.push(`Kejar target pendapatan: kurang ${formatRupiah(revenueGoal.remaining)} lagi.`)
  else if (!savings.achieved) items.push(`Sisihkan laba untuk target tabungan: kurang ${formatRupiah(savings.remaining)}.`)
  if (items.length === 0) items.push('Tidak ada hal mendesak. Pertahankan pencatatan transaksi harian.')
  return ['Prioritas hari ini:', bullet(items.slice(0, 4))].join('\n')
}

export function answerQuestion(question: string, metrics: Metrics): string {
  switch (detectIntent(question)) {
    case 'finance':
      return financeAnswer(metrics)
    case 'bestseller':
      return bestsellerAnswer(metrics)
    case 'profit':
      return profitAnswer(metrics)
    case 'expenses':
      return expensesAnswer(metrics)
    case 'priority':
      return priorityAnswer(metrics)
    case 'stock':
      return stockAnswer(metrics)
    case 'goals':
      return goalsAnswer(metrics)
    case 'greeting':
      return 'Halo! Saya Arbor, asisten bisnis demo. Tanyakan tentang keuangan, produk terlaris, stok, pengeluaran, atau target Anda.'
    default:
      return `Maaf, asisten demo ini belum memahami pertanyaan itu. Coba tanyakan tentang keuangan, produk terlaris, pengeluaran, stok, target, atau pilih salah satu pertanyaan yang disarankan.`
  }
}

export const WELCOME_MESSAGE =
  'Halo! Saya Arbor, asisten bisnis demo untuk Junobi Arbor. Saya menjawab berdasarkan data transaksi dan stok Anda saat ini. Pilih pertanyaan yang disarankan atau ketik sendiri.'
