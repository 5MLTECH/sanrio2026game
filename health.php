<?php

declare(strict_types=1);

require __DIR__ . '/api/bootstrap.php';
app_url();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
echo json_encode(['status' => 'ok']);
