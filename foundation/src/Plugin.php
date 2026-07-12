<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Foundation;

use FastCgiCacheForPloi\Foundation\Assets\Vite;
use FastCgiCacheForPloi\Foundation\Container\Container;
use FastCgiCacheForPloi\Foundation\Contracts\ModuleInterface;
use FastCgiCacheForPloi\Foundation\Contracts\ServiceProviderInterface;
use FastCgiCacheForPloi\Foundation\Hooks\HookRegistrar;
use FastCgiCacheForPloi\Foundation\Http\HttpClient;
use FastCgiCacheForPloi\Foundation\I18n\TextDomain;
use FastCgiCacheForPloi\Foundation\Lifecycle\Lifecycle;
use FastCgiCacheForPloi\Foundation\Logging\Logger;
use FastCgiCacheForPloi\Foundation\Logging\LoggerInterface;
use FastCgiCacheForPloi\Foundation\Security\Capability;
use FastCgiCacheForPloi\Foundation\Security\Crypto;
use FastCgiCacheForPloi\Foundation\Security\Escaper;
use FastCgiCacheForPloi\Foundation\Security\Nonce;
use FastCgiCacheForPloi\Foundation\Security\Sanitizer;

/**
 * Plugin metadata is read from the plugin header at runtime, never hardcoded.
 *
 * @since 1.0.0
 */
final class Plugin
{
    /**
     * @since 1.0.0
     */
    private Container $container;

    /**
     * @since 1.0.0
     *
     * @var list<class-string<ServiceProviderInterface>>
     */
    private array $providers = [];

    /**
     * @since 1.0.0
     *
     * @var list<ModuleInterface>
     */
    private array $modules = [];

    /**
     * @since 1.0.0
     */
    private bool $booted = false;

    /**
     * @since 1.0.0
     *
     * @var array<string, string>|null
     */
    private ?array $headers = null;

    /**
     * @since 1.0.0
     */
    public function __construct(private readonly string $file)
    {
        $this->container = new Container();
        $this->container->instance(Container::class, $this->container);
        $this->container->instance(self::class, $this);

        // Bound here (not in registerFoundation) so activation/deactivation can
        // be wired at include time, before the plugins_loaded-deferred boot().
        $this->container->singleton(Lifecycle::class, fn (): Lifecycle => new Lifecycle($this->file));
    }

    /**
     * @since 1.0.0
     */
    public static function create(string $file): self
    {
        return new self($file);
    }

    /**
     * @since 1.0.0
     */
    public function container(): Container
    {
        return $this->container;
    }

    /**
     * @since 1.0.0
     */
    public function file(): string
    {
        return $this->file;
    }

    /**
     * @since 1.0.0
     */
    public function dir(): string
    {
        return plugin_dir_path($this->file);
    }

    /**
     * @since 1.0.0
     */
    public function url(): string
    {
        return plugin_dir_url($this->file);
    }

    /**
     * @since 1.0.0
     */
    public function basename(): string
    {
        return plugin_basename($this->file);
    }

    /**
     * @since 1.0.0
     */
    public function version(): string
    {
        return $this->header('Version', '0.0.0');
    }

    /**
     * @since 1.0.0
     */
    public function name(): string
    {
        return $this->header('Name', 'Plugin');
    }

    /**
     * @since 1.0.0
     */
    public function textDomain(): string
    {
        $domain = $this->header('TextDomain');

        return $domain !== '' ? $domain : sanitize_key(basename($this->file, '.php'));
    }

    /**
     * @since 1.0.0
     */
    public function optionPrefix(): string
    {
        return str_replace('-', '_', $this->textDomain());
    }

    /**
     * @since 1.0.0
     */
    public function header(string $key, string $default = ''): string
    {
        if ($this->headers === null) {
            $data    = get_file_data($this->file, [
                'Name'        => 'Plugin Name',
                'Version'     => 'Version',
                'TextDomain'  => 'Text Domain',
                'DomainPath'  => 'Domain Path',
                'RequiresPHP' => 'Requires PHP',
                'RequiresWP'  => 'Requires at least',
            ]);
            $headers = [];

            foreach ($data as $name => $value) {
                $headers[(string) $name] = is_string($value) ? $value : '';
            }

            $this->headers = $headers;
        }

        $value = $this->headers[$key] ?? '';

        return $value !== '' ? $value : $default;
    }

