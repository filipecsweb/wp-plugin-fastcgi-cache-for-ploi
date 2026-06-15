<?php

declare(strict_types=1);

namespace WPForge\Assets;

use RuntimeException;

/**
 * Thrown when a Vite build manifest or entry cannot be resolved.
 */
final class ViteException extends RuntimeException
{
}
