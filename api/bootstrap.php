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

function no_store_headers(string $contentType): void
{
    header('Content-Type: ' . $contentType);
    header('Cache-Control: no-store, private');
    header('X-Content-Type-Options: nosniff');
}
