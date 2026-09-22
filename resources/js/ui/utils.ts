/**
 * Class merging for the kit: `cn` taught the `tw` prefix and this theme's utility names.
 * WHY: unconfigured, a custom size such as `text-button` reads as a colour, so merging it
 * with `text-primary` silently drops one of the two.
 *
 * CONTRACT: each list mirrors the matching `--text-*`, `--shadow-*` or `--radius-*` entries
 * of the @theme block in resources/css/app.css (tests/js/ui/utils.test.ts checks it).
 *
 * @since 1.1.0
 */
import { createCn } from 'cn/config'

export const cn = createCn({
  prefix: 'tw',
  extend: {
    theme: {
      text: ['body', 'paragraph', 'cell', 'label', 'control', 'select', 'button', 'button-sm', 'tab', 'table-head', 'notice', 'tooltip', 'glyph', 'body-mobile', 'button-mobile', 'control-mobile', 'select-mobile', 'notice-mobile'],
      shadow: ['card', 'focus', 'focus-primary', 'focus-checkbox', 'rule-top', 'tooltip', 'dialog'],
      radius: ['control', 'row', 'badge', 'dialog'],
    },
  },
})
