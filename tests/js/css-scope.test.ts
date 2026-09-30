import { describe, expect, it } from 'vitest'
import { inMount } from '../../bin/css-scope.mjs'

const ROOT = 'fastcgi-cache-for-ploi-app'

describe('inMount', () => {
  it.each([
    '#fastcgi-cache-for-ploi-app',
    '#fastcgi-cache-for-ploi-app[dir=rtl]',
    '#fastcgi-cache-for-ploi-app .tw\\:flex',
    '#fastcgi-cache-for-ploi-app > .tw\\:flex',
    '#fastcgi-cache-for-ploi-app .a + .b',
    '#fastcgi-cache-for-ploi-app .a ~ .b',
    '#fastcgi-cache-for-ploi-app ::placeholder',
    '#fastcgi-cache-for-ploi-app :where(:not(svg, svg *))::before',
    ':is(#fastcgi-cache-for-ploi-app .tw\\:group\\/dismiss *)',
    ':where(#fastcgi-cache-for-ploi-app .a, #fastcgi-cache-for-ploi-app .b) ~ .c',
  ])('keeps %s', (selector) => {
    expect(inMount(selector, ROOT)).toBe(true)
  })

  it.each([
    '#fastcgi-cache-for-ploi-app ~ *',
    '#fastcgi-cache-for-ploi-app + #wpfooter',
    '#fastcgi-cache-for-ploi-app-foo',
    ':where(#fastcgi-cache-for-ploi-app, body)',
    ':is(#fastcgi-cache-for-ploi-app) ~ .a',
    'div:not(#fastcgi-cache-for-ploi-app)',
    'body #fastcgi-cache-for-ploi-app .a',
    '.wrap',
  ])('rejects %s', (selector) => {
    expect(inMount(selector, ROOT)).toBe(false)
  })
})
