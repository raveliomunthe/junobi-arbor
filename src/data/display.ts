import type { Transaction } from './types'

export const transactionTitle = (transaction: Transaction): string =>
  transaction.type === 'income' ? `${transaction.productName} × ${transaction.quantity}` : transaction.name

export const transactionAmount = (transaction: Transaction): number =>
  transaction.type === 'income' ? transaction.total : transaction.amount

export const incomeColor = 'text-[#1f7a4d]'
export const expenseColor = 'text-[#b3261e]'
