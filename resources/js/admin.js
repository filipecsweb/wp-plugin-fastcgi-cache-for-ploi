import Alpine from 'alpinejs'
import ploiCache from './settings/store.js'
import '../css/admin.css'

window.Alpine = Alpine
Alpine.data('ploiCache', ploiCache)
Alpine.start()
