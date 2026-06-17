import Alpine from 'alpinejs'
import ploiCache from './settings/store.js'
import tooltip from './components/tooltip.js'
import '../css/admin.css'

window.Alpine = Alpine
Alpine.data('ploiCache', ploiCache)
Alpine.data('tooltip', tooltip)
Alpine.start()
