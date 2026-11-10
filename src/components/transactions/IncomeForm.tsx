import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { calcHpp, calcIncomeTotal, isOutOfStock } from '../../data/finance'
import { useAppData, useDataStore, useNow } from '../../data/hooks'
import { PAYMENT_METHODS } from '../../data/types'
import { createId } from '../../lib/id'
import { currentTime, formatNumber, formatRupiah, toDateTimeLocalValue } from '../../lib/format'
import FieldError from '../ui/FieldError'
import { errorText, fieldClass, glassCard, labelClass, primaryButton, subtleText } from '../ui/glass'
import { blockNonIntegerKeys, useFlash, useSaveGuard } from './formHooks'

type Errors = Partial<Record<'product' | 'quantity' | 'unitPrice' | 'date' | 'payment', string>>

export default function IncomeForm({ className = '' }: { className?: string }) {
  const store = useDataStore()
  const { data } = useAppData()
  const now = useNow()
  const uid = useId()
  const guard = useSaveGuard()
  const flash = useFlash()

  const [submissionId, setSubmissionId] = useState(() => createId('txn'))
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [occurredAt, setOccurredAt] = useState(() => toDateTimeLocalValue(now))
  const [dateTouched, setDateTouched] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('')
  const [notes, setNotes] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const product = data.products.find((item) => item.id === productId)
  const qty = Number(quantity)
  const price = Number(unitPrice)
  const validQuantity = quantity.trim() !== '' && Number.isInteger(qty) && qty >= 1
  const validPrice = unitPrice.trim() !== '' && Number.isFinite(price) && price > 0
  const total = validQuantity && validPrice ? calcIncomeTotal(qty, price) : 0
  const hpp = product && validQuantity ? calcHpp(qty, product.cost) : 0

  const validate = (at: number): Errors => {
    const errors: Errors = {}
    if (!product) errors.product = 'Select a product.'
    else if (isOutOfStock(product)) errors.product = 'This product is out of stock.'
    if (quantity.trim() === '') errors.quantity = 'Enter a quantity.'
    else if (!validQuantity) errors.quantity = 'Quantity must be a whole number of at least 1.'
    else if (product && qty > product.stock) errors.quantity = `Only ${formatNumber(product.stock)} in stock.`
    if (unitPrice.trim() === '') errors.unitPrice = 'Enter a unit price.'
    else if (!validPrice) errors.unitPrice = 'Unit price must be greater than zero.'
    if (!paymentMethod) errors.payment = 'Select a payment method.'
    if (dateTouched) {
      const when = Date.parse(occurredAt)
      if (Number.isNaN(when)) errors.date = 'Enter a valid date and time.'
      else if (when > at + 60_000) errors.date = 'The date cannot be in the future.'
    }
    return errors
  }

  const errors = submitted ? validate(now) : {}

  const resetForm = () => {
    setSubmissionId(createId('txn'))
    setProductId('')
    setQuantity('')
    setUnitPrice('')
    setOccurredAt(toDateTimeLocalValue(currentTime()))
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
    if (Object.keys(validate(submitAt)).length > 0 || !product) return
    if (!guard.begin()) return

    const result = store.addIncome({
      id: submissionId,
      productId: product.id,
      quantity: qty,
      unitPrice: price,
      occurredAt: new Date(dateTouched ? Date.parse(occurredAt) : submitAt).toISOString(),
      paymentMethod,
      notes,
    })
    if (result.ok) {
      flash.show(`Sale saved: ${formatNumber(qty)} × ${product.name} (${formatRupiah(total)}). Stock updated.`)
      resetForm()
    } else if (result.duplicate) {
      flash.show('This sale was already saved.')
      resetForm()
    } else {
      setFormError(result.error)
    }
    guard.release()
  }

  const describedBy = (key: keyof Errors) => (errors[key] ? `${uid}-${key}` : undefined)

  return (
    <section aria-labelledby={`${uid}-title`} className={`${glassCard} p-3 sm:flex-1 ${className}`}>
      <h3 id={`${uid}-title`} className="text-lg font-bold">Income</h3>
      <p className={`mt-1 text-xs ${subtleText}`}>Record a sale</p>
      <form noValidate onSubmit={handleSubmit} className="mt-3">
        <div className="space-y-2">
          <label className={labelClass}>
            Product
            <select
              value={productId}
              aria-invalid={Boolean(errors.product)}
              aria-describedby={describedBy('product')}
              onChange={(event) => {
                const next = data.products.find((item) => item.id === event.target.value)
                setProductId(event.target.value)
                setUnitPrice(next ? String(next.price) : '')
              }}
              className={fieldClass}
            >
              <option value="">Select product</option>
              {data.products.map((item) => (
                <option key={item.id} value={item.id} disabled={isOutOfStock(item)}>
                  {item.name} · {isOutOfStock(item) ? 'out of stock' : `stock ${formatNumber(item.stock)}`}
                </option>
              ))}
            </select>
          </label>
          <FieldError id={`${uid}-product`} message={errors.product} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass}>
                Quantity
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  max={product ? Math.max(product.stock, 1) : undefined}
                  value={quantity}
                  placeholder="Enter quantity"
                  aria-invalid={Boolean(errors.quantity)}
                  aria-describedby={describedBy('quantity')}
                  onKeyDown={blockNonIntegerKeys}
                  onChange={(event) => setQuantity(event.target.value)}
                  className={fieldClass}
                />
              </label>
              <FieldError id={`${uid}-quantity`} message={errors.quantity} />
            </div>
            <div>
              <label className={labelClass}>
                Unit Price (Rp)
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  value={unitPrice}
                  placeholder="Select product"
                  aria-invalid={Boolean(errors.unitPrice)}
                  aria-describedby={describedBy('unitPrice')}
                  onKeyDown={blockNonIntegerKeys}
                  onChange={(event) => setUnitPrice(event.target.value)}
                  className={fieldClass}
                />
              </label>
              <FieldError id={`${uid}-unitPrice`} message={errors.unitPrice} />
            </div>
          </div>
          {product && (
            <p className={`text-xs ${subtleText}`}>
              Cost price {formatRupiah(product.cost)} · HPP {formatRupiah(hpp)} · Est. profit {formatRupiah(total - hpp)}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass}>
                Date &amp; Time
                <input
                  type="datetime-local"
                  value={occurredAt}
                  max={toDateTimeLocalValue(now)}
                  aria-invalid={Boolean(errors.date)}
                  aria-describedby={describedBy('date')}
                  onChange={(event) => {
                    setOccurredAt(event.target.value)
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
          <p className="text-sm font-bold">Total Revenue</p>
          <p className="mt-2 text-xl font-bold">{formatRupiah(total)}</p>
          {formError && <p role="alert" className={`mt-2 text-xs font-bold ${errorText}`}>{formError}</p>}
          {flash.message && <p role="status" className="mt-2 text-xs font-bold text-[#1f7a4d]">{flash.message}</p>}
          <button type="submit" disabled={guard.saving} className={`mt-3 ${primaryButton}`}>
            {guard.saving ? 'Saving...' : 'Save Sale'}
          </button>
        </div>
      </form>
    </section>
  )
}
