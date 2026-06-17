import Alpine from 'alpinejs'
import ploiCache from './settings/store.js'
import tooltip from './components/tooltip.js'
import toastStore from './components/toasts.js'
import '../css/admin.css'

window.Alpine = Alpine
Alpine.store('toasts', toastStore())
Alpine.data('ploiCache', ploiCache)
Alpine.data('tooltip', tooltip)
Alpine.start()
