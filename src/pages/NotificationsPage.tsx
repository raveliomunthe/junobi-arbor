import { useState } from 'react'
import { glassCardPadded, secondaryButton } from '../components/ui/glass'
import { Icon } from '../components/ui/icons'
import type { IconName } from '../components/ui/icons'
import PageShell from '../components/ui/PageShell'
import { useAppData, useDataStore, useNow } from '../data/hooks'
import type { NavigationTarget, NotificationKind } from '../data/types'
import { formatRelativeTime } from '../lib/format'

const kindIcon: Record<NotificationKind, IconName> = {
  'low-stock': 'alert',
  'out-of-stock': 'ban',
  transaction: 'receipt',
  'revenue-target': 'target',
  'savings-target': 'savings',
  insight: 'spark',
}

const kindLabel: Record<NotificationKind, string> = {
  'low-stock': 'Stok menipis',
  'out-of-stock': 'Stok habis',
  transaction: 'Transaksi',
  'revenue-target': 'Target pendapatan',
  'savings-target': 'Target tabungan',
  insight: 'Insight',
}

const targetLabel = (target: NavigationTarget): string => {
  if (target.page === 'Activities') return 'Lihat transaksi'
  if (target.page === 'AI') return 'Buka Arbor'
  return target.section === 'business-goals' ? 'Lihat target' : 'Lihat stok'
}

function NotificationsPage({ onNavigate }: { onNavigate: (target: NavigationTarget) => void }) {
  const store = useDataStore()
  const { data } = useAppData()
  const now = useNow()
  const [tab, setTab] = useState<'all' | 'unread'>('all')

  const unreadCount = data.notifications.filter((item) => !item.read).length
  const visible = tab === 'unread' ? data.notifications.filter((item) => !item.read) : data.notifications

  const tabClass = (active: boolean) =>
    `rounded-full px-4 py-2 text-xs font-bold transition-[transform,background-color] active:scale-[0.97] ${active ? 'bg-[#2d2d2d] text-[#F5F5F5]' : 'bg-white/50 text-[#2d2d2d] hover:bg-white/80'}`

  return (
    <PageShell title="Notifications">
      <div className="space-y-3">
        <div className={`${glassCardPadded} flex flex-wrap items-center justify-between gap-3`}>
          <div role="group" aria-label="Filter notifikasi" className="flex gap-2">
            <button type="button" aria-pressed={tab === 'all'} onClick={() => setTab('all')} className={tabClass(tab === 'all')}>
              Semua ({data.notifications.length})
            </button>
            <button type="button" aria-pressed={tab === 'unread'} onClick={() => setTab('unread')} className={tabClass(tab === 'unread')}>
              Belum dibaca ({unreadCount})
            </button>
          </div>
          <button type="button" disabled={unreadCount === 0} onClick={() => store.markAllNotificationsRead()} className={secondaryButton}>
            Tandai semua dibaca
          </button>
        </div>

        {visible.length === 0 ? (
          <div className={`${glassCardPadded} py-12 text-center`}>
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-white/60">
              <Icon name="bell" className="size-6" />
            </span>
            <p className="mt-3 text-base font-black">
              {data.notifications.length === 0 ? 'Belum ada notifikasi' : 'Semua notifikasi sudah dibaca'}
            </p>
            <p className="mt-1 text-sm text-[#555555]">
              {data.notifications.length === 0
                ? 'Notifikasi stok, transaksi, dan target akan muncul di sini.'
                : 'Tidak ada notifikasi baru saat ini.'}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {visible.map((notification) => (
              <li key={notification.id}>
                <button
                  type="button"
                  onClick={() => {
                    store.markNotificationRead(notification.id)
                    onNavigate(notification.target)
                  }}
                  className={`${glassCardPadded} flex w-full items-start gap-3 text-left transition-[transform,background-color] hover:bg-white/60 active:scale-[0.995] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2d2d2d] ${notification.read ? 'opacity-80' : ''}`}
                >
                  <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-white/60">
                    <Icon name={kindIcon[notification.kind]} className="size-5" />
                    {!notification.read && (
                      <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 size-3 rounded-full border-2 border-[#f4f5f2] bg-[#b3261e]" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className={`text-sm ${notification.read ? 'font-bold' : 'font-black'}`}>{notification.title}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${notification.read ? 'bg-white/60 text-[#555555]' : 'bg-[#b3261e] text-white'}`}>
                        {notification.read ? 'Dibaca' : 'Baru'}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-[#555555]">{notification.message}</span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-x-3 text-[11px] text-[#555555]">
                      <span>{kindLabel[notification.kind]}</span>
                      <span>{formatRelativeTime(Date.parse(notification.createdAt), now)}</span>
                      <span className="flex items-center gap-0.5 font-bold text-[#2d2d2d]">
                        {targetLabel(notification.target)}
                        <Icon name="chevron-right" className="size-3.5" />
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageShell>
  )
}

export default NotificationsPage
