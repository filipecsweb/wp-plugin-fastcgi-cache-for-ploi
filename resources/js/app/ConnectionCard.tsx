/**
 * Connection card: the Ploi API token (connect / disconnect), the saved flush
 * target, and Flush now.
 *
 * @since 1.1.0
 */
import { useState } from 'react'
import { createInterpolateElement } from '@wordpress/element'
import { __, sprintf } from '@wordpress/i18n'
import { PencilIcon, RefreshCwIcon } from 'lucide-react'
import { Button } from '@/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card'
import { Input } from '@/ui/input'
import { Spinner } from '@/ui/spinner'
import { canFlush, flushDisabledReason, needsReconnect, type Actions, type State } from './store'
import TargetDialog from './TargetDialog'

const API_KEYS_URL = 'https://ploi.io/profile/api-keys'

interface Props {
  state: State
  actions: Actions
}

export default function ConnectionCard({ state, actions }: Props) {
  const [token, setToken] = useState('')
  const { hasToken, serverId, serverName, siteId, siteDomain } = state.saved
  const { busy } = state
  const flushable = canFlush(state)
  const disabledReason = flushDisabledReason(state)

  const connect = async () => {
    if (await actions.connect(token)) setToken('')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{__('Connection', 'fastcgi-cache-for-ploi')}</h2>
        </CardTitle>
        <CardDescription>
          {__(
            'Connecting validates your token with Ploi and stores it encrypted; a saved token is never shown again. Disconnect to enter a different one.',
            'fastcgi-cache-for-ploi'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="tw:flex tw:flex-col tw:gap-3">
        <form
          className="tw:flex tw:flex-col tw:gap-3 tw:sm:flex-row tw:sm:items-end"
          onSubmit={(event) => {
            event.preventDefault()
            void connect()
          }}
        >
          <label className="tw:flex tw:flex-1 tw:flex-col tw:gap-1">
            <span className="tw:font-medium">{__('Ploi API token', 'fastcgi-cache-for-ploi')}</span>
            <Input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={token}
              onChange={(event) => setToken(event.target.value)}
              disabled={hasToken}
              placeholder={
                hasToken
                  ? __('Connected — disconnect to enter a new token', 'fastcgi-cache-for-ploi')
                  : __('Enter your Ploi API token', 'fastcgi-cache-for-ploi')
              }
            />
          </label>
          {hasToken ? (
            <Button variant="destructive" disabled={busy.disconnect} onClick={() => actions.disconnect()}>
              {busy.disconnect && <Spinner />}
              {busy.disconnect ? __('Disconnecting…', 'fastcgi-cache-for-ploi') : __('Disconnect', 'fastcgi-cache-for-ploi')}
            </Button>
          ) : (
            <Button type="submit" disabled={busy.connect}>
              {busy.connect && <Spinner />}
              {busy.connect ? __('Connecting…', 'fastcgi-cache-for-ploi') : __('Connect', 'fastcgi-cache-for-ploi')}
            </Button>
          )}
        </form>

        <p className="tw:text-muted-foreground">
          {createInterpolateElement(
            sprintf(
              /* translators: 1: <strong>-wrapped breadcrumb to the Ploi API keys screen; 2: opening <a> tag; 3: closing </a> tag; 4: <code>-wrapped example token name. */
              __(
                "Paste a Ploi API token to connect. Create one in %1$s (%2$sopen ↗%3$s) and name it something like %4$s so it's easy to find and revoke later.",
                'fastcgi-cache-for-ploi'
              ),
              `<strong>${__('Ploi → API keys', 'fastcgi-cache-for-ploi')}</strong>`,
              '<a>',
              '</a>',
              `<code>${__('FastCGI Cache — yoursite.com', 'fastcgi-cache-for-ploi')}</code>`
            ),
            {
              strong: <strong />,
              a: <a href={API_KEYS_URL} target="_blank" rel="noopener noreferrer" className="tw:underline tw:underline-offset-3" />,
              code: <code />,
            }
          )}
        </p>

        <div className="tw:flex tw:flex-col tw:gap-1 tw:border-t tw:pt-4">
          <span className="tw:font-medium">{__('Flush target (Server and Site)', 'fastcgi-cache-for-ploi')}</span>
          {flushable ? (
            <p className="tw:text-muted-foreground">
              {__('Currently flushing:', 'fastcgi-cache-for-ploi')}{' '}
              <strong className="tw:text-foreground">{`${serverName || serverId} → ${siteDomain || siteId}`}</strong>
            </p>
          ) : (
            disabledReason && <p className="tw:text-muted-foreground">{disabledReason}</p>
          )}
          <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-3">
            {hasToken && !needsReconnect(state) && (
              <Button variant="outline" onClick={() => actions.openTargetModal(state.saved)}>
                <PencilIcon aria-hidden="true" />
                {flushable ? __('Change', 'fastcgi-cache-for-ploi') : __('Select target', 'fastcgi-cache-for-ploi')}
              </Button>
            )}
            <Button variant="outline" className="tw:ml-auto" disabled={!flushable || busy.flush} onClick={() => actions.flushNow()}>
              {busy.flush ? <Spinner /> : <RefreshCwIcon aria-hidden="true" />}
              {busy.flush ? __('Flushing…', 'fastcgi-cache-for-ploi') : __('Flush now', 'fastcgi-cache-for-ploi')}
            </Button>
          </div>
        </div>
        <TargetDialog state={state} actions={actions} />
      </CardContent>
    </Card>
  )
}
