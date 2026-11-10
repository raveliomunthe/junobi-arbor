import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import '@fontsource/montserrat/latin-500.css'
import aiIcon from './assets/ai.png'
import activitiesIcon from './assets/activities.png'
import homeIcon from './assets/home.png'
import menuIcon from './assets/menu.png' 
import notifIcon from './assets/notif.png'  
import profileIcon from './assets/profile.png'
import HomePage from './pages/HomePage'
import ActivitiesPage from './pages/ActivitiesPage'
import AIPage from './pages/AIPage'
import NotificationsPage from './pages/NotificationsPage'
import { useAuth } from './auth/useAuth'
import { useWorkspace } from './auth/useWorkspace'
import DemoDataReset from './components/profile/DemoDataReset'
import TransactionsContent from './components/transactions/TransactionsContent'
import WorkspacePanel from './components/workspace/WorkspacePanel'
import { DataProvider } from './data/DataProvider'
import { Icon } from './components/ui/icons'
import { useUnreadCount } from './data/hooks'
import type { NavigationTarget } from './data/types'

const items = ['Home', 'Activities', 'AI', 'Notif'] as const
const navSlots = ['Home', 'Activities', 'Add', 'AI', 'Notif'] as const
const expandedNavbarWidth = 'min(calc(111.111111vw - 2rem), 748px)'
type NavItem = (typeof items)[number]
type NavSlot = (typeof navSlots)[number]

