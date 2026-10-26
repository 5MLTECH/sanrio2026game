<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

no_store_headers('application/javascript; charset=utf-8');

$token = null;
$region = null;

try {
    $key = required_env('AZURE_SPEECH_KEY');
    $region = azure_region();
    $curl = curl_init(sprintf('https://%s.api.cognitive.microsoft.com/sts/v1.0/issueToken', $region));
    curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => '',
        CURLOPT_HTTPHEADER => ['Ocp-Apim-Subscription-Key: ' . $key],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 10,
    ]);
    $response = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    curl_close($curl);

    if (is_string($response) && $status === 200 && $response !== '') {
        $token = $response;
    }
} catch (Throwable $error) {
    error_log('Azure Speech token configuration failed: ' . $error->getMessage());
}

printf(
    "window.AZURE_SPEECH_TOKEN=%s;window.AZURE_SPEECH_REGION=%s;\n",
    json_encode($token, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT),
    json_encode($region, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT),
);
