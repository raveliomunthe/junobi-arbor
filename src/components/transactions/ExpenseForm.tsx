import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { useDataStore, useNow } from '../../data/hooks'
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from '../../data/types'
import { createId } from '../../lib/id'
import { currentTime, formatRupiah, parseLocalDate, startOfDay, toDateValue } from '../../lib/format'
import FieldError from '../ui/FieldError'
import { errorText, fieldClass, glassCard, labelClass, primaryButton, subtleText } from '../ui/glass'
import { blockNonIntegerKeys, useFlash, useSaveGuard } from './formHooks'

type Errors = Partial<Record<'name' | 'category' | 'amount' | 'date' | 'payment', string>>

export default function ExpenseForm({ className = '' }: { className?: string }) {
  const store = useDataStore()
  const now = useNow()
  const uid = useId()
  const guard = useSaveGuard()
  const flash = useFlash()

  const [submissionId, setSubmissionId] = useState(() => createId('txn'))
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(() => toDateValue(now))
  const [dateTouched, setDateTouched] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('')
  const [notes, setNotes] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const parsedAmount = Number(amount)
  const validAmount = amount.trim() !== '' && Number.isFinite(parsedAmount) && parsedAmount > 0

  // A past day is saved at noon; today keeps the current time so the activity feed stays ordered.
  const resolveDate = (at: number): number => {
    if (!dateTouched) return at
    const day = parseLocalDate(date)
    if (Number.isNaN(day)) return Number.NaN
    return day === startOfDay(at) ? at : day + 12 * 3_600_000
  }

  const validate = (at: number): Errors => {
    const errors: Errors = {}
    if (!name.trim()) errors.name = 'Enter an expense name.'
    else if (name.trim().length > 60) errors.name = 'Expense name is too long (max 60 characters).'
    if (!category) errors.category = 'Select a category.'
    if (amount.trim() === '') errors.amount = 'Enter an amount.'
    else if (!validAmount) errors.amount = 'Amount must be greater than zero.'
    if (!paymentMethod) errors.payment = 'Select a payment method.'
    const when = resolveDate(at)
    if (Number.isNaN(when)) errors.date = 'Enter a valid date.'
    else if (dateTouched && parseLocalDate(date) > startOfDay(at)) errors.date = 'The date cannot be in the future.'
    return errors
  }

  const errors = submitted ? validate(now) : {}

  const resetForm = () => {
    setSubmissionId(createId('txn'))
    setName('')
    setCategory('')
    setAmount('')
    setDate(toDateValue(currentTime()))
    setDateTouched(false)
    setPaymentMethod('')
    setNotes('')
    setSubmitted(false)
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (guard.saving) return
    setSubmitted(true)
    setFormError(null)
    flash.clear()
    const submitAt = currentTime()
    if (Object.keys(validate(submitAt)).length > 0) return
    if (!guard.begin()) return

    const result = store.addExpense({
      id: submissionId,
      name,
      category,
      amount: parsedAmount,
      occurredAt: new Date(resolveDate(submitAt)).toISOString(),
      paymentMethod,
      notes,
    })
    if (result.ok) {
      flash.show(`Expense saved: ${result.value.name} (${formatRupiah(result.value.amount)}).`)
      resetForm()
    } else if (result.duplicate) {
      flash.show('This expense was already saved.')
      resetForm()
    } else {
      setFormError(result.error)
    }
    guard.release()
  }

  const describedBy = (key: keyof Errors) => (errors[key] ? `${uid}-${key}` : undefined)

  return (
    <section aria-labelledby={`${uid}-title`} className={`${glassCard} p-3 sm:flex-1 ${className}`}>
      <h3 id={`${uid}-title`} className="text-lg font-bold">Expenses</h3>
      <p className={`mt-1 text-xs ${subtleText}`}>Record an expense</p>
      <form noValidate onSubmit={handleSubmit} className="mt-3">
        <div className="space-y-2">
          <label className={labelClass}>
            Expense Name
            <input
              type="text"
              maxLength={60}
              value={name}
              placeholder="Enter expense name"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={describedBy('name')}
              onChange={(event) => setName(event.target.value)}
              className={fieldClass}
            />
          </label>
          <FieldError id={`${uid}-name`} message={errors.name} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass}>
                Category
                <select
                  value={category}
                  aria-invalid={Boolean(errors.category)}
                  aria-describedby={describedBy('category')}
                  onChange={(event) => setCategory(event.target.value)}
                  className={fieldClass}
                >
                  <option value="">Select category</option>
                  {EXPENSE_CATEGORIES.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>
              <FieldError id={`${uid}-category`} message={errors.category} />
            </div>
            <div>
              <label className={labelClass}>
                Amount (Rp)
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  value={amount}
                  placeholder="Enter amount"
                  aria-invalid={Boolean(errors.amount)}
                  aria-describedby={describedBy('amount')}
                  onKeyDown={blockNonIntegerKeys}
                  onChange={(event) => setAmount(event.target.value)}
                  className={fieldClass}
                />
              </label>
              <FieldError id={`${uid}-amount`} message={errors.amount} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass}>
                Date
                <input
                  type="date"
                  value={date}
                  max={toDateValue(now)}
                  aria-invalid={Boolean(errors.date)}
                  aria-describedby={describedBy('date')}
                  onChange={(event) => {
                    setDate(event.target.value)
                    setDateTouched(true)
                  }}
                  className={fieldClass}
                />
              </label>
              <FieldError id={`${uid}-date`} message={errors.date} />
            </div>
            <div>
              <label className={labelClass}>
                Payment Method
                <select
                  value={paymentMethod}
                  aria-invalid={Boolean(errors.payment)}
                  aria-describedby={describedBy('payment')}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                  className={fieldClass}
                >
                  <option value="">Select method</option>
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </select>
              </label>
              <FieldError id={`${uid}-payment`} message={errors.payment} />
            </div>
          </div>
          <label className={labelClass}>
            Notes (optional)
            <input
              type="text"
              maxLength={200}
              value={notes}
              placeholder="Add a note"
              onChange={(event) => setNotes(event.target.value)}
              className={fieldClass}
            />
          </label>
        </div>
        <div className="mt-3 border-t border-[#2d2d2d]/10 pt-3">
          <p className="text-sm font-bold">Total Expense</p>
          <p className="mt-2 text-xl font-bold">{formatRupiah(validAmount ? Math.round(parsedAmount) : 0)}</p>
          {formError && <p role="alert" className={`mt-2 text-xs font-bold ${errorText}`}>{formError}</p>}
          {flash.message && <p role="status" className="mt-2 text-xs font-bold text-[#1f7a4d]">{flash.message}</p>}
          <button type="submit" disabled={guard.saving} className={`mt-3 ${primaryButton}`}>
            {guard.saving ? 'Saving...' : 'Save Expense'}
          </button>
        </div>
      </form>
    </section>
  )
}
