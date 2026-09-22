/**
 * Change-target dialog: the server and site pickers over the working copy, the
 * gone-target notice, Cancel and Save target. Open state lives in the store, so a
 * reconnect closes it from anywhere.
 *
 * @since 1.1.0
 */
import { __ } from '@wordpress/i18n'
import { Alert, AlertDescription } from '@/ui/alert'
import { Button } from '@/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog'
import { NativeSelect, NativeSelectOption } from '@/ui/native-select'
import { Spinner } from '@/ui/spinner'
import { selectedTarget, type Actions, type GoneLevel, type State } from './store'

interface Props {
  state: State
  actions: Actions
}

export default function TargetDialog({ state, actions }: Props) {
  const { target, servers, sites, serversLoaded, targetGone, targetModalOpen, busy } = state
  const canSave = serversLoaded && target.serverId !== '' && target.siteId !== '' && !busy.target

  return (
    <Dialog
      open={targetModalOpen}
      onOpenChange={(open) => {
        if (!open) actions.closeTargetModal()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{__('Change flush target', 'fastcgi-cache-for-ploi')}</DialogTitle>
        </DialogHeader>
        <DialogBody className="tw:flex tw:flex-col tw:gap-4">
          {targetGone && (
            <Alert variant="warning" role="status">
              <AlertDescription>{goneCopy(targetGone)}</AlertDescription>
            </Alert>
          )}

          <div className="tw:grid tw:gap-4 tw:sm:grid-cols-2">
            <label className="tw:flex tw:flex-col tw:gap-1">
              <span className="tw:flex tw:items-center tw:gap-2 tw:text-label tw:font-semibold">
                {__('Server', 'fastcgi-cache-for-ploi')}
                {busy.servers && <Spinner />}
              </span>
              <NativeSelect
                className="tw:w-full"
                value={target.serverId}
                onChange={(event) => void actions.selectServer(event.target.value)}
                disabled={busy.servers || servers.length === 0}
              >
                <NativeSelectOption value="">{__('— Select a server —', 'fastcgi-cache-for-ploi')}</NativeSelectOption>
                {servers.map((server) => (
                  <NativeSelectOption key={server.id} value={server.id}>
                    {server.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {serversLoaded && !busy.servers && servers.length === 0 && (
                <span className="tw:text-body tw:text-muted-foreground">{__('No servers found for this token.', 'fastcgi-cache-for-ploi')}</span>
              )}
            </label>

            <label className="tw:flex tw:flex-col tw:gap-1">
              <span className="tw:flex tw:items-center tw:gap-2 tw:text-label tw:font-semibold">
                {__('Site', 'fastcgi-cache-for-ploi')}
                {busy.sites && <Spinner />}
              </span>
              <NativeSelect
                className="tw:w-full"
                value={target.siteId}
                onChange={(event) => actions.selectSite(event.target.value)}
                disabled={busy.sites || !target.serverId || sites.length === 0}
              >
                <NativeSelectOption value="">{__('— Select a site —', 'fastcgi-cache-for-ploi')}</NativeSelectOption>
                {sites.map((site) => (
                  <NativeSelectOption key={site.id} value={site.id}>
                    {site.domain}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {!target.serverId && <span className="tw:text-body tw:text-muted-foreground">{__('Choose a server first.', 'fastcgi-cache-for-ploi')}</span>}
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" disabled={busy.target} onClick={actions.closeTargetModal}>
              {__('Cancel', 'fastcgi-cache-for-ploi')}
            </Button>
            <Button disabled={!canSave} onClick={() => actions.saveTarget(selectedTarget(state))}>
              {busy.target && <Spinner />}
              {busy.target ? __('Saving…', 'fastcgi-cache-for-ploi') : __('Save target', 'fastcgi-cache-for-ploi')}
            </Button>
          </DialogFooter>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}

function goneCopy(level: GoneLevel): string {
  const copy: Record<GoneLevel, string> = {
    server: __('The saved server no longer exists in Ploi. Choose a new server and site.', 'fastcgi-cache-for-ploi'),
    site: __('The saved site no longer exists in Ploi. Choose another site.', 'fastcgi-cache-for-ploi'),
  }
  return copy[level]
}
