<?php

declare(strict_types=1);

namespace FastCgiCacheForPloi\Rest;

use FastCgiCacheForPloi\Log\FlushLogEntry;
use FastCgiCacheForPloi\Log\FlushLogRepository;
use FastCgiCacheForPloi\Providers\RestServiceProvider;
use WPForge\Security\Capability;
use WP_REST_Request;
use WP_REST_Response;

final class LogController extends PloiRestController
{
    public function __construct(
        string $namespace,
        Capability $capability,
        private readonly FlushLogRepository $log,
    ) {
        parent::__construct($namespace, $capability);
    }

    public function registerRoutes(): void
    {
        $this->registerRoute('/log', [
            'methods'             => 'GET',
            'callback'            => [$this, 'index'],
            'permission_callback' => $this->guard(RestServiceProvider::CAPABILITY),
        ]);
    }

    public function index(WP_REST_Request $request): WP_REST_Response
    {
        $entries = array_map(
            static fn (FlushLogEntry $entry): array => $entry->toArray(),
            $this->log->recent(FlushLogRepository::RECENT_LIMIT)
        );

        return $this->respond(['entries' => $entries]);
    }
}
