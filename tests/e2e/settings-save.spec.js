import { test, expect } from './support/fixtures.js'

/**
 * The auto-flush event toggles and Save settings. Flips the first toggle, saves, and
 * checks the persisted map out-of-band; the original map is restored afterwards, so
 * the suite's other specs keep their event preferences.
 */
test.describe('Save settings', () => {
  test('a toggled event is saved, survives a reload, and the rest stay as they were', async ({ admin, api, settings }) => {
    const before = (await api.settings()).enabledEvents
    const keys = Object.keys(before)
    expect(keys.length).toBeGreaterThan(0)
    await expect(settings.eventCheckboxes).toHaveCount(keys.length)

    const first = settings.eventCheckboxes.first()
    const wasChecked = await first.isChecked()

    try {
      await first.click()
      await expect(first).toBeChecked({ checked: !wasChecked })
      await settings.saveSettingsButton.click()
      await expect(settings.successToast).toContainText('Settings saved.')

      // Exactly the toggled key changed; the map's key order is the store's, not the screen's.
      const after = (await api.settings()).enabledEvents
      const changed = keys.filter((key) => after[key] !== before[key])
      expect(changed).toHaveLength(1)
      expect(after[changed[0]]).toBe(!wasChecked)

      await admin.reload()
      await expect(settings.eventCheckboxes.first()).toBeChecked({ checked: !wasChecked })
    } finally {
      await api.setEvents(before)
    }
  })
})
