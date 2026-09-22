/**
 * Logs tab: the Recent flushes table, with a hint tooltip on failed rows.
 *
 * @since 1.1.0
 */
import { __ } from '@wordpress/i18n'
import { cn } from 'cn'
import { Badge } from '@/ui/badge'
import { Button, buttonVariants } from '@/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/ui/card'
import { Spinner } from '@/ui/spinner'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'
import type { LogEntry } from './store'

interface Props {
  entries: LogEntry[]
  busy: boolean
  onRefresh: () => void
}

export default function LogsTab({ entries, busy, onRefresh }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{__('Recent flushes', 'fastcgi-cache-for-ploi')}</h2>
        </CardTitle>
        <CardAction>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => onRefresh()}>
            {busy && <Spinner />}
            {__('Refresh', 'fastcgi-cache-for-ploi')}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="tw:py-6 tw:text-center tw:text-muted-foreground">{__('No flushes recorded yet.', 'fastcgi-cache-for-ploi')}</p>
        ) : (
          // GOTCHA: a sticky header pins to the nearest overflow ancestor, so this box must wrap the
          // <table> directly; shadcn's Table wrapper (overflow-x-auto) would capture it instead.
          <div className="tw:max-h-96 tw:overflow-y-auto">
            <table className="tw:w-full tw:text-sm">
              <TableHeader className="tw:sticky tw:top-0 tw:z-10 tw:bg-card">
                <TableRow>
                  <TableHead>{__('When', 'fastcgi-cache-for-ploi')}</TableHead>
                  <TableHead>{__('Trigger', 'fastcgi-cache-for-ploi')}</TableHead>
                  <TableHead>{__('Target', 'fastcgi-cache-for-ploi')}</TableHead>
                  <TableHead>{__('Result', 'fastcgi-cache-for-ploi')}</TableHead>
                  <TableHead>{__('Duration', 'fastcgi-cache-for-ploi')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry, index) => (
                  <TableRow key={entry.id ?? index}>
                    <TableCell>{entry.created_at}</TableCell>
                    <TableCell>{entry.reason_label}</TableCell>
                    <TableCell>
                      {entry.server_id} / {entry.site_id}
                    </TableCell>
                    <TableCell className="tw:whitespace-normal">
                      <Badge variant={entry.success ? 'secondary' : 'destructive'} className={cn(entry.success && 'tw:bg-green-100 tw:text-green-800')}>
                        {entry.success ? __('Success', 'fastcgi-cache-for-ploi') : __('Failed', 'fastcgi-cache-for-ploi')}
                      </Badge>
                      {entry.http_code ? (
                        <span className="tw:ml-1 tw:inline-flex tw:items-center tw:gap-1 tw:align-middle tw:text-muted-foreground">
                          HTTP {entry.http_code}
                          {entry.hint && <Hint text={entry.hint} />}
                        </span>
                      ) : null}
                      {entry.message && <div className="tw:mt-1 tw:text-destructive">{entry.message}</div>}
                    </TableCell>
                    <TableCell>{entry.duration_ms} ms</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Hint({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger aria-label={text} className={cn(buttonVariants({ variant: 'ghost', size: 'icon-xs' }), 'tw:rounded-full')}>
        ?
      </TooltipTrigger>
      {/* CONTRACT: tests/e2e/support/settings-page.js finds the open panel by this test id. */}
      <TooltipContent side="bottom" data-testid="log-hint">
        {text}
      </TooltipContent>
    </Tooltip>
  )
}
