<?php
// Personal Hub 定时触发器：到期提醒（每 5 分钟）
$worker = 'https://personal-hub.qihangmedical.workers.dev';
$secret = 'ks-19554d80674d890ed3dcaece7994da15';

function callWorker($worker, $secret, $endpoint)
{
    $ch = curl_init($worker . $endpoint);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $secret],
        CURLOPT_TIMEOUT        => 20,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $response = curl_exec($ch);
    $err      = curl_error($ch);
    $http     = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [$err ? 'curl_error:' . $err : 'http:' . $http, $err ? '' : $response];
}

header('Content-Type: application/json; charset=utf-8');
list($info, $body) = callWorker($worker, $secret, '/api/check-reminders');
@file_put_contents(__DIR__ . '/cron.log', date('c') . ' ' . basename(__FILE__) . ' ' . $info . ' ' . substr($body, 0, 120) . "\n", FILE_APPEND);
echo $body ?: $info;
