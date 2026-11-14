<?php
declare(strict_types=1);
require_once __DIR__.'/server/common.php';
require_once __DIR__.'/server/clappr.php';

header('Cache-Control: no-store');
$channel = $_GET['canal'] ?? 'winplus';
$signal = is_string($channel) ? clappr_source($channel) : null;
$available = $signal !== null;
$source = $signal['url'] ?? null;
$expiry = $signal['expires_at'] ?? null;
if (($_GET['format'] ?? null) === 'json') {
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    http_response_code($available ? 200 : 410);
    echo json_encode($available ? ['url' => $source, 'expires_at' => $expiry] : ['error' => 'Señal no disponible']);
    exit;
}
if (!$available) {
    http_response_code(404);
}
?>
<!doctype html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Reproductor de El Ciro TV</title>
    <style>
        html,body,#videoSection,#reproductor{width:100%;height:100%;margin:0;background:#000;color:#fff}
        body{font:16px system-ui,sans-serif}
        #videoSection{position:relative;overflow:hidden}
        #signal-status{background:#202020;color:#fff;padding:10px;border:1px solid #777;border-radius:8px}
        #signal-status{position:absolute;bottom:52px;left:8px;margin:0}
    </style>
</head>
<body>
<?php if (!$available): ?>
    <p id="signal-status" role="status">Este canal no tiene una señal HLS directa configurada.</p>
    <script>
        if (parent !== window) parent.postMessage('elciro-clappr-unavailable', location.origin);
    </script>
<?php else: ?>
    <section id="videoSection">
        <div id="reproductor"></div>
        <p id="signal-status" role="status" hidden></p>
    </section>
    <script src="https://cdn.jsdelivr.net/npm/@clappr/player@0.8.0/dist/clappr.min.js"
            integrity="sha384-UUsQc5DCDR++qHLuZ9gQb8CJoHwSIEQfox+vSkgR0eK2mrF8oWOXZS0NpCiMtY4z"
            crossorigin="anonymous"></script>
    <script type="module">
        let source = <?= json_encode($source, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_THROW_ON_ERROR) ?>;
        const endpoint = new URL(location.href);
        endpoint.searchParams.set('format', 'json');
        const section = document.querySelector('#videoSection');
        const status = document.querySelector('#signal-status');
        let player, timer, renewal, pending, attempts = 0, playingSince = null;
        let paused = false, reloadRequested = false;

        function showStatus(message) {
            status.textContent = message;
            status.hidden = !message;
        }

        function fallback() {
            if (parent === window) return false;
            parent.postMessage('elciro-clappr-unavailable', location.origin);
            return true;
        }

        function scheduleRenewal(expiresAt) {
            clearTimeout(renewal);
            if (!expiresAt) return;
            const delay = Math.max(15000, expiresAt * 1000 - Date.now() - 90000);
            renewal = setTimeout(() => void refresh(false), Math.min(delay, 3600000));
        }

        async function refresh(recovering) {
            reloadRequested ||= recovering;
            if (pending) return;
            clearTimeout(renewal);
            pending = true;
            try {
                const response = await fetch(endpoint, {cache: 'no-store', signal: AbortSignal.timeout(8000)});
                if (response.status === 410) {
                    if (fallback()) return;
                    showStatus('Señal no disponible.');
                    return;
                }
                if (!response.ok) throw Error('Señal no disponible');
                const next = await response.json();
                scheduleRenewal(next.expires_at);
                if (reloadRequested || (next.url !== source && !paused)) {
                    source = next.url;
                    player.load(source, null, !paused);
                }
            } catch {
                if (reloadRequested) {
                    if (fallback()) return;
                    showStatus('La señal se interrumpió.');
                } else {
                    renewal = setTimeout(() => void refresh(false), 30000);
                }
            } finally {
                pending = false;
                reloadRequested = false;
            }
        }

        function handleClapprError() {
            if (fallback()) return;
            showStatus('La señal no se pudo reproducir.');
        }

        if (window.Clappr?.Player) {
            player = new Clappr.Player({
                source,
                parentId: '#reproductor',
                autoPlay: true,
                width: '100%',
                height: '100%',
                mediacontrol: {seekbar: '#00cfff', buttons: '#FFFFFF'},
            });
            player.on(Clappr.Events.PLAYER_ERROR, handleClapprError);
            player.on(Clappr.Events.PLAYBACK_ERROR, handleClapprError);
            player.on(Clappr.Events.PLAYER_PAUSE, () => { paused = true; });
            player.on(Clappr.Events.PLAYER_PLAY, () => { paused = false; });
            player.on(Clappr.Events.PLAYER_TIMEUPDATE, ({current} = {}) => {
                if (!Number.isFinite(current) || current <= 0) return;
                clearTimeout(timer);
                timer = null;
                playingSince ??= Date.now();
                if (Date.now() - playingSince >= 10000) attempts = 0;
                showStatus('');
            });
            scheduleRenewal(<?= json_encode($expiry) ?>);
        } else {
            fallback();
            showStatus('No se pudo cargar el reproductor.');
        }
    </script>
<?php endif; ?>
</body>
</html>
