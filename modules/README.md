# WPForge Modules

Modules are **opt-in units** that extend the pure Foundation kernel. They live
here, _outside_ `foundation/`, so that copying `foundation/` alone yields a clean
kernel with **zero modules attached**. Each module is independently copyable: take
the module folder you want, add its PSR-4 root to `composer.json`, and register it.

## The contract

Every module implements [`WPForge\Contracts\ModuleInterface`](../foundation/src/Contracts/ModuleInterface.php):

```php
interface ModuleInterface
{
    public function name(): string;                 // unique slug, e.g. "admin-ui"
    public function providers(): array;             // list<class-string<ServiceProviderInterface>>
    public function isEnabled(Container $c): bool;   // load only when relevant (e.g. is_admin())
}
```

A module contributes one or more **service providers** to the kernel. The kernel
runs each provider's `register()` (bind services) then `boot()` (attach hooks),
exactly like first-party providers.

## PSR-4 convention

```jsonc
// composer.json
"autoload": {
  "psr-4": {
    "WPForge\\Module\\AdminUi\\": "modules/admin-ui/src/"
    // "WPForge\\Module\\Blocks\\": "modules/blocks/src/"  ← when you add it
  }
}
```

## Implemented in this build

| Module     | Path                 | Namespace                  | Status |
|------------|----------------------|----------------------------|--------|
| `admin-ui` | `modules/admin-ui/`  | `WPForge\Module\AdminUi\`  | ✅ Built in Phase 3 |

> **admin-ui targets Tailwind CSS v4.** Admin styling is scoped to the plugin's
> own screen using the v4 **CSS-first** pattern: import only `theme.css` +
> `utilities.css` with `@import "tailwindcss" prefix(tw)`, and **do not** import
> `preflight.css`. Isolation from `wp-admin` relies on CSS **cascade-layer
> ordering** plus the `tw:` variant-prefix on every utility (e.g. `tw:flex`).
> The module uses the `@tailwindcss/vite` plugin — no `postcss.config.js`,
> `tailwind.config.js`, `autoprefixer`, or `postcss` are required under v4.
>
> **Cascade-layer caveat.** Because Tailwind's utilities live in `@layer
> utilities`, they intentionally LOSE to wp-admin's *unlayered* styles — that is
> exactly what keeps wp-admin untouched. The flip side: a `tw:` utility that
> targets a property wp-admin already sets on the same element (e.g. `width` on
> `.regular-text`, `margin` on a checkbox) becomes a no-op. Use the v4 important
> variant (`tw:w-full!`) on those specific controls to win the cascade locally.
> Utilities on your own elements (divs, sections, spans — which wp-admin never
> styles) always apply and need no `!`.

## Planned extension points (NOT implemented)

Each would live as `modules/<name>/src/` under `WPForge\Module\<Name>\` and
implement `ModuleInterface`. They are documented here as the seams where future
work plugs in — there is no stub code for them, only this contract.

| Module          | Purpose                                                        |
|-----------------|---------------------------------------------------------------|
| `blocks`        | `@wordpress/scripts` + React + `block.json` editor blocks.     |
| `interactivity` | WordPress Interactivity API for frontend reactivity.           |
| `cpt-tax`       | Custom post type / taxonomy registration helpers.              |
| `woocommerce`   | HPOS-compatible WooCommerce extension scaffold.                |
| `jobs`          | Action Scheduler integration for background jobs.              |
| `rest-api`      | Expanded REST controllers + authentication beyond the base.    |
