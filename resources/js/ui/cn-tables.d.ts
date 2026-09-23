/**
 * Types for the generated, git-ignored ./cn-tables.js, so the type check runs before a build.
 *
 * @since 1.1.0
 */
import type { createCn } from 'cn/engine'

declare const tables: Parameters<typeof createCn>[0]
export default tables
