import { expenseColor, incomeColor, transactionAmount, transactionTitle } from '../../data/display'
import type { Transaction } from '../../data/types'
import { formatDateTime, formatRupiah, formatTime } from '../../lib/format'
import { Icon } from '../ui/icons'

export default function TransactionRow({
  transaction,
  onSelect,
  timeOnly = false,
}: {
  transaction: Transaction
  onSelect?: (transaction: Transaction) => void
  timeOnly?: boolean
}) {
  const income = transaction.type === 'income'
  const occurredAt = Date.parse(transaction.occurredAt)
  const content = (
    <>
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-full bg-white/60 ${income ? incomeColor : expenseColor}`}
      >
        <Icon name={income ? 'income' : 'expense'} className="size-4" />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-bold">{transactionTitle(transaction)}</span>
        <span className="block truncate text-xs text-[#555555]">
          {transaction.category} · {transaction.paymentMethod} · {timeOnly ? formatTime(occurredAt) : formatDateTime(occurredAt)}
        </span>
      </span>
      <span className={`shrink-0 text-sm font-bold ${income ? incomeColor : expenseColor}`}>
        {income ? '+' : '-'}
        {formatRupiah(transactionAmount(transaction))}
      </span>
    </>
  )

  const base = 'flex w-full items-center gap-3 rounded-2xl bg-white/40 px-3 py-2'
  if (!onSelect) return <div className={base}>{content}</div>
  return (
    <button
      type="button"
      onClick={() => onSelect(transaction)}
      className={`${base} transition-[transform,background-color] hover:bg-white/70 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2d2d2d]`}
    >
      {content}
    </button>
  )
}
