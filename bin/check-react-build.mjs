#!/usr/bin/env node
/**
 * Checks the BUILT React bundles (run `vite build` first; `npm run check:build` does both):
 *
 *  1. No React copy. React, ReactDOM and the JSX runtime must come from the globals
 *     core ships (vite.config.js wpExternals()); a second copy breaks hooks and
 *     bloats the bundle.
 *  2. CSS scope. Every selector must match only the mount and what lies inside it
 *     (css-scope.mjs), or only set Tailwind's own `--tw-*` properties, so the stylesheet
 *     can't restyle wp-admin, set its variables, or let another plugin's `tw` utilities
 *     outrank ours. Keyframe names are global, so they must carry the plugin slug.
 *     @property registrations are global by nature and allowed; @font-face is not.
 */
import fs from 'node:fs'
import path from 'node:path'
import postcss from 'postcss'
import { inMount } from './css-scope.mjs'

const BUILD_DIR = 'public/build'
const SLUG = 'fastcgi-cache-for-ploi'
// CONTRACT: the id is SettingsPage::APP_ROOT_ID.
const ROOT_ID = `${SLUG}-app`
const REACT_INTERNALS = ['__SECRET_INTERNALS_DO_NOT_USE', 'react.production', 'ReactCurrentDispatcher', 'scheduler', '"18.3.1"']

const manifest = JSON.parse(fs.readFileSync(path.join(BUILD_DIR, '.vite/manifest.json'), 'utf8'))
const entries = Object.keys(manifest).filter((key) => manifest[key].isEntry)
const failures = []

function files(key, seen = new Set()) {
  if (seen.has(key)) return []
  seen.add(key)
  const chunk = manifest[key]
  if (!chunk) throw new Error(`"${key}" is not in the build manifest. Run "npm run build".`)
  return [chunk.file, ...(chunk.css ?? []), ...(chunk.imports ?? []).flatMap((imported) => files(imported, seen))]
}

for (const file of new Set(entries.flatMap((entry) => files(entry)))) {
  const source = fs.readFileSync(path.join(BUILD_DIR, file), 'utf8')

  if (file.endsWith('.js')) {
    for (const needle of REACT_INTERNALS) {
      if (source.includes(needle)) failures.push(`${file}: bundles a React copy (found ${needle})`)
    }
  }

  if (file.endsWith('.css')) {
    const css = postcss.parse(source)
    css.walkAtRules('font-face', () => failures.push(`${file}: global @font-face`))
    css.walkAtRules(/keyframes$/, (rule) => {
      if (!rule.params.startsWith(`${SLUG}-`)) failures.push(`${file}: @keyframes ${rule.params} lacks the ${SLUG}- prefix`)
    })
    css.walkRules((rule) => {
      if (rule.parent?.type === 'atrule' && rule.parent.name.endsWith('keyframes')) return
      if (rule.nodes.every((node) => node.type !== 'decl' || node.prop.startsWith('--tw-'))) return
      for (const selector of rule.selectors) {
        if (!inMount(selector, ROOT_ID)) failures.push(`${file}: selector outside #${ROOT_ID}: ${selector}`)
      }
    })
  }
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log(`OK: no React copy, no CSS outside #${ROOT_ID} (${entries.join(', ')}).`)
