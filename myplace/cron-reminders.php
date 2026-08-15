<?php
// Personal Hub 定时触发器：到期提醒
// MyPlace Cron 配置：cron-reminders.php 每 5 分钟运行一次
// 修改下方 $worker 与 $secret，然后上传到 MyPlace 免费 PHP 空间。

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
echo callWorker($worker, $secret, '/api/check-reminders');
