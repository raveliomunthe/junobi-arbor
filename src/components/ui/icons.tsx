export type IconName =
  | 'income'
  | 'expense'
  | 'profit'
  | 'wallet'
  | 'box'
  | 'layers'
  | 'alert'
  | 'ban'
  | 'target'
  | 'savings'
  | 'spark'
  | 'trend-up'
  | 'trend-down'
  | 'star'
  | 'bell'
  | 'receipt'
  | 'search'
  | 'send'
  | 'close'
  | 'check'
  | 'chevron-right'
  | 'refresh'

const paths: Record<IconName, string> = {
  income: 'M12 19V5m0 0-5 5m5-5 5 5',
  expense: 'M12 5v14m0 0-5-5m5 5 5-5',
  profit: 'M4 17l5-5 4 4 7-8M15 8h5v5',
  wallet: 'M4 7a2 2 0 0 1 2-2h11v3M4 7v10a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H6a2 2 0 0 1-2-2zm12 7h2',
  box: 'M21 8 12 3 3 8m18 0v8l-9 5m9-13-9 5m0 8-9-5V8m9 5v8M3 8l9 5',
  layers: 'm12 3 9 5-9 5-9-5 9-5zm-9 9 9 5 9-5m-18 4 9 5 9-5',
  alert: 'M12 9v4m0 4h.01M10.3 4.3 2.8 17.5A2 2 0 0 0 4.5 20.5h15a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z',
  ban: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM5.6 5.6l12.8 12.8',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-5a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0-3h.01',
  savings: 'M5 10h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2zm3-5h8l1 5H7l1-5zm4 11v.01',
  spark: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3zm7 12 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z',
  'trend-up': 'M3 17l6-6 4 4 8-8m0 0h-5m5 0v5',
  'trend-down': 'M3 7l6 6 4-4 8 8m0 0h-5m5 0v-5',
  star: 'm12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3z',
  bell: 'M6 9a6 6 0 1 1 12 0c0 6 2 7 2 7H4s2-1 2-7zm4 10a2 2 0 0 0 4 0',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3zm3 5h6m-6 4h6',
  search: 'm21 21-4.3-4.3M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z',
  send: 'M5 12 20 4l-4 16-4-6-7-2zm7 2 8-10',
  close: 'M6 6l12 12M18 6 6 18',
  check: 'm5 12 5 5 9-10',
  'chevron-right': 'm9 6 6 6-6 6',
  refresh: 'M20 11a8 8 0 0 0-14.5-4M4 5v4h4m-4 4a8 8 0 0 0 14.5 4M20 19v-4h-4',
}

export function Icon({ name, className = 'size-5' }: { name: IconName; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={paths[name]} />
    </svg>
  )
}
