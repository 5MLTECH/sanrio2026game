<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

no_store_headers('application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Allow: POST');
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

try {
    $key = required_env('AZURE_SPEECH_KEY');
    $region = azure_region();
    $language = $_GET['language'] ?? 'en-US';
    if (!is_string($language) || !preg_match('/^[a-z]{2,3}-[A-Z]{2}$/', $language)) {
        throw new InvalidArgumentException('Invalid language.');
    }

    $referenceText = rawurldecode($_SERVER['HTTP_X_REFERENCE_TEXT'] ?? '');
    if ($referenceText === '' || strlen($referenceText) > 200) {
        throw new InvalidArgumentException('Invalid reference text.');
    }

    $contentType = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? 'application/octet-stream')[0]));
    $allowedTypes = ['audio/wav', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/aac'];
    if (!in_array($contentType, $allowedTypes, true)) {
        throw new InvalidArgumentException('Unsupported audio type.');
    }

    $contentLength = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($contentLength < 1 || $contentLength > 12 * 1024 * 1024) {
        throw new InvalidArgumentException('Invalid audio payload size.');
    }

    $audio = file_get_contents('php://input');
    if ($audio === false || $audio === '') {
        throw new InvalidArgumentException('Audio payload is required.');
    }

    $assessment = base64_encode(json_encode([
        'ReferenceText' => $referenceText,
        'GradingSystem' => 'HundredMark',
        'Granularity' => 'Phoneme',
        'EnableMiscue' => true,
    ], JSON_THROW_ON_ERROR));
    $url = sprintf(
        'https://%s.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=%s&format=detailed',
        $region,
        rawurlencode($language),
    );
    $curl = curl_init($url);
    curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $audio,
        CURLOPT_HTTPHEADER => [
            'Ocp-Apim-Subscription-Key: ' . $key,
            'Content-Type: ' . ($_SERVER['CONTENT_TYPE'] ?? $contentType),
            'Pronunciation-Assessment: ' . $assessment,
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 25,
    ]);
    $response = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $curlError = curl_error($curl);
    curl_close($curl);

    if (!is_string($response)) {
        throw new RuntimeException('Speech service request failed: ' . $curlError);
    }

    http_response_code($status >= 100 ? $status : 502);
    echo $response;
} catch (InvalidArgumentException $error) {
    http_response_code(400);
    echo json_encode(['error' => $error->getMessage()]);
} catch (Throwable $error) {
    error_log('Azure pronunciation proxy failed: ' . $error->getMessage());
    http_response_code(503);
    echo json_encode(['error' => 'Speech service is unavailable.']);
}
