import { expenseColor, incomeColor, transactionTitle } from '../../data/display'
import type { Transaction } from '../../data/types'
import { formatDateTime, formatRupiah } from '../../lib/format'
import Modal from '../ui/Modal'

function Detail({ label, value, emphasis }: { label: string; value: string; emphasis?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#2d2d2d]/10 py-2 text-sm last:border-b-0">
      <dt className="text-[#555555]">{label}</dt>
      <dd className={`text-right font-bold break-words ${emphasis ?? ''}`}>{value}</dd>
    </div>
  )
}

export default function TransactionDetail({ transaction, onClose }: { transaction: Transaction; onClose: () => void }) {
  const income = transaction.type === 'income'
  return (
    <Modal title="Transaction detail" onClose={onClose}>
      <p className="mt-2 text-base font-bold break-words">{transactionTitle(transaction)}</p>
      <dl className="mt-2">
        <Detail label="Type" value={income ? 'Income' : 'Expense'} emphasis={income ? incomeColor : expenseColor} />
        <Detail label="Date & time" value={formatDateTime(Date.parse(transaction.occurredAt))} />
        <Detail label="Category" value={transaction.category} />
        <Detail label="Payment method" value={transaction.paymentMethod} />
        {transaction.type === 'income' ? (
          <>
            <Detail label="Product" value={transaction.productName} />
            <Detail label="Quantity" value={String(transaction.quantity)} />
            <Detail label="Unit price" value={formatRupiah(transaction.unitPrice)} />
            <Detail label="Total revenue" value={formatRupiah(transaction.total)} emphasis={incomeColor} />
            <Detail label="HPP (cost of goods)" value={formatRupiah(transaction.hpp)} />
            <Detail label="Gross profit" value={formatRupiah(transaction.total - transaction.hpp)} />
          </>
        ) : (
          <Detail label="Amount" value={formatRupiah(transaction.amount)} emphasis={expenseColor} />
        )}
        <Detail label="Notes" value={transaction.notes || '—'} />
        <Detail label="Recorded" value={formatDateTime(Date.parse(transaction.createdAt))} />
      </dl>
      {transaction.type === 'expense' && transaction.category === 'HPP' && (
        <p className="mt-3 rounded-2xl bg-white/50 p-3 text-xs text-[#555555]">
          Stock purchases reduce your cash balance. Their cost is counted in profit when the products are sold, so it is not
          double-counted.
        </p>
      )}
    </Modal>
  )
}
