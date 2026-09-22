import { describe, expect, it } from 'vitest'
import { cn } from '@/ui/utils'
import css from '../../../resources/css/app.css?raw'

// The @theme block in app.css names every utility the kit adds; the merger must file each one in its group.
const start = css.indexOf('@theme inline {')
const theme = css.slice(start, css.indexOf('\n}', start))
const names = (namespace: string) =>
  [...theme.matchAll(new RegExp(`^\\s*--${namespace}-([a-z0-9-]+):`, 'gm'))].map((m) => m[1]).filter((name) => !name.includes('--'))

const sizes = names('text')
const colors = names('color')

describe('cn', () => {
  it('reads the theme', () => {
    expect(sizes).toContain('button')
    expect(colors).toContain('primary')
  })

  it('has no font size named like a colour, which Tailwind would resolve as the colour', () => {
    expect(sizes.filter((size) => colors.includes(size))).toEqual([])
  })

  it.each(sizes)('files text-%s as a font size', (size) => {
    expect(cn('tw:text-foreground', `tw:text-${size}`)).toBe(`tw:text-foreground tw:text-${size}`)
    expect(cn('tw:text-[1px]', `tw:text-${size}`)).toBe(`tw:text-${size}`)
  })

  it.each(names('shadow'))('files shadow-%s as a shadow', (shadow) => {
    expect(cn('tw:shadow-none', `tw:shadow-${shadow}`)).toBe(`tw:shadow-${shadow}`)
  })

  it.each(names('radius'))('files rounded-%s as a radius', (radius) => {
    expect(cn('tw:rounded-none', `tw:rounded-${radius}`)).toBe(`tw:rounded-${radius}`)
  })
})
