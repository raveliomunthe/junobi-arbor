import { useEffect, useMemo } from 'react'
import { RevenueExpensesChart, RevenueTrendChart } from '../components/dashboard/Charts'
import { GoalsPanel, InsightsList, OperationalOverview, TopProducts } from '../components/dashboard/Panels'
import Section from '../components/dashboard/Section'
import SummaryCards from '../components/dashboard/SummaryCards'
import TransactionRow from '../components/transactions/TransactionRow'
import { secondaryButton } from '../components/ui/glass'
import PageShell from '../components/ui/PageShell'
import { useAppData, useMetrics } from '../data/hooks'
import { generateInsights } from '../data/insights'
import type { NavigationTarget } from '../data/types'

const RECENT_LIMIT = 5

function scrollToSection(id: string) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
}

function HomePage({
  focusSection,
  onNavigate,
}: {
  focusSection?: string
  onNavigate: (target: NavigationTarget) => void
}) {
  const metrics = useMetrics()
  const { data } = useAppData()
  const insights = useMemo(() => generateInsights(metrics, data.transactions), [metrics, data.transactions])

  useEffect(() => {
    if (focusSection) scrollToSection(focusSection)
  }, [focusSection])

  return (
    <PageShell title="Overview">
      <div className="space-y-3">
        <SummaryCards metrics={metrics} />

        <div id="business-performance" className="grid scroll-mt-4 gap-3 lg:grid-cols-2">
          <Section title="Pendapatan vs Pengeluaran" subtitle="7 hari terakhir">
            <RevenueExpensesChart daily={metrics.daily} />
          </Section>
          <Section title="Tren Pendapatan" subtitle="7 hari terakhir">
            <RevenueTrendChart daily={metrics.daily} />
          </Section>
          <Section title="Produk Terlaris" subtitle="Berdasarkan jumlah terjual, 7 hari terakhir">
            <TopProducts products={metrics.topProducts} />
          </Section>
          <Section
            title="Transaksi Terbaru"
            action={
              <button type="button" onClick={() => onNavigate({ page: 'Activities' })} className={secondaryButton}>
                Lihat semua
              </button>
            }
          >
            {metrics.recent.length === 0 ? (
              <p className="text-sm text-[#555555]">Belum ada transaksi. Tekan tombol + untuk mencatat transaksi pertama.</p>
            ) : (
              <ul className="space-y-2">
                {metrics.recent.slice(0, RECENT_LIMIT).map((transaction) => (
                  <li key={transaction.id}>
                    <TransactionRow
                      transaction={transaction}
                      onSelect={() => onNavigate({ page: 'Activities', transactionId: transaction.id })}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="grid gap-3 lg:grid-cols-[3fr_2fr]">
          <Section id="operational-overview" title="Ringkasan Operasional" subtitle="Kondisi produk dan stok saat ini">
            <OperationalOverview inventory={metrics.inventory} />
          </Section>
          <Section id="business-goals" title="Target Bisnis" subtitle="Perkembangan menuju target">
            <GoalsPanel savings={metrics.savings} revenueGoal={metrics.revenueGoal} />
          </Section>
        </div>

        <Section
          id="arbor-insights"
          title="Arbor Insights"
          subtitle="Dihasilkan otomatis dari data transaksi dan stok Anda. Ketuk insight untuk melihat bagian terkait."
          action={
            <button type="button" onClick={() => onNavigate({ page: 'AI' })} className={secondaryButton}>
              Tanya Arbor
            </button>
          }
        >
          <InsightsList insights={insights} onSelect={(insight) => scrollToSection(insight.section)} />
        </Section>
      </div>
    </PageShell>
  )
}

export default HomePage