    /**
     * @since 1.0.0
     */
    public function lifecycle(): Lifecycle
    {
        return $this->container->make(Lifecycle::class);
    }

    /**
     * Wire activation/deactivation hooks synchronously, at plugin-include time.
     *
     * This MUST run before the plugins_loaded-deferred boot(): WordPress fires
     * activation hooks on the activation request WITHOUT re-running
     * plugins_loaded, so wiring them inside a provider's boot() would never run
     * on that request.
     *
     * @since 1.0.0
     *
     * @param callable(Lifecycle): void $register
     */
    public function withLifecycle(callable $register): self
    {
        $register($this->lifecycle());

        return $this;
    }

    /**
     * @since 1.0.0
     *
     * @param list<class-string<ServiceProviderInterface>> $providers
     */
    public function withProviders(array $providers): self
    {
        $this->providers = array_values(array_merge($this->providers, $providers));

        return $this;
    }

    /**
     * Module providers are merged in at boot() only if isEnabled() is true for
     * this request.
     *
     * @since 1.0.0
     */
    public function withModule(ModuleInterface $module): self
    {
        $this->modules[] = $module;

        return $this;
    }

    /**
     * @since 1.0.0
     *
     * @param list<ModuleInterface> $modules
     */
    public function withModules(array $modules): self
    {
        foreach ($modules as $module) {
            $this->modules[] = $module;
        }

        return $this;
    }

    /**
     * Run the two-phase provider lifecycle: register() everything first so all
     * bindings exist, then boot() everything.
     *
     * @since 1.0.0
     */
    public function boot(): void
    {
        if ($this->booted) {
            return;
        }

        $this->registerFoundation();

        foreach ($this->modules as $module) {
            if ($module->isEnabled($this->container)) {
                $this->providers = array_values(array_merge($this->providers, $module->providers()));
            }
        }

        $instances = [];

        foreach ($this->providers as $providerClass) {
            $provider = new $providerClass($this->container);
            $provider->register();
            $instances[] = $provider;
        }

        foreach ($instances as $provider) {
            $provider->boot();
        }

        // Translations must load no earlier than init. Guard did_action() so a
        // late boot() (after init already fired) still loads the text domain.
        $loadTextDomain = function (): void {
            $this->container->make(TextDomain::class)->load();
        };

        if (did_action('init')) {
            $loadTextDomain();
        } else {
            add_action('init', $loadTextDomain);
        }

        $this->booted = true;
    }

    /**
     * Plugin-specific primitives (Options, Migrator, SettingsRepository) live in
     * plugin providers because they need plugin-specific names.
     *
     * @since 1.0.0
     */
    private function registerFoundation(): void
    {
        $container = $this->container;

        // Version in the cache key invalidates the compiled hook map on deploy.
        $container->singleton(HookRegistrar::class, fn (): HookRegistrar => new HookRegistrar(
            $this->optionPrefix() . '_hooks',
            $this->version()
        ));
        $container->singleton(Nonce::class, static fn (): Nonce => new Nonce());
        $container->singleton(Capability::class, static fn (): Capability => new Capability());
        $container->singleton(Sanitizer::class, static fn (): Sanitizer => new Sanitizer());
        $container->singleton(Escaper::class, static fn (): Escaper => new Escaper());
        $container->singleton(Crypto::class, static fn (): Crypto => new Crypto());
        $container->singleton(HttpClient::class, static fn (): HttpClient => new HttpClient());

        $container->singleton(
            LoggerInterface::class,
            fn (): LoggerInterface => new Logger($this->textDomain())
        );

        $container->singleton(Vite::class, fn (): Vite => new Vite(
            rtrim($this->dir(), '/') . '/public/build',
            rtrim($this->url(), '/') . '/public/build',
            $this->version(),
            sanitize_title($this->textDomain()),
        ));

        $container->singleton(TextDomain::class, fn (): TextDomain => new TextDomain(
            $this->textDomain(),
            dirname($this->basename()) . '/' . trim($this->header('DomainPath', '/languages'), '/'),
        ));
    }
}
