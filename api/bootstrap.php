<?php

declare(strict_types=1);

function required_env(string $name): string
{
    $value = getenv($name);
    if ($value === false || trim($value) === '') {
        throw new RuntimeException(sprintf('Required environment variable %s is not configured.', $name));
    }

    return trim($value);
}

function azure_region(): string
{
    $region = getenv('AZURE_SPEECH_REGION');
    $region = $region === false || trim($region) === '' ? 'eastasia' : trim($region);

    if (!preg_match('/^[a-z0-9-]+$/', $region)) {
        throw new RuntimeException('AZURE_SPEECH_REGION is invalid.');
    }

    return $region;
}

function app_url(): string
{
    $url = rtrim(required_env('APP_URL'), '/');
    $parts = parse_url($url);
    if (
        filter_var($url, FILTER_VALIDATE_URL) === false
        || !isset($parts['scheme'], $parts['host'])
        || !in_array(strtolower($parts['scheme']), ['http', 'https'], true)
    ) {
        throw new RuntimeException('APP_URL must be an absolute HTTP or HTTPS URL.');
    }

    return $url;
}

function no_store_headers(string $contentType): void
{
    header('Content-Type: ' . $contentType);
    header('Cache-Control: no-store, private');
    header('X-Content-Type-Options: nosniff');
}
