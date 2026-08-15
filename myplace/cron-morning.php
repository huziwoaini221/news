<?php
// Personal Hub 定时触发器：每日晨报
// MyPlace Cron 配置：cron-morning.php 每日 08:00 运行一次
// 修改下方 $worker 与 $secret，然后上传到 MyPlace 免费 PHP 空间。
// Worker 端已做幂等（morning_reports.report_date UNIQUE），重复触发不会发两份晨报。

$worker = 'https://YOUR_WORKER_URL';
$secret = 'YOUR_API_SECRET';

function callWorker($worker, $secret, $endpoint)
{
    $ch = curl_init($worker . $endpoint);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $secret],
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $response = curl_exec($ch);
    $err      = curl_error($ch);
    curl_close($ch);
    return $err ? json_encode(['ok' => false, 'error' => $err]) : $response;
}

header('Content-Type: application/json; charset=utf-8');
echo callWorker($worker, $secret, '/api/morning-report');
