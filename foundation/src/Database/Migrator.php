<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Foundation\Database;

final class Migrator
{
    public function __construct(private readonly string $versionsOption)
    {
    }

    /**
     * @param iterable<Migration> $migrations
     */
    public function migrate(iterable $migrations): void
    {
        $applied = $this->applied();

        foreach ($migrations as $migration) {
            $version = $migration->version();

            if (in_array($version, $applied, true)) {
                continue;
            }

            $migration->up();
            $applied[] = $version;
        }

        update_option($this->versionsOption, array_values(array_unique($applied)), false);
    }

    /**
     * @param iterable<Migration> $migrations
     */
    public function rollback(iterable $migrations): void
    {
        $applied = $this->applied();

        foreach ($migrations as $migration) {
            $version = $migration->version();

            if (! in_array($version, $applied, true)) {
                continue;
            }

            $migration->down();
            $applied = array_values(array_diff($applied, [$version]));
        }

        update_option($this->versionsOption, $applied, false);
    }

    public function hasRun(string $version): bool
    {
        return in_array($version, $this->applied(), true);
    }

    /**
     * @return list<string>
     */
    private function applied(): array
    {
        $stored = get_option($this->versionsOption, []);

        if (! is_array($stored)) {
            return [];
        }

        $versions = [];

        foreach ($stored as $value) {
            if (is_scalar($value) && (string) $value !== '') {
                $versions[] = (string) $value;
            }
        }

        return array_values(array_unique($versions));
    }
}
