<?php

declare(strict_types=1);

namespace WPForge\Assets;

/**
 * Vendored Vite asset enqueuer (no external dependency).
 *
 * Two modes:
 *  - Dev: when a "hot" file exists in the build dir, assets are loaded from the
 *    running Vite dev server (with @vite/client for HMR).
 *  - Production: the build manifest is read and the hashed JS entry plus its CSS
 *    (including imported chunks' CSS) are enqueued. Scripts are tagged as ES
 *    modules via a script_loader_tag filter.
 */
final class Vite
{
    /** @var array<string, mixed>|null */
    private ?array $manifestCache = null;

    /** @var array<string, bool> */
    private array $moduleHandles = [];

    private bool $moduleFilterAdded = false;

    public function __construct(
        private readonly string $buildPath,
        private readonly string $buildUrl,
        private readonly string $devServer = 'http://localhost:5173',
    ) {
    }

    public function isDev(): bool
    {
        return is_file($this->hotFile());
    }

    /**
     * Enqueue a JS entry (e.g. "resources/js/admin.js").
     *
     * @param list<string> $deps
     */
    public function enqueueScript(string $entry, string $handle, array $deps = [], bool $inFooter = true): void
    {
        if ($this->isDev()) {
            $this->enqueueDev($entry, $handle, $deps, $inFooter);

            return;
        }

        $this->enqueueBuilt($entry, $handle, $deps, $inFooter);
    }

    /**
     * Enqueue a standalone CSS entry. In dev the JS client injects styles, so
     * this is a no-op there.
     */
    public function enqueueStyle(string $entry, string $handle): void
    {
        if ($this->isDev()) {
            return;
        }

        $manifest = $this->manifest();
        $chunk    = $manifest[$entry] ?? null;

        if (is_array($chunk) && isset($chunk['file']) && is_string($chunk['file'])) {
            wp_enqueue_style($handle, $this->buildUrl . '/' . $chunk['file'], [], null);
        }
    }

    /**
     * @param list<string> $deps
     */
    private function enqueueDev(string $entry, string $handle, array $deps, bool $inFooter): void
    {
        $origin = $this->devOrigin();

        $clientHandle = $handle . '-vite-client';
        $this->registerModuleHandle($clientHandle);
        wp_enqueue_script($clientHandle, $origin . '/@vite/client', [], null, $inFooter);

        $this->registerModuleHandle($handle);
        wp_enqueue_script($handle, $origin . '/' . ltrim($entry, '/'), $deps, null, $inFooter);
    }

    /**
     * @param list<string> $deps
     */
    private function enqueueBuilt(string $entry, string $handle, array $deps, bool $inFooter): void
    {
        $manifest = $this->manifest();

        if (! isset($manifest[$entry]) || ! is_array($manifest[$entry])) {
            throw new ViteException(sprintf('Vite entry "%s" was not found in the build manifest.', $entry));
        }

        /** @var array{file?: string} $chunk */
        $chunk = $manifest[$entry];

        if (! isset($chunk['file']) || ! is_string($chunk['file'])) {
            throw new ViteException(sprintf('Vite entry "%s" has no output file in the manifest.', $entry));
        }

        $styles = array_values(array_unique($this->collectStyles($entry, $manifest, [])));

        foreach ($styles as $style) {
            // Derive the style handle from the content-hashed filename so a CSS
            // chunk shared by multiple entries collapses to a single <link>
            // (WordPress dedupes styles by handle, not by URL).
            $styleHandle = 'wpforge-vite-' . sanitize_title(pathinfo($style, PATHINFO_FILENAME));
            wp_enqueue_style($styleHandle, $this->buildUrl . '/' . $style, [], null);
        }

        $this->registerModuleHandle($handle);
        wp_enqueue_script($handle, $this->buildUrl . '/' . $chunk['file'], $deps, null, $inFooter);
    }

    /**
     * Recursively gather the CSS files for an entry and its imported chunks.
     *
     * @param array<string, mixed> $manifest
     * @param list<string>         $seen
     *
     * @return list<string>
     */
    private function collectStyles(string $entry, array $manifest, array $seen): array
    {
        if (in_array($entry, $seen, true)) {
            return [];
        }

        $seen[] = $entry;
        $chunk  = $manifest[$entry] ?? null;

        if (! is_array($chunk)) {
            return [];
        }

        $styles = [];

        foreach ((array) ($chunk['css'] ?? []) as $css) {
            if (is_string($css)) {
                $styles[] = $css;
            }
        }

        foreach ((array) ($chunk['imports'] ?? []) as $import) {
            if (is_string($import)) {
                $styles = array_merge($styles, $this->collectStyles($import, $manifest, $seen));
            }
        }

        return $styles;
    }

    private function registerModuleHandle(string $handle): void
    {
        $this->moduleHandles[$handle] = true;

        if (! $this->moduleFilterAdded) {
            add_filter('script_loader_tag', [$this, 'filterModuleTag'], 10, 3);
            $this->moduleFilterAdded = true;
        }
    }

    public function filterModuleTag(string $tag, string $handle, string $src): string
    {
        unset($src); // The original $tag already carries the (escaped) src.

        if (! isset($this->moduleHandles[$handle])) {
            return $tag;
        }

        if (str_contains($tag, ' type="module"') || str_contains($tag, " type='module'")) {
            return $tag;
        }

        // Transform the existing tag instead of rebuilding it, so inline scripts
        // (wp_add_inline_script), translations, CSP nonces and defer/async
        // attributes that WordPress or other plugins attached are preserved.
        $tag = (string) preg_replace('/\s+type=("|\')(?:.*?)\1/', '', $tag);

        return (string) preg_replace('/<script\b/', '<script type="module"', $tag, 1);
    }

    /**
     * @return array<string, mixed>
     */
    private function manifest(): array
    {
        if ($this->manifestCache !== null) {
            return $this->manifestCache;
        }

        $candidates = [
            $this->buildPath . '/.vite/manifest.json',
            $this->buildPath . '/manifest.json',
        ];

        foreach ($candidates as $candidate) {
            if (! is_file($candidate)) {
                continue;
            }

            $json    = file_get_contents($candidate);
            $decoded = is_string($json) ? json_decode($json, true) : null;

            if (is_array($decoded)) {
                $manifest = [];

                foreach ($decoded as $key => $value) {
                    $manifest[(string) $key] = $value;
                }

                return $this->manifestCache = $manifest;
            }
        }

        throw new ViteException('Vite build manifest not found. Run "npm run build".');
    }

    private function devOrigin(): string
    {
        $contents = (string) file_get_contents($this->hotFile());
        $contents = trim($contents);

        return $contents !== '' ? rtrim($contents, '/') : rtrim($this->devServer, '/');
    }

    private function hotFile(): string
    {
        return $this->buildPath . '/hot';
    }
}
