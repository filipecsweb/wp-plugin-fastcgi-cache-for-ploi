/**
 * Persistent banners above both tabs: reconnect required, and the key warning.
 * Transient confirmations and errors are toasts.
 *
 * @since 1.1.0
 */
import { createInterpolateElement } from '@wordpress/element'
import { __ } from '@wordpress/i18n'
import { ShieldAlertIcon } from 'lucide-react'
import { RECONNECT_REASON, type ReconnectReason } from '@/shared/errors'
import { Alert, AlertDescription, AlertTitle } from '@/ui/alert'

interface Props {
  reconnectReason: ReconnectReason | ''
  keyWarning: boolean
}

export default function Notices({ reconnectReason, keyWarning }: Props) {
  return (
    <>
      {reconnectReason && (
        <Alert variant="destructive" role="status" aria-live="polite">
          <AlertTitle>{__('Reconnect required.', 'fastcgi-cache-for-ploi')}</AlertTitle>
          <AlertDescription>{reconnectCopy(reconnectReason)}</AlertDescription>
        </Alert>
      )}
      {keyWarning && (
        // WHY no role: the warning is static page content; Alert's default role="alert" would announce it on every load.
        <Alert variant="warning" role={undefined}>
          <ShieldAlertIcon aria-hidden="true" />
          <AlertTitle>{__("Harden your token's encryption key", 'fastcgi-cache-for-ploi')}</AlertTitle>
          <AlertDescription>
            {createInterpolateElement(
              __(
                "Your WordPress security keys (salts) aren't defined in <code>wp-config.php</code>. Define them — or add a dedicated key — so the key that encrypts your token lives in <code>wp-config.php</code>, separate from your database: <code>define( 'FASTCGI_CACHE_FOR_PLOI_KEY', '…' );</code>",
                'fastcgi-cache-for-ploi'
              ),
              { code: <code /> }
            )}
          </AlertDescription>
        </Alert>
      )}
    </>
  )
}

function reconnectCopy(reason: ReconnectReason): string {
  const copy: Record<ReconnectReason, string> = {
    [RECONNECT_REASON.UNREADABLE]: __(
      "Your saved token could not be read — your site's security keys may have changed. Re-enter your Ploi API token and click Connect.",
      'fastcgi-cache-for-ploi'
    ),
    [RECONNECT_REASON.INVALID]: __('Ploi rejected your saved token. Re-enter a valid Ploi API token and click Connect.', 'fastcgi-cache-for-ploi'),
    [RECONNECT_REASON.MISSING_PERMISSION]: __(
      'Your saved token is missing a required permission. Re-enter a token with the Servers and Sites scopes and click Connect.',
      'fastcgi-cache-for-ploi'
    ),
  }
  return copy[reason]
}
