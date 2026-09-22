/**
 * React settings-screen entry point.
 *
 * @since 1.1.0
 */
import { StrictMode } from 'react'
import { createRoot } from '@wordpress/element'
import { createApi } from '@/shared/api'
import App from './App'
import type { Config } from './store'
import '../../css/app.css'

declare global {
  interface Window {
    // AdminServiceProvider::config(), localized on the entry's handle.
    PloiCacheConfig: Config
  }
}

// CONTRACT: the id is SettingsPage::APP_ROOT_ID, which app.css also scopes its reset to.
const mount = document.getElementById('fastcgi-cache-for-ploi-app')

if (mount) {
  const cfg = window.PloiCacheConfig
  createRoot(mount).render(
    <StrictMode>
      <App cfg={cfg} api={createApi(cfg.restNamespace)} />
    </StrictMode>
  )
}
