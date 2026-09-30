/**
 * Whether a CSS selector can match only the mount element or what lies inside it,
 * read from its parsed form, so escapes, strings and :is()/:where() arguments can't
 * fool it. CONTRACT: the selector must start at the mount; one that reaches it later
 * (`body #mount .a`) is rejected, even where it stays inside.
 */
import parser from 'postcss-selector-parser'

const MOUNT = 'mount'
const INSIDE = 'inside'
const ANYWHERE = 'anywhere'

/** @param {string} selector @param {string} rootId the mount's id, without the # */
export function inMount(selector, rootId) {
  return parser()
    .astSync(selector)
    .nodes.every((complex) => scopeOf(complex, rootId) !== ANYWHERE)
}

// Only the first combinator can change the answer: what follows an element inside the
// mount, siblings included, stays inside, and what follows one outside can be anywhere.
function scopeOf(complex, rootId) {
  const at = complex.nodes.findIndex((node) => node.type === 'combinator')
  const scope = compoundScope(at === -1 ? complex.nodes : complex.nodes.slice(0, at), rootId)
  if (scope !== MOUNT || at === -1) return scope
  // A descendant or child of the mount is inside it; a sibling is not.
  return [' ', '>'].includes(complex.nodes[at].value.trim() || ' ') ? INSIDE : ANYWHERE
}

// A compound matches the intersection of its parts, so one part that pins it is enough.
function compoundScope(nodes, rootId) {
  let scope = ANYWHERE
  for (const node of nodes) {
    if (node.type === 'id' && node.value === rootId) return MOUNT
    if (node.type === 'pseudo' && [':is', ':where'].includes(node.value.toLowerCase())) {
      const scopes = node.nodes.map((complex) => scopeOf(complex, rootId))
      if (!scopes.includes(ANYWHERE)) scope = scopes.includes(MOUNT) ? MOUNT : INSIDE
    }
  }
  return scope
}
