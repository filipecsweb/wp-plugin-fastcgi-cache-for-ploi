/**
 * Toast host on Base UI's Toast, rendered into the shared portal container so the
 * scoped reset applies. The manager lives outside React, so notify() works from
 * anywhere without a hook.
 *
 * @since 1.1.0
 */
import { Toast } from '@base-ui/react/toast'
import { __ } from '@wordpress/i18n'
import { cn } from 'cn'
import { buttonVariants } from '@/ui/button'
import { usePortalContainer } from '@/ui/portal'
import type { Notify } from './store'

const TIMEOUT_MS = 10_000

const manager = Toast.createToastManager()

// The id is the message: re-raising it refreshes the countdown instead of stacking a duplicate.
export const notify: Notify = (type, text) => {
  manager.add({ id: `${type}:${text}`, type, title: text, timeout: TIMEOUT_MS, priority: type === 'error' ? 'high' : 'low' })
}

export function Toaster() {
  const container = usePortalContainer()
  return (
    <Toast.Provider toastManager={manager}>
      <Toast.Portal container={container ?? undefined}>
        <Toast.Viewport
          aria-label={__('Notifications', 'fastcgi-cache-for-ploi')}
          className="tw:fixed tw:right-4 tw:bottom-4 tw:z-[100001] tw:flex tw:w-80 tw:max-w-[calc(100vw-2rem)] tw:flex-col tw:gap-2"
        >
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  )
}

function ToastList() {
  const { toasts } = Toast.useToastManager()
  return toasts.map((toast) => (
    <Toast.Root
      key={toast.id}
      toast={toast}
      data-testid={`toast-${toast.type}`}
      className={cn(
        'tw:flex tw:items-start tw:gap-2 tw:rounded-lg tw:border-l-4 tw:bg-card tw:p-3 tw:text-sm tw:shadow-lg tw:ring-1 tw:ring-foreground/10 tw:transition tw:duration-200 tw:data-[starting-style]:translate-x-4 tw:data-[starting-style]:opacity-0 tw:data-[ending-style]:translate-x-4 tw:data-[ending-style]:opacity-0',
        toast.type === 'error' ? 'tw:border-l-destructive' : 'tw:border-l-green-600'
      )}
    >
      <Toast.Title render={<p />} className="tw:flex-1" />
      <Toast.Close
        aria-label={__('Dismiss this notice.', 'fastcgi-cache-for-ploi')}
        className={cn(buttonVariants({ variant: 'ghost', size: 'icon-xs' }), 'tw:-my-1 tw:-mr-1')}
      >
        ×
      </Toast.Close>
    </Toast.Root>
  ))
}
