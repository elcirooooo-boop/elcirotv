<?php
$html = file_get_contents("https://tvf90.com/5.php?stream=espn", false, stream_context_create([
    'http' => [
        'header' => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)\r\nReferer: https://tvf90.com/\r\n"
    ]
]));
if (preg_match('/https?:\/\/[^\s"\'<>]+\.m3u8\?[^\s"\'<>]+/', $html, $m)) {
    $url = $m[0];
    echo "Found URL: " . $url . "\n";
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ["User-Agent: Mozilla/5.0", "Referer: https://tvf90.com/", "Origin: https://tvf90.com"]);
    $body = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    echo "Status: " . $status . "\n";
    echo "Body preview: " . substr($body, 0, 200) . "\n";
} else {
    echo "No m3u8 found in HTML\n";
}
