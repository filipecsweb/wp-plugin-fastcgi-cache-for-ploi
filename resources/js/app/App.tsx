/**
 * Settings screen shell: the store, the two tabs kept in sync with the URL hash,
 * the hosts every portalled primitive renders into, and the footer.
 *
 * @since 1.1.0
 */
import { useState } from 'react'
import { __, sprintf } from '@wordpress/i18n'
import type { Api } from '@/shared/api'
import { PortalContainer } from '@/ui/portal'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs'
import { TooltipProvider } from '@/ui/tooltip'
import LogsTab from './LogsTab'
import Notices from './Notices'
import SettingsTab from './SettingsTab'
import { canFlush, useStore, type Config } from './store'
import { TAB_KEYS, initialTab, isTabKey, type TabKey } from './tabs'
import { Toaster, notify } from './toaster'

interface Props {
  cfg: Config
  api: Api
}

export default function App({ cfg, api }: Props) {
  const [tab, setTab] = useState(() => initialTab(window.location.hash))
  const [portal, setPortal] = useState<HTMLDivElement | null>(null)
  const { state, actions } = useStore(cfg, api, notify)

  const labels: Record<TabKey, string> = {
    settings: __('Settings', 'fastcgi-cache-for-ploi'),
    logs: __('Logs', 'fastcgi-cache-for-ploi'),
  }

  const selectTab = (next: unknown) => {
    if (!isTabKey(next)) return
    setTab(next)
    // replaceState: refresh-safe and shareable, without a history entry or a scroll jump.
    window.history.replaceState(null, '', `#${next}`)
  }

  return (
    <PortalContainer.Provider value={portal}>
      <TooltipProvider>
        {/* CONTRACT: tests/e2e/support/settings-page.js finds the screen by this class and reads these data-* attributes; every UI renders the same set with the same string values. */}
        <div
          className="ploi-cache-admin tw:mt-4 tw:flex tw:max-w-3xl tw:flex-col tw:gap-5"
          data-has-token={String(state.saved.hasToken)}
          data-can-flush={String(canFlush(state))}
          data-busy-flush={String(state.busy.flush)}
          data-busy-sites={String(state.busy.sites)}
          data-reconnect-reason={state.reconnectReason}
          data-log-top-id={String(state.log[0]?.id ?? '')}
        >
          <Notices reconnectReason={state.reconnectReason} keyWarning={cfg.keyWarning} />
          <Tabs value={tab} onValueChange={selectTab}>
            <TabsList aria-label={__('Settings sections', 'fastcgi-cache-for-ploi')}>
              {TAB_KEYS.map((key) => (
                <TabsTrigger key={key} value={key}>
                  {labels[key]}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="settings" className="tw:flex tw:flex-col tw:gap-5">
              <SettingsTab events={cfg.events} state={state} actions={actions} />
            </TabsContent>
            <TabsContent value="logs">
              <LogsTab entries={state.log} busy={state.busy.log} onRefresh={actions.loadLog} />
            </TabsContent>
          </Tabs>
          <Toaster />
          <div ref={setPortal} />
        </div>
        <footer className="tw:mt-8 tw:border-t tw:pt-4 tw:text-muted-foreground">
          <p>
            <strong className="tw:text-foreground">{cfg.plugin.name}</strong>
            <span className="tw:mx-1">·</span>
            {sprintf(
              /* translators: %s: plugin version number. */
              __('Version %s', 'fastcgi-cache-for-ploi'),
              cfg.plugin.version
            )}
          </p>
          <p className="tw:mt-1">{__('Ploi is a trademark of its respective owner. This plugin is not affiliated with or endorsed by Ploi.', 'fastcgi-cache-for-ploi')}</p>
        </footer>
      </TooltipProvider>
    </PortalContainer.Provider>
  )
}
