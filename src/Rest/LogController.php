<?php

declare(strict_types=1);

namespace Ploi\FastCgiCache\Rest;

use Ploi\FastCgiCache\Log\FlushLogEntry;
use Ploi\FastCgiCache\Log\FlushLogRepository;
use WPForge\Rest\RestController;
use WPForge\Security\Capability;
use WP_REST_Request;
use WP_REST_Response;

/**
 * GET /log — the most recent flush-log entries for the "Recent flushes" table.
 */
final class LogController extends RestController
{
    private const LIMIT = 20;

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
            'permission_callback' => $this->guard('manage_options'),
        ]);
    }

    public function index(WP_REST_Request $request): WP_REST_Response
    {
        $entries = array_map(
            static fn (FlushLogEntry $entry): array => $entry->toArray(),
            $this->log->recent(self::LIMIT)
        );

        return $this->respond(['entries' => $entries]);
    }
}
