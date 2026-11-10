import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { InsightsList } from '../components/dashboard/Panels'
import Section from '../components/dashboard/Section'
import { errorText, fieldClass, glassCardPadded, primaryButton } from '../components/ui/glass'
import { Icon } from '../components/ui/icons'
import PageShell from '../components/ui/PageShell'
import { SUGGESTED_QUESTIONS } from '../data/assistant'
import { useAppData, useDataStore, useMetrics } from '../data/hooks'
import { generateInsights, generateRecommendations } from '../data/insights'
import type { NavigationTarget } from '../data/types'
import { formatNumber, formatRupiah, formatTime } from '../lib/format'

function SummaryStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-white/40 p-3">
      <p className="text-xs text-[#555555]">{label}</p>
      <p className="mt-1 text-base font-black break-words">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-[#555555]">{hint}</p>}
    </div>
  )
}

function AIPage({ onNavigate }: { onNavigate: (target: NavigationTarget) => void }) {
  const store = useDataStore()
  const { data, assistantTyping } = useAppData()
  const metrics = useMetrics()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const logRef = useRef<HTMLDivElement>(null)

  const insights = useMemo(() => generateInsights(metrics, data.transactions), [metrics, data.transactions])
  const recommendations = useMemo(() => generateRecommendations(metrics), [metrics])
  const bestProduct = metrics.topProducts[0]

  useEffect(() => {
    const log = logRef.current
    if (log) log.scrollTop = log.scrollHeight
  }, [data.chat.length, assistantTyping])

  const send = (question: string) => {
    const result = store.sendChatMessage(question)
    if (result.ok) {
      setText('')
      setError(null)
    } else {
      setError(result.error)
    }
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    send(text)
  }

  return (
    <PageShell title="Arbor Insights">
      <div className="space-y-3">
        <div className={glassCardPadded}>
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/60">
              <Icon name="spark" className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-black">Selamat datang di Arbor</h2>
              <p className="mt-1 text-sm text-[#555555]">
                Asisten bisnis yang membaca data transaksi, stok, dan target Anda untuk memberi ringkasan, insight, dan saran.
              </p>
              <p className="mt-2 inline-block rounded-full bg-white/60 px-3 py-1 text-xs font-bold">
                Mode demo: jawaban dibuat oleh aturan lokal dari data aplikasi, belum terhubung ke layanan AI eksternal.
              </p>
            </div>
          </div>
        </div>

        <Section title="Ringkasan Bisnis" subtitle="Berdasarkan data terkini">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryStat label="Pendapatan hari ini" value={formatRupiah(metrics.today.revenue)} />
            <SummaryStat label="Estimasi laba hari ini" value={formatRupiah(metrics.today.netProfit)} />
            <SummaryStat label="Saldo kas" value={formatRupiah(metrics.cashBalance)} />
            <SummaryStat
              label="Produk terlaris (7 hari)"
              value={bestProduct ? bestProduct.name : '—'}
              hint={bestProduct ? `${formatNumber(bestProduct.quantity)} terjual` : 'Belum ada penjualan'}
            />
          </div>
        </Section>

        <Section title="Tanya Arbor" subtitle="Pilih pertanyaan yang disarankan atau ketik sendiri">
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((question) => (
              <button
                key={question}
                type="button"
                disabled={assistantTyping}
                onClick={() => send(question)}
                className="rounded-full bg-white/60 px-3 py-2 text-left text-xs font-bold transition-[transform,background-color] hover:bg-white/90 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2d2d2d]"
              >
                {question}
              </button>
            ))}
          </div>
          <div
            ref={logRef}
            role="log"
            aria-live="polite"
            aria-label="Percakapan dengan Arbor"
            className="mt-3 max-h-[380px] min-h-[160px] space-y-3 overflow-y-auto rounded-2xl bg-white/30 p-3"
          >
            {data.chat.map((message) => {
              const mine = message.role === 'user'
              return (
                <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm ${mine ? 'rounded-br-md bg-[#2d2d2d] text-[#F5F5F5]' : 'rounded-bl-md bg-white/70'}`}
                  >
                    <p className="leading-relaxed break-words whitespace-pre-line">{message.text}</p>
                    <p className={`mt-1 text-[10px] ${mine ? 'text-[#F5F5F5]/70' : 'text-[#555555]'}`}>
                      {mine ? 'Anda' : 'Arbor'} · {formatTime(Date.parse(message.createdAt))}
                    </p>
                  </div>
                </div>
              )
            })}
            {assistantTyping && (
              <div className="flex justify-start" role="status">
                <div className="rounded-2xl rounded-bl-md bg-white/70 px-3 py-2 text-sm text-[#555555]">
                  <span className="animate-pulse">Arbor sedang menyusun jawaban…</span>
                </div>
              </div>
            )}
          </div>
          <form onSubmit={handleSubmit} className="mt-3 flex items-start gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Pertanyaan untuk Arbor</span>
              <input
                type="text"
                value={text}
                maxLength={500}
                placeholder="Tulis pertanyaan tentang bisnis Anda"
                onChange={(event) => {
                  setText(event.target.value)
                  if (error) setError(null)
                }}
                className={`${fieldClass} !mt-0`}
              />
            </label>
            <button type="submit" disabled={!text.trim() || assistantTyping} className={`${primaryButton} flex h-[42px] items-center gap-2`}>
              <Icon name="send" className="size-4" />
              Kirim
            </button>
          </form>
          {error && <p role="alert" className={`mt-2 text-xs font-bold ${errorText}`}>{error}</p>}
        </Section>

        <Section title="Insight Otomatis" subtitle="Ketuk insight untuk membuka bagian terkait di Overview">
          <InsightsList insights={insights} onSelect={(insight) => onNavigate({ page: 'Home', section: insight.section })} />
        </Section>

        <Section title="Rekomendasi Bisnis" subtitle="Saran berdasarkan kondisi usaha saat ini">
          <ul className="space-y-2">
            {recommendations.map((recommendation) => (
              <li key={recommendation} className="flex items-start gap-3 rounded-2xl bg-white/40 p-3 text-sm">
                <Icon name="check" className="mt-0.5 size-4 shrink-0" />
                <span>{recommendation}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </PageShell>
  )
}

export default AIPage
