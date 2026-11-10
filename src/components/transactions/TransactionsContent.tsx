import { useId, useMemo, useState } from 'react'
import { useAppData } from '../../data/hooks'
import { glassCard, secondaryButton, subtleText } from '../ui/glass'
import ExpenseForm from './ExpenseForm'
import IncomeForm from './IncomeForm'
import TransactionRow from './TransactionRow'

const RECENT_LIMIT = 5

// Body of the existing Transactions popup: the Income and Expenses forms plus recent transactions.
export default function TransactionsContent({
  onViewAll,
  onOpenTransaction,
}: {
  onViewAll: () => void
  onOpenTransaction: (id: string) => void
}) {
  const { data } = useAppData()
  const [tab, setTab] = useState<'income' | 'expense'>('income')
  const recentTitleId = useId()

  // Newest saved first, so a transaction you just recorded always shows up here.
  const recent = useMemo(
    () => [...data.transactions].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, RECENT_LIMIT),
    [data.transactions],
  )

  const tabClass = (active: boolean) =>
    `flex-1 rounded-full px-4 py-2 text-xs font-bold transition-colors ${active ? 'bg-[#2d2d2d] text-[#F5F5F5]' : 'bg-white/50 text-[#2d2d2d] hover:bg-white/70'}`

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
      <div role="tablist" aria-label="Transaction type" className="flex shrink-0 gap-2 sm:hidden">
        <button type="button" role="tab" aria-selected={tab === 'income'} onClick={() => setTab('income')} className={tabClass(tab === 'income')}>
          Income
        </button>
        <button type="button" role="tab" aria-selected={tab === 'expense'} onClick={() => setTab('expense')} className={tabClass(tab === 'expense')}>
          Expenses
        </button>
      </div>
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-start">
        <IncomeForm className={tab === 'income' ? '' : 'hidden sm:block'} />
        <ExpenseForm className={tab === 'expense' ? '' : 'hidden sm:block'} />
      </div>
      <section aria-labelledby={recentTitleId} className={`${glassCard} shrink-0 p-3`}>
        <div className="flex items-center justify-between gap-3">
          <h3 id={recentTitleId} className="text-lg font-bold">Recent Transactions</h3>
          <button type="button" onClick={onViewAll} className={secondaryButton}>View All</button>
        </div>
        {recent.length === 0 ? (
          <p className={`mt-3 text-sm ${subtleText}`}>No transactions yet. Record a sale or an expense above.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {recent.map((transaction) => (
              <li key={transaction.id}>
                <TransactionRow transaction={transaction} onSelect={() => onOpenTransaction(transaction.id)} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
