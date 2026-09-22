/**
 * The settings screen's tabs and their URL-hash form (#settings / #logs).
 *
 * @since 1.1.0
 */
export const TAB_KEYS = ['settings', 'logs'] as const

export type TabKey = (typeof TAB_KEYS)[number]

export const isTabKey = (value: unknown): value is TabKey => TAB_KEYS.includes(value as TabKey)

export function initialTab(hash: string): TabKey {
  const fromHash = hash.replace(/^#/, '')
  return isTabKey(fromHash) ? fromHash : TAB_KEYS[0]
}
