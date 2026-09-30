/**
 * Toast host on Base UI's Toast, rendered into the shared portal container so the
 * scoped reset applies. The manager lives outside React, so notify() works from
 * anywhere without a hook. Each toast runs its own countdown, which both dismisses it
 * and drains the ring around its close button; Base UI's timer stays off, so hovering
 * doesn't pause it.
 *
 * @since 1.1.0
 */
import { useCallback, useEffect, useRef, type RefObject } from 'react'
import { Toast } from '@base-ui/react/toast'
import { __ } from '@wordpress/i18n'
import { XIcon } from 'lucide-react'
import { alertDescriptionClass, alertVariants } from '@/ui/alert'
import { buttonVariants } from '@/ui/button'
import { usePortalContainer } from '@/ui/portal'
import { cn } from '@/ui/utils'
import type { Notify } from './store'

const TIMEOUT_MS = 10_000

interface Raise {
  raise: number
}

const manager = Toast.createToastManager<Raise>()
let raises = 0

// The id is the message: re-raising it restarts the countdown instead of stacking a duplicate.
// WHY a raise count, not Base UI's updateKey: re-raising a closing toast re-adds it with
// updateKey 0 on the same instance, so a toast never updated before would keep its spent count.
export const notify: Notify = (type, text) => {
  manager.add({ id: `${type}:${text}`, type, title: text, timeout: 0, priority: type === 'error' ? 'high' : 'low', data: { raise: ++raises } })
}

export function Toaster() {
  const container = usePortalContainer()
  // WHY no limit: Base UI keeps a toast past its limit on screen but inert, so its close button stops working.
  return (
    <Toast.Provider toastManager={manager} limit={Infinity}>
      <Toast.Portal container={container ?? undefined}>
        {/* WHY the admin bar's height: the toasts sit above its z-index, so they'd cover it; core sets the property. */}
        <Toast.Viewport
          aria-label={__('Notifications', 'fastcgi-cache-for-ploi')}
          className="tw:fixed tw:end-4 tw:top-[calc(var(--wp-admin--admin-bar--height,0px)+--spacing(4))] tw:z-toast tw:flex tw:w-80 tw:max-w-(--toast-max-width) tw:flex-col tw:gap-2"
        >
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  )
}

function ToastList() {
  const { toasts } = Toast.useToastManager<Raise>()
  // Oldest first, so a new toast lands at the bottom of the stack.
  return [...toasts].reverse().map((toast) => <ToastItem key={toast.id} toast={toast} />)
}

function ToastItem({ toast }: { toast: Toast.Root.ToastObject<Raise> }) {
  const ring = useRef<SVGCircleElement>(null)
  const close = useCallback(() => manager.close(toast.id), [toast.id])
  useCountdown(ring, TIMEOUT_MS, toast.data?.raise ?? 0, close)
  const error = toast.type === 'error'

  return (
    <Toast.Root
      toast={toast}
      swipeDirection={[]}
      data-testid={`toast-${toast.type}`}
      className={cn(
        alertVariants({ variant: error ? 'destructive' : 'success' }),
        'tw:relative tw:pe-(--notice-dismissible-padding) tw:mobile:pe-(--notice-dismissible-padding-mobile) tw:transition tw:duration-200 tw:ease-out tw:data-ending-style:duration-150 tw:data-ending-style:ease-in',
        'tw:data-starting-style:translate-x-4 tw:data-starting-style:opacity-0 tw:data-ending-style:translate-x-4 tw:data-ending-style:opacity-0',
        'tw:rtl:data-starting-style:-translate-x-4 tw:rtl:data-ending-style:-translate-x-4'
      )}
    >
      <Toast.Title render={<p />} className={alertDescriptionClass} />
      <Toast.Close
        aria-label={__('Dismiss this notice.', 'fastcgi-cache-for-ploi')}
        className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'tw:group/dismiss tw:absolute tw:end-1 tw:top-1')}
      >
        <CountdownRing ringRef={ring} className={error ? 'tw:text-countdown-error' : 'tw:text-countdown-success'} />
        <XIcon aria-hidden="true" className="tw:size-5 tw:group-hover/dismiss:opacity-70 tw:group-active/dismiss:opacity-70" />
      </Toast.Close>
    </Toast.Root>
  )
}

/**
 * Drains `ring` over `durationMs` of visible time, then calls `onEnd`; a new
 * `restartKey` starts it over. WHY drawn on the element: a React state per frame would
 * re-render the whole toast 60 times a second.
 */
function useCountdown(ring: RefObject<SVGCircleElement>, durationMs: number, restartKey: number, onEnd: () => void): void {
  useEffect(() => {
    let elapsed = 0
    let last: number | null = null
    let frame = 0
    // A hidden page draws no frames: forgetting the last one keeps the gap out of the count.
    const forgetLastFrame = () => {
      last = null
    }
    const tick = (now: number) => {
      elapsed += last === null ? 0 : now - last
      last = now
      const left = Math.max(0, 1 - elapsed / durationMs)
      ring.current?.setAttribute('stroke-dashoffset', String(100 - left * 100))
      if (left > 0) frame = requestAnimationFrame(tick)
      else onEnd()
    }
    frame = requestAnimationFrame(tick)
    document.addEventListener('visibilitychange', forgetLastFrame)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', forgetLastFrame)
    }
  }, [ring, durationMs, restartKey, onEnd])
}

function CountdownRing({ ringRef, className }: { ringRef: RefObject<SVGCircleElement>; className: string }) {
  return (
    <svg viewBox="0 0 34 34" aria-hidden="true" className={cn('tw:pointer-events-none tw:absolute tw:inset-0 tw:size-full', className)}>
      <circle cx="17" cy="17" r="14" fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.2" />
      <circle
        ref={ringRef}
        cx="17"
        cy="17"
        r="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        transform="rotate(-90 17 17)"
        pathLength={100}
        strokeDasharray="100"
      />
    </svg>
  )
}
