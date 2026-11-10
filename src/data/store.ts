import { createId } from '../lib/id'
import { answerQuestion } from './assistant'
import { buildMetrics, calcHpp, calcIncomeTotal } from './finance'
import { collectNotifications, mergeNotifications } from './notifications'
import { STATE_VERSION, createSeedState } from './seed'
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from './types'
import type {
  DemoState,
  ExpenseCategory,
  ExpenseTransaction,
  IncomeTransaction,
  PaymentMethod,
} from './types'

/*
 * Local persistence layer behind every page. It is a framework-free external store (consumed
 * with useSyncExternalStore), so swapping localStorage for Supabase later only means
 * re-implementing this module's actions.
 */

const STORAGE_PREFIX = 'junobi-arbor:data:'
const MAX_AMOUNT = 1_000_000_000_000
const MAX_QUANTITY = 100_000
const MAX_CHAT_MESSAGES = 60
const ASSISTANT_DELAY_MS = 700

export type ActionResult<T> = { ok: true; value: T } | { ok: false; error: string; duplicate?: boolean }

export type IncomeInput = {
  // Client-generated id; saving the same id twice is rejected, which makes double submits harmless.
  id: string
  productId: string
  quantity: number
  unitPrice: number
  occurredAt: string
  paymentMethod: string
  notes: string
}

export type ExpenseInput = {
  id: string
  name: string
  category: string
  amount: number
  occurredAt: string
  paymentMethod: string
  notes: string
}

export type Snapshot = { data: DemoState; assistantTyping: boolean }

export type DemoStore = {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => Snapshot
  addIncome: (input: IncomeInput) => ActionResult<IncomeTransaction>
  addExpense: (input: ExpenseInput) => ActionResult<ExpenseTransaction>
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  sendChatMessage: (text: string) => ActionResult<null>
  resetDemoData: () => void
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const isString = (value: unknown): value is string => typeof value === 'string'
const isDateString = (value: unknown): boolean => isString(value) && !Number.isNaN(Date.parse(value))
const isOneOf = (list: readonly string[], value: unknown): boolean => isString(value) && list.includes(value)

function isValidTransaction(value: unknown): boolean {
  if (!isRecord(value)) return false
  const common =
    isString(value.id) &&
    isDateString(value.occurredAt) &&
    isDateString(value.createdAt) &&
    isOneOf(PAYMENT_METHODS, value.paymentMethod) &&
    isString(value.notes)
  if (!common) return false
  if (value.type === 'income') {
    return (
      isString(value.category) &&
      isString(value.productId) &&
      isString(value.productName) &&
      isNumber(value.quantity) &&
      isNumber(value.unitPrice) &&
      isNumber(value.unitCost) &&
      isNumber(value.total) &&
      isNumber(value.hpp)
    )
  }
  return value.type === 'expense' && isString(value.name) && isOneOf(EXPENSE_CATEGORIES, value.category) && isNumber(value.amount)
}

function isValidState(value: unknown): value is DemoState {
  if (!isRecord(value) || value.version !== STATE_VERSION || !isNumber(value.initialCash)) return false
  const { products, transactions, goals, notifications, chat } = value
  if (!Array.isArray(products) || !Array.isArray(transactions) || !Array.isArray(notifications) || !Array.isArray(chat)) return false
  if (!isRecord(goals) || !isNumber(goals.savingsTarget) || !isNumber(goals.revenueTarget)) return false
  return (
    products.every(
      (product) =>
        isRecord(product) &&
        isString(product.id) &&
        isString(product.name) &&
        isString(product.category) &&
        isNumber(product.price) &&
        isNumber(product.cost) &&
        isNumber(product.stock) &&
        isNumber(product.minStock),
    ) &&
    transactions.every(isValidTransaction) &&
    notifications.every(
      (item) =>
        isRecord(item) &&
        isString(item.id) &&
        isString(item.key) &&
        isString(item.kind) &&
        isString(item.title) &&
        isString(item.message) &&
        isDateString(item.createdAt) &&
        typeof item.read === 'boolean' &&
        isRecord(item.target) &&
        isOneOf(['Home', 'Activities', 'AI'], item.target.page),
    ) &&
    chat.every(
      (message) =>
        isRecord(message) &&
        isString(message.id) &&
        isOneOf(['user', 'assistant'], message.role) &&
        isString(message.text) &&
        isDateString(message.createdAt),
    )
  )
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null // storage can be blocked (private mode); the app keeps working in memory
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // quota or blocked storage: keep the in-memory state
  }
}