function AppShell({ inDemo, onSwitchMode }: { inDemo: boolean; onSwitchMode: () => void }) {
  const { user, signOut } = useAuth()
  const unreadCount = useUnreadCount()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const [activeItem, setActiveItem] = useState<NavItem>('Home')
  const [activePopup, setActivePopup] = useState<'Menu' | 'Add' | 'Profile' | null>(null)
  // Where a notification, insight or recent transaction asked the target page to focus.
  // `nonce` remounts the page so the same target can be opened again.
  const [focus, setFocus] = useState<{ nonce: number; transactionId?: string; section?: string }>({ nonce: 0 })
  const [isPointerNearby, setIsPointerNearby] = useState(false)
  const [dragPosition, setDragPosition] = useState<number | null>(null)
  const [isPointerDown, setIsPointerDown] = useState(false)
  const [showBubble, setShowBubble] = useState(false)
  const pointerTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bubbleTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pageItemsRef = useRef<HTMLDivElement>(null)
  const indicatorRef = useRef<HTMLSpanElement>(null)
  const indicatorInsetRef = useRef<HTMLSpanElement>(null)
  const glassRef = useRef<HTMLSpanElement>(null)
  const indicatorMotion = useRef({
    position: 100 / navSlots.length / 2,
    target: 100 / navSlots.length / 2,
    velocity: 0,
    frame: 0,
    lastTime: 0,
  })
  const dragRef = useRef<{ pointerId: number; startX: number; startPosition: number; moved: boolean; item: NavItem } | null>(null)
  const suppressClick = useRef(false)
  const isShrunk = !isPointerNearby && activePopup === null && !isPointerDown
  const indicatorTarget = dragPosition ?? ((navSlots.indexOf(activeItem) + 0.5) / navSlots.length) * 100

  useLayoutEffect(() => {
    const motion = indicatorMotion.current
    motion.target = indicatorTarget

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      if (motion.frame) cancelAnimationFrame(motion.frame)
      motion.frame = 0
      motion.position = motion.target
      motion.velocity = 0
      if (indicatorRef.current) indicatorRef.current.style.left = `${motion.position}%`
      if (glassRef.current) glassRef.current.style.left = `${motion.position}%`
      if (indicatorInsetRef.current) {
        indicatorInsetRef.current.style.left = `${motion.position}%`
        indicatorInsetRef.current.dataset.moving = 'false'
      }
      return
    }

    if (motion.frame) return
    if (indicatorInsetRef.current) indicatorInsetRef.current.dataset.moving = 'true'
    motion.lastTime = 0
    // Keep velocity when the pointer changes the target so the indicator does not restart.
    const animate = (time: number) => {
      const elapsed = motion.lastTime ? Math.min((time - motion.lastTime) / 1000, 0.05) : 0
      motion.lastTime = time
      const displacement = motion.position - motion.target
      const frequency = 17
      const momentum = motion.velocity + frequency * displacement
      const decay = Math.exp(-frequency * elapsed)
      motion.position = motion.target + (displacement + momentum * elapsed) * decay
      motion.velocity = (motion.velocity - frequency * momentum * elapsed) * decay

      if (Math.abs(motion.position - motion.target) < 0.01 && Math.abs(motion.velocity) < 0.05) {
        motion.position = motion.target
        motion.velocity = 0
        motion.frame = 0
      } else {
        motion.frame = requestAnimationFrame(animate)
      }
      if (indicatorRef.current) indicatorRef.current.style.left = `${motion.position}%`
      if (glassRef.current) glassRef.current.style.left = `${motion.position}%`
      if (indicatorInsetRef.current) {
        indicatorInsetRef.current.style.left = `${motion.position}%`
        indicatorInsetRef.current.dataset.moving =
          Math.abs(motion.position - motion.target) >= 0.5 || Math.abs(motion.velocity) >= 5 ? 'true' : 'false'
      }
    }
    motion.frame = requestAnimationFrame(animate)
  }, [indicatorTarget])

  const iconByItem: Record<Exclude<NavItem, 'Add'>, string> = {
    Home: homeIcon,
    Activities: activitiesIcon,
    AI: aiIcon,
    Notif: notifIcon,
  }
  const indicatorSize = isShrunk ? 'h-5 w-5' : 'h-14 w-14'
  const togglePopup = (popup: 'Menu' | 'Add' | 'Profile') => {
    setActivePopup((currentPopup) => (currentPopup === popup ? null : popup))
  }
  const selectItem = (item: NavItem) => {
    setFocus((current) => ({ nonce: current.nonce }))
    setActiveItem(item)
  }
  const navigate = (target: NavigationTarget) => {
    setFocus((current) => ({ nonce: current.nonce + 1, transactionId: target.transactionId, section: target.section }))
    setActiveItem(target.page)
    setActivePopup(null)
  }

  useEffect(() => {
    if (!activePopup) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('[role="dialog"]')) setActivePopup(null)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [activePopup])
  const setPointerNearby = (nearby: boolean) => {
    if (pointerTimeout.current) clearTimeout(pointerTimeout.current)
    if (nearby === isPointerNearby) return

    pointerTimeout.current = setTimeout(() => {
      pointerTimeout.current = null
      setIsPointerNearby(nearby)
    }, nearby ? 60 : 140)
  }

  const getDragPosition = (clientX: number, startX: number, startPosition: number) => {
    const bounds = pageItemsRef.current?.getBoundingClientRect()
    if (!bounds || bounds.width === 0) return null

    const halfSlot = 100 / navSlots.length / 2
    const position = startPosition + ((clientX - startX) / bounds.width) * 100
    return Math.max(halfSlot, Math.min(100 - halfSlot, position))
  }

  const showClickBubble = () => {
    if (bubbleTimeout.current) clearTimeout(bubbleTimeout.current)
    setShowBubble(true)
    bubbleTimeout.current = setTimeout(() => {
      bubbleTimeout.current = null
      setShowBubble(false)
    }, 120)
  }

  const startIndicatorDrag = (event: PointerEvent<HTMLButtonElement>, item: NavSlot) => {
    if (item === 'Add') return
    if (isShrunk || dragRef.current || !event.isPrimary || event.button !== 0) return

    const bounds = indicatorRef.current?.getBoundingClientRect()
    if (!bounds) return
    suppressClick.current = false
    if (bubbleTimeout.current) clearTimeout(bubbleTimeout.current)
    bubbleTimeout.current = null
    setIsPointerDown(true)
    setShowBubble(true)
    const onIndicator = item === activeItem && event.clientX >= bounds.left && event.clientX <= bounds.right &&
      event.clientY >= bounds.top && event.clientY <= bounds.bottom
    const startPosition = onIndicator
      ? indicatorMotion.current.position
      : ((navSlots.indexOf(item) + 0.5) / navSlots.length) * 100

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startPosition,
      moved: false,
      item,
    }
    if (!onIndicator) {
      setDragPosition(startPosition)
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveIndicatorDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (!drag.moved && Math.abs(event.clientX - drag.startX) < 4) return

    drag.moved = true
    const position = getDragPosition(event.clientX, drag.startX, drag.startPosition)
    if (position !== null) setDragPosition(position)
  }

  const finishIndicatorDrag = (event: PointerEvent<HTMLButtonElement>, cancelled = false) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    if (!cancelled) {
      if (drag.moved) {
        const position = getDragPosition(event.clientX, drag.startX, drag.startPosition)
        if (position !== null) {
          let index = Math.min(navSlots.length - 1, Math.floor(position / (100 / navSlots.length)))
          if (navSlots[index] === 'Add') index = position < 50 ? index - 1 : index + 1
          const destination = navSlots[index]
          if (destination !== 'Add') selectItem(destination)
        }
      } else {
        selectItem(drag.item)
      }
      suppressClick.current = true
    }
    dragRef.current = null
    setDragPosition(null)
    setIsPointerDown(false)
    if (!cancelled && !drag.moved) {
      showClickBubble()
    } else {
      setShowBubble(false)
    }
  }

  useEffect(
    () => () => {
      if (pointerTimeout.current) clearTimeout(pointerTimeout.current)
      if (bubbleTimeout.current) clearTimeout(bubbleTimeout.current)
      if (indicatorMotion.current.frame) cancelAnimationFrame(indicatorMotion.current.frame)
      indicatorMotion.current.frame = 0
    },
    [],
  )

  return (
    <main className="relative min-h-[111.111111vh] bg-[#d9d9d9]">
      <div
        aria-hidden="true"
        className="fixed inset-6 rounded-[32px] bg-[#DDDDDD]/10"
      />
      <div className="relative px-6 pt-6 pb-9">
        {activeItem === 'Home' && <HomePage key={focus.nonce} focusSection={focus.section} onNavigate={navigate} />}
        {activeItem === 'Activities' && <ActivitiesPage key={focus.nonce} focusTransactionId={focus.transactionId} />}
        {activeItem === 'AI' && <AIPage onNavigate={navigate} />}
        {activeItem === 'Notif' && <NotificationsPage onNavigate={navigate} />}
      </div>
      {activePopup === 'Add' && (
        <section
          id="add-panel"
          aria-labelledby="add-panel-title"
          className="navbar-edge-sheen navbar-shell fixed top-[54px] bottom-[104px] left-1/2 z-10 flex -translate-x-1/2 flex-col rounded-[36px] bg-[#f4f5f2]/50 backdrop-blur-[5px]"
          style={{ width: expandedNavbarWidth }}
        >
          <div className="relative shrink-0">
            <h2 id="add-panel-title" className="pt-3 text-center font-['Montserrat',sans-serif] text-[28px] font-black text-[#2d2d2d]">
              Transactions
            </h2>
            <button
              type="button"
              aria-label="Close transactions"
              onClick={() => setActivePopup(null)}
              className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full bg-white/50 text-[#2d2d2d] transition-[transform,background-color] hover:bg-white/80 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2d2d2d]"
            >
              <Icon name="close" className="size-4" />
            </button>
          </div>
          <TransactionsContent
            onViewAll={() => navigate({ page: 'Activities' })}
            onOpenTransaction={(id) => navigate({ page: 'Activities', transactionId: id })}
          />
        </section>
      )}
      {activePopup === 'Menu' && (
        <div
          className="pointer-events-none fixed bottom-[104px] left-1/2 z-10 flex -translate-x-1/2 justify-start"
          style={{ width: expandedNavbarWidth }}
        >
          <WorkspacePanel />
        </div>
      )}
      {activePopup === 'Profile' && (
        <div
          className="pointer-events-none fixed bottom-[104px] left-1/2 z-10 flex -translate-x-1/2 justify-end"
          style={{ width: expandedNavbarWidth }}
        >
          <section
            aria-label="Account"
            className="navbar-edge-sheen navbar-shell pointer-events-auto w-[260px] rounded-[24px] bg-[#f4f5f2]/50 p-3 font-['Montserrat',sans-serif] text-[#2d2d2d] backdrop-blur-[5px]"
          >
            <p className="text-xs font-bold text-[#555555]">Signed in as</p>
            <p className="mt-1 truncate text-sm font-bold">{user?.email}</p>
            <p className="mt-1 text-xs font-medium text-[#555555]">{inDemo ? 'Demo mode (local data)' : 'Real account'}</p>
            <button
              type="button"
              onClick={onSwitchMode}
              className="mt-3 w-full rounded-full bg-[#2d2d2d]/10 px-4 py-2 text-xs font-bold text-[#2d2d2d]"
            >
              {inDemo ? 'Switch to real account' : 'Switch to demo'}
            </button>
            {signOutError && <p role="alert" className="mt-2 text-xs font-bold text-[#b3261e]">{signOutError}</p>}
            <button
              type="button"
              disabled={isSigningOut}
              onClick={async () => {
                setIsSigningOut(true)
                setSignOutError(null)
                const message = await signOut()
                if (message) setSignOutError(message)
                setIsSigningOut(false)
              }}
              className="mt-3 w-full rounded-full bg-[#2d2d2d] px-4 py-2 text-xs font-bold text-[#F5F5F5] disabled:opacity-50"
            >
              {isSigningOut ? 'Logging out...' : 'Log out'}
            </button>
            <DemoDataReset />
          </section>
        </div>
      )}
      <div
        className="fixed bottom-0 left-1/2 z-10 flex h-[168px] -translate-x-1/2 items-end justify-center pb-5"
        style={{ width: 'min(calc(111.111111vw - 2rem + 6rem), 844px)' }}
        onMouseEnter={() => setPointerNearby(true)}
        onMouseLeave={() => setPointerNearby(false)}
      >
      <nav
        aria-label="Main navigation"
        className={`navbar flex select-none items-center justify-between transition-[width,height,gap] duration-500 ease-in-out ${
          isShrunk ? 'h-9 gap-0' : 'h-[72px] gap-3'
        }`}
        style={{
          width: isShrunk
            ? 'min(calc((111.111111vw - 2rem) / 3), 200px)'
            : expandedNavbarWidth,
        }}
      >
        <button
          type="button"
          aria-label="Menu"
          aria-expanded={activePopup === 'Menu'}
          aria-hidden={isShrunk}
          tabIndex={isShrunk ? -1 : 0}
          onClick={() => togglePopup('Menu')}
          className={`navbar-side-button flex h-full shrink-0 items-center justify-center rounded-full font-medium text-[#555555] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#555555] ${
            isShrunk ? 'pointer-events-none w-0 text-[7px] opacity-0' : 'w-[72px] text-xs opacity-100'
          }`}
        >
          <span className={`navbar-edge-sheen navbar-shell flex ${isShrunk ? 'h-2/3 w-full' : 'h-full w-full'} items-center justify-center rounded-full bg-[#f4f5f2]/20 backdrop-blur-[5px] transition-[width,height,background-color] duration-500 ease-in-out`}>
            <span className={`navbar-side-indicator flex ${indicatorSize} items-center justify-center rounded-full ${!isShrunk && activePopup === 'Menu' ? 'pressed-surface text-[#F5F5F5]' : 'bg-transparent'}`}>
              <span className={`flex items-center gap-1 transition-opacity duration-300 ${isShrunk ? 'opacity-0' : 'opacity-100'}`}>
                <img
                  src={menuIcon}
                  alt=""
                  draggable={false}
                  className={`navbar-icon-shadow transition-[width,height] duration-500 ease-in-out ${isShrunk ? 'h-4 w-4' : 'h-6 w-6'}`}
                />
              </span>
            </span>
          </span>
        </button>
        <div className={`relative z-10 flex min-w-0 flex-1 items-stretch justify-around transition-[height,padding] duration-500 ease-in-out ${
          isShrunk ? 'h-9 px-1' : 'h-[72px] px-2'
        }`}>
          <div
            aria-hidden="true"
            className="navbar-edge-sheen navbar-shell pointer-events-none absolute inset-0 rounded-full bg-[#f4f5f2]/50 backdrop-blur-[5px]"
          />
          <div
            ref={pageItemsRef}
            aria-hidden={isShrunk}
            className={`absolute inset-0 flex min-w-0 items-stretch justify-around transition-opacity ease-in-out ${
              isShrunk
                ? 'pointer-events-none opacity-0 duration-200'
                : 'opacity-100 delay-200 duration-300'
            }`}
          >
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute inset-0 transition-opacity duration-[250ms] ease-in-out motion-reduce:transition-none ${
                showBubble ? 'z-20 opacity-50' : 'opacity-20'
              }`}
              style={{ filter: showBubble ? 'drop-shadow(0 14px 9px rgb(0 0 0 / 30%))' : undefined }}
            >
              <span
                ref={indicatorRef}
                className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-[width,height,background-color] duration-[250ms] ease-in-out motion-reduce:transition-none ${
                  showBubble ? 'bg-[#737373] h-[calc(100%+16px)]' : `bg-[#2d2d2d] ${isShrunk ? 'h-5' : 'h-14'}`
                }`}
                style={{
                  left: `${100 / navSlots.length / 2}%`,
                  width: showBubble
                    ? 'min(136px, calc(20% + 28px))'
                    : 'min(100px, max(0px, calc(20% - 16px)))',
                }}
              />
            </div>
            <span
              ref={glassRef}
              aria-hidden="true"
              className={`pointer-events-none absolute top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 backdrop-blur-[10px] transition-[width,height,opacity] duration-[250ms] ease-in-out motion-reduce:transition-none ${
                showBubble ? 'h-[calc(100%+16px)] opacity-100' : `${isShrunk ? 'h-5' : 'h-14'} opacity-0`
              }`}
              style={{
                left: `${100 / navSlots.length / 2}%`,
                width: showBubble
                  ? 'min(136px, calc(20% + 28px))'
                  : 'min(100px, max(0px, calc(20% - 16px)))',
              }}
            />
            <span
              ref={indicatorInsetRef}
              aria-hidden="true"
              data-moving="false"
              className={`indicator-inset pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ${
                showBubble ? 'h-[calc(100%+16px)]' : isShrunk ? 'h-5' : 'h-14'
              } ${showBubble || isPointerDown ? 'opacity-0' : 'opacity-100'}`}
              style={{
                left: `${100 / navSlots.length / 2}%`,
                width: showBubble
                  ? 'min(136px, calc(20% + 28px))'
                  : 'min(100px, max(0px, calc(20% - 16px)))',
              }}
            />
            {navSlots.map((item) => (
              <button
                key={item}
                type="button"
                aria-label={item === 'Notif' ? (unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications') : item}
                aria-expanded={item === 'Add' ? activePopup === 'Add' : undefined}
                aria-controls={item === 'Add' && activePopup === 'Add' ? 'add-panel' : undefined}
                aria-current={item !== 'Add' && activeItem === item ? 'page' : undefined}
                onClick={(event) => {
                  if (item === 'Add') {
                    togglePopup('Add')
                    return
                  }
                  const wasDrag = suppressClick.current && event.detail !== 0
                  suppressClick.current = false
                  if (wasDrag) return
                  showClickBubble()
                  selectItem(item)
                }}
                onPointerDown={item === 'Add' ? undefined : (event) => startIndicatorDrag(event, item)}
                onPointerMove={item === 'Add' ? undefined : moveIndicatorDrag}
                onPointerUp={item === 'Add' ? undefined : finishIndicatorDrag}
                onPointerCancel={item === 'Add' ? undefined : (event) => finishIndicatorDrag(event, true)}
                onLostPointerCapture={item === 'Add' ? undefined : (event) => finishIndicatorDrag(event, true)}
                tabIndex={isShrunk ? -1 : 0}
                className="navbar-page-button relative flex min-w-0 flex-1 touch-pan-y items-center justify-center rounded-full px-1 text-xs font-medium text-[#555555] focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[#555555]"
              >
                <span className={`flex max-w-full items-center justify-center gap-1 px-1 transition-[height] duration-500 ease-in-out ${
                  item === 'Add'
                    ? `${isShrunk ? 'h-5' : 'h-14'} add-button-face w-[min(100px,100%)] rounded-full navbar-edge-sheen navbar-shell bg-[#f4f5f2]/50 backdrop-blur-[5px] ${
                        activePopup === 'Add' ? 'is-pressed' : ''
                      }`
                    : `${isShrunk ? 'h-5' : 'h-14'} w-23 rounded-full`
                }`}>
                  {item === 'Add' ? (
                    <span aria-hidden="true" className="add-symbol" />
                  ) : (
                    <span className="relative flex shrink-0">
                      <img
                        src={iconByItem[item]}
                        alt=""
                        draggable={false}
                        className={`navbar-icon-shadow shrink-0 transition-[width,height] duration-500 ease-in-out ${
                          isShrunk && activeItem !== item ? 'h-4 w-4' : item === 'Activities' ? 'h-[22px] w-[22px]' : 'h-6 w-6'
                        }`}
                      />
                      {item === 'Notif' && unreadCount > 0 && (
                        <span
                          aria-hidden="true"
                          className="absolute -top-2 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#b3261e] px-1 font-['Montserrat',sans-serif] text-[9px] leading-none font-bold text-white"
                        >
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
          <span
            aria-hidden={!isShrunk}
            className={`pointer-events-none absolute inset-0 flex items-center justify-center font-['Montserrat',sans-serif] text-sm font-bold text-[#2d2d2d] transition-opacity duration-300 ease-in-out ${
              isShrunk ? 'opacity-100 delay-200' : 'opacity-0'
            }`}
          >
            {activeItem === 'Notif' ? 'Notifications' : activeItem}
            {unreadCount > 0 && activeItem !== 'Notif' && (
              <span className="ml-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#b3261e] px-1 text-[9px] leading-none font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </span>
        </div>
        <button
          type="button"
          aria-label="Profile"
          aria-expanded={activePopup === 'Profile'}
          aria-hidden={isShrunk}
          tabIndex={isShrunk ? -1 : 0}
          onClick={() => togglePopup('Profile')}
          className={`navbar-side-button flex h-full shrink-0 items-center justify-center rounded-full font-medium text-[#555555] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#555555] ${
            isShrunk ? 'pointer-events-none w-0 text-[7px] opacity-0' : 'w-[72px] text-xs opacity-100'
          }`}
        >
          <span className={`navbar-edge-sheen navbar-shell flex ${isShrunk ? 'h-2/3 w-full' : 'h-full w-full'} items-center justify-center rounded-full bg-[#f4f5f2]/50 backdrop-blur-[5px] transition-[width,height,background-color] duration-500 ease-in-out`}>
            <span className={`navbar-side-indicator flex ${indicatorSize} items-center justify-center rounded-full ${!isShrunk && activePopup === 'Profile' ? 'pressed-surface text-[#F5F5F5]' : 'bg-transparent'}`}>
              <span className={`flex items-center gap-1 transition-opacity duration-300 ${isShrunk ? 'opacity-0' : 'opacity-100'}`}>
                <img
                  src={profileIcon}
                  alt=""
                  draggable={false}
                  className={`navbar-icon-shadow transition-[width,height] duration-500 ease-in-out ${isShrunk ? 'h-4 w-4' : 'h-6 w-6'}`}
                />
              </span>
            </span>
          </span>
        </button>
      </nav>
      </div>
    </main>
  )
}

// Local demo data is scoped per workspace, so every workspace keeps its own transactions.
function App({ inDemo = false, onSwitchMode }: { inDemo?: boolean; onSwitchMode: () => void }) {
  const { activeWorkspace } = useWorkspace()
  return (
    <DataProvider scopeId={activeWorkspace?.id ?? 'local'}>
      <AppShell inDemo={inDemo} onSwitchMode={onSwitchMode} />
    </DataProvider>
  )
}

export default App