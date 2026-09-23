/**
 * Settings tab: the connection card, the auto-flush event toggles, and Save.
 *
 * @since 1.1.0
 */
import { __ } from '@wordpress/i18n'
import { Button } from '@/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card'
import { Checkbox } from '@/ui/checkbox'
import { Spinner } from '@/ui/spinner'
import ConnectionCard from './ConnectionCard'
import type { Actions, FlushEvent, State } from './store'

interface Props {
  events: FlushEvent[]
  state: State
  actions: Actions
}

export default function SettingsTab({ events, state, actions }: Props) {
  const { busy, enabled } = state

  return (
    <>
      <ConnectionCard state={state} actions={actions} />
      <Card>
        <CardHeader>
          <CardTitle render={<h2 />}>{__('Flush automatically when…', 'fastcgi-cache-for-ploi')}</CardTitle>
        </CardHeader>
        <CardContent className="tw:flex tw:flex-col tw:gap-3">
          {events.map((event) => (
            <label
              key={event.key}
              className="tw:flex tw:cursor-pointer tw:items-start tw:gap-3 tw:rounded-row tw:border tw:border-solid tw:border-border-subtle tw:p-3 tw:hover:bg-row-hover"
            >
              <Checkbox className="tw:mt-1" checked={enabled[event.key] ?? false} onCheckedChange={(checked) => actions.toggleEvent(event.key, checked)} />
              <span className="tw:flex tw:flex-col">
                <span className="tw:text-label tw:font-semibold">{event.label}</span>
                <span className="tw:text-body tw:text-muted-foreground">{event.description}</span>
              </span>
            </label>
          ))}
        </CardContent>
      </Card>
      <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-3">
        <Button disabled={busy.save} onClick={() => actions.save(enabled)}>
          {busy.save && <Spinner />}
          {busy.save ? __('Saving…', 'fastcgi-cache-for-ploi') : __('Save settings', 'fastcgi-cache-for-ploi')}
        </Button>
      </div>
    </>
  )
}
