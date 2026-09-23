/**
 * Class merging for the kit, on the merge tables `cn build` compiles from the kit's sources
 * and ./cn.config.mjs (the `cn` plugin in vite.config.js writes them).
 *
 * @since 1.1.0
 */
import { createCn } from 'cn/engine'
import tables from './cn-tables.js'

export const cn = createCn(tables)