function checkDate(value: string, now: number): { ok: true; ms: number } | { ok: false; error: string } {
  const ms = Date.parse(value)
  if (Number.isNaN(ms) || ms < Date.parse('2000-01-01')) return { ok: false, error: 'Enter a valid date.' }
  if (ms > now + 60_000) return { ok: false, error: 'The date cannot be in the future.' }
  return { ok: true, ms }
}

const fail = (error: string, duplicate = false): { ok: false; error: string; duplicate?: boolean } =>
  duplicate ? { ok: false, error, duplicate } : { ok: false, error }

export function createDemoStore(scopeId: string): DemoStore {
  const key = `${STORAGE_PREFIX}${scopeId}`
  const listeners = new Set<() => void>()
  let epoch = 0
  let assistantTyping = false
  let storageHandler: ((event: StorageEvent) => void) | null = null

  const load = (): DemoState => {
    const raw = readStorage(key)
    if (raw) {
      try {
        const parsed: unknown = JSON.parse(raw)
        if (isValidState(parsed)) return parsed
      } catch {
        // unreadable JSON falls through to the backup below
      }
      // Keep unreadable data instead of silently discarding it.
      writeStorage(`${key}:backup`, raw)
    }
    return createSeedState(Date.now())
  }

  let data = load()
  let snapshot: Snapshot = { data, assistantTyping }

  const emit = () => {
    snapshot = { data, assistantTyping }
    listeners.forEach((listener) => listener())
  }

  const commit = (next: DemoState) => {
    data = next
    writeStorage(key, JSON.stringify(data))
    emit()
  }

  const trimChat = (chat: DemoState['chat']) => chat.slice(-MAX_CHAT_MESSAGES)

  return {
    subscribe(listener) {
      listeners.add(listener)
      if (listeners.size === 1) {
        if (readStorage(key) === null) writeStorage(key, JSON.stringify(data))
        storageHandler = (event) => {
          if (event.key !== key || !event.newValue) return
          try {
            const parsed: unknown = JSON.parse(event.newValue)
            if (!isValidState(parsed)) return
            data = parsed
            emit()
          } catch {
            // ignore partial writes from other tabs
          }
        }
        window.addEventListener('storage', storageHandler)
      }
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0 && storageHandler) {
          window.removeEventListener('storage', storageHandler)
          storageHandler = null
        }
      }
    },

    getSnapshot: () => snapshot,

    addIncome(input) {
      if (data.transactions.some((transaction) => transaction.id === input.id)) {
        return fail('This sale was already saved.', true)
      }
      const product = data.products.find((item) => item.id === input.productId)
      if (!product) return fail('Select a valid product.')
      if (!Number.isInteger(input.quantity) || input.quantity < 1) return fail('Quantity must be a whole number of at least 1.')
      if (input.quantity > MAX_QUANTITY) return fail('Quantity is too large.')
      if (input.quantity > product.stock) return fail(product.stock > 0 ? `Only ${product.stock} in stock.` : 'This product is out of stock.')
      if (!Number.isFinite(input.unitPrice) || Math.round(input.unitPrice) <= 0) return fail('Unit price must be greater than zero.')
      const unitPrice = Math.round(input.unitPrice)
      if (unitPrice > MAX_AMOUNT) return fail('Unit price is too large.')
      if (!isOneOf(PAYMENT_METHODS, input.paymentMethod)) return fail('Select a payment method.')
      const now = Date.now()
      const date = checkDate(input.occurredAt, now)
      if (!date.ok) return fail(date.error)
      const total = calcIncomeTotal(input.quantity, unitPrice)
      if (total > MAX_AMOUNT) return fail('Total is too large.')

      const transaction: IncomeTransaction = {
        id: input.id,
        type: 'income',
        occurredAt: new Date(date.ms).toISOString(),
        createdAt: new Date(now).toISOString(),
        paymentMethod: input.paymentMethod as PaymentMethod,
        notes: input.notes.trim().slice(0, 200),
        category: product.category,
        productId: product.id,
        productName: product.name,
        quantity: input.quantity,
        unitPrice,
        unitCost: product.cost,
        total,
        hpp: calcHpp(input.quantity, product.cost),
      }
      const next: DemoState = {
        ...data,
        products: data.products.map((item) => (item.id === product.id ? { ...item, stock: item.stock - input.quantity } : item)),
        transactions: [...data.transactions, transaction],
      }
      commit({ ...next, notifications: mergeNotifications(next.notifications, collectNotifications(next, { now, transaction })) })
      return { ok: true, value: transaction }
    },

    addExpense(input) {
      if (data.transactions.some((transaction) => transaction.id === input.id)) {
        return fail('This expense was already saved.', true)
      }
      const name = input.name.trim()
      if (!name) return fail('Enter an expense name.')
      if (name.length > 60) return fail('Expense name is too long (max 60 characters).')
      if (!isOneOf(EXPENSE_CATEGORIES, input.category)) return fail('Select a category.')
      if (!Number.isFinite(input.amount) || Math.round(input.amount) <= 0) return fail('Amount must be greater than zero.')
      const amount = Math.round(input.amount)
      if (amount > MAX_AMOUNT) return fail('Amount is too large.')
      if (!isOneOf(PAYMENT_METHODS, input.paymentMethod)) return fail('Select a payment method.')
      const now = Date.now()
      const date = checkDate(input.occurredAt, now)
      if (!date.ok) return fail(date.error)

      const transaction: ExpenseTransaction = {
        id: input.id,
        type: 'expense',
        occurredAt: new Date(date.ms).toISOString(),
        createdAt: new Date(now).toISOString(),
        paymentMethod: input.paymentMethod as PaymentMethod,
        notes: input.notes.trim().slice(0, 200),
        category: input.category as ExpenseCategory,
        name,
        amount,
      }
      const next: DemoState = { ...data, transactions: [...data.transactions, transaction] }
      commit({ ...next, notifications: mergeNotifications(next.notifications, collectNotifications(next, { now, transaction })) })
      return { ok: true, value: transaction }
    },

    markNotificationRead(id) {
      if (!data.notifications.some((item) => item.id === id && !item.read)) return
      commit({ ...data, notifications: data.notifications.map((item) => (item.id === id ? { ...item, read: true } : item)) })
    },

    markAllNotificationsRead() {
      if (data.notifications.every((item) => item.read)) return
      commit({ ...data, notifications: data.notifications.map((item) => (item.read ? item : { ...item, read: true })) })
    },

    sendChatMessage(text) {
      const question = text.trim().slice(0, 500)
      if (!question) return fail('Type a question first.')
      if (assistantTyping) return fail('Arbor is still answering.')

      const startedAt = epoch
      assistantTyping = true
      commit({
        ...data,
        chat: trimChat([...data.chat, { id: createId('msg'), role: 'user', text: question, createdAt: new Date().toISOString() }]),
      })

      // The reply is computed from the data as it is when the answer is ready.
      setTimeout(() => {
        if (epoch !== startedAt) return
        const reply = answerQuestion(question, buildMetrics(data, Date.now()))
        assistantTyping = false
        commit({
          ...data,
          chat: trimChat([...data.chat, { id: createId('msg'), role: 'assistant', text: reply, createdAt: new Date().toISOString() }]),
        })
      }, ASSISTANT_DELAY_MS)
      return { ok: true, value: null }
    },

    resetDemoData() {
      epoch += 1
      assistantTyping = false
      commit(createSeedState(Date.now()))
    },
  }
}
