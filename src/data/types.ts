export const PAYMENT_METHODS = ['Cash', 'QRIS', 'Bank Transfer', 'E-Wallet'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const EXPENSE_CATEGORIES = ['HPP', 'Operational', 'Transportation', 'Employee Salaries', 'Others'] as const
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export type Product = {
  id: string
  name: string
  category: string
  // Selling price and cost price (HPP per unit), in Rupiah.
  price: number
  cost: number
  stock: number
  // Stock at or below this level counts as low stock.
  minStock: number
}

type TransactionBase = {
  id: string
  // When the transaction happened (editable by the user) and when it was recorded.
  occurredAt: string
  createdAt: string
  paymentMethod: PaymentMethod
  notes: string
}

export type IncomeTransaction = TransactionBase & {
  type: 'income'
  category: string
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  unitCost: number
  // total = quantity x unitPrice, hpp = quantity x unitCost (both snapshotted at sale time).
  total: number
  hpp: number
}

export type ExpenseTransaction = TransactionBase & {
  type: 'expense'
  category: ExpenseCategory
  name: string
  amount: number
}

export type Transaction = IncomeTransaction | ExpenseTransaction

export type Goals = {
  // Savings target is measured against the cash balance.
  savingsTarget: number
  // Revenue target is measured over a rolling 30-day window.
  revenueTarget: number
}

export type NotificationKind =
  | 'low-stock'
  | 'out-of-stock'
  | 'transaction'
  | 'revenue-target'
  | 'savings-target'
  | 'insight'

export type NavigationTarget = {
  page: 'Home' | 'Activities' | 'AI'
  transactionId?: string
  section?: string
}

export type AppNotification = {
  id: string
  // De-duplication key: an event only ever produces one notification per key.
  key: string
  kind: NotificationKind
  title: string
  message: string
  createdAt: string
  read: boolean
  target: NavigationTarget
}

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  createdAt: string
}

export type DemoState = {
  version: number
  initialCash: number
  products: Product[]
  transactions: Transaction[]
  goals: Goals
  notifications: AppNotification[]
  chat: ChatMessage[]
}
