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
        #videoSection.player-expanded{position:fixed;top:var(--player-top,0);left:var(--player-left,0);width:var(--player-width,100%);height:var(--player-height,100%);z-index:2}
        #videoSection.player-landscape{width:var(--player-height,100dvh);height:var(--player-width,100vw);transform-origin:top left;transform:translateX(var(--player-width,100vw)) rotate(90deg)}
        #controls{position:absolute;z-index:1;top:8px;right:8px;display:flex;gap:8px}
        button,#signal-status{background:#202020;color:#fff;padding:10px;border:1px solid #777;border-radius:8px}
        #signal-status{position:absolute;bottom:52px;left:8px;margin:0}
    </style>
</head>
<body>
<?php if (!$available): ?>
    <p id="signal-status" role="status">Este canal no tiene una señal HLS vigente.</p>
    <script>if (parent !== window) parent.postMessage('elciro-clappr-unavailable', location.origin);</script>
<?php else: ?>
    <section id="videoSection">
        <div id="reproductor"></div>
        <div id="controls">
            <button id="retry" type="button" hidden>Recargar señal</button>
            <button id="fullscreen" type="button">Pantalla completa</button>
        </div>
        <p id="signal-status" role="status" hidden></p>
    </section>
    <script src="https://cdn.jsdelivr.net/npm/@clappr/player@0.8.0/dist/clappr.min.js"
            integrity="sha384-UUsQc5DCDR++qHLuZ9gQb8CJoHwSIEQfox+vSkgR0eK2mrF8oWOXZS0NpCiMtY4z"
            crossorigin="anonymous"></script>
    <script type="module">
        import {createPlayerFullscreen} from '/fullscreen.js?v=20261114c';

        let source = <?= json_encode($source, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_THROW_ON_ERROR) ?>;
        const endpoint = new URL(location.href);
        endpoint.searchParams.set('format', 'json');
        const section = document.querySelector('#videoSection');
        const fullscreen = document.querySelector('#fullscreen');
        const status = document.querySelector('#signal-status');
        const retry = document.querySelector('#retry');
        let player, timer, renewal, pending, attempts = 0, playingSince = null;
        let paused = false, reloadRequested = false;

        function showStatus(message) {
            status.textContent = message;
            status.hidden = !message;
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
                if (response.status === 410 && fallback()) return;
                if (!response.ok) throw Error('Señal no disponible');
                const next = await response.json();
                scheduleRenewal(next.expires_at);
                if (reloadRequested || (next.url !== source && !paused)) {
                    source = next.url;
                    player.load(source, null, !paused);
                }
            } catch {
                if (reloadRequested) recover();
                else renewal = setTimeout(() => void refresh(false), 30000);
            } finally {
                pending = false;
                reloadRequested = false;
            }
        }

        function fallback() {
            if (parent === window) return false;
            parent.postMessage('elciro-clappr-unavailable', location.origin);
            return true;
        }

        function recover() {
            if (timer) return;
            playingSince = null;
            retry.hidden = false;
            if (attempts >= 2) {
                if (fallback()) return;
                showStatus('La señal se interrumpió. Pulsa Recargar señal para volver a intentarlo.');
                return;
            }
            attempts++;
            showStatus('Recuperando señal…');
            timer = setTimeout(() => {
                timer = null;
                void refresh(true);
            }, 1500 * attempts);
        }

        if (window.Clappr?.Player) {
            player = new Clappr.Player({
                source, parentId: '#reproductor', autoPlay: true, width: '100%', height: '100%',
            });
            player.on(Clappr.Events.PLAYER_ERROR, recover);
            player.on(Clappr.Events.PLAYER_PAUSE, () => { paused = true; });
            player.on(Clappr.Events.PLAYER_PLAY, () => { paused = false; });
            player.on(Clappr.Events.PLAYER_TIMEUPDATE, ({current} = {}) => {
                if (!Number.isFinite(current) || current <= 0) return;
                clearTimeout(timer);
                timer = null;
                playingSince ??= Date.now();
                if (Date.now() - playingSince >= 10000) attempts = 0;
                retry.hidden = true;
                showStatus('');
            });
            retry.onclick = () => {
                clearTimeout(timer);
                timer = null;
                attempts = 0;
                showStatus('Cargando señal…');
                paused = false;
                void refresh(true);
            };
            createPlayerFullscreen({section, button: fullscreen});
            scheduleRenewal(<?= json_encode($expiry) ?>);
        } else {
            fullscreen.hidden = true;
            fallback();
            showStatus('No se pudo cargar el reproductor. Vuelve a abrir este canal.');
        }
    </script>
<?php endif; ?>
</body>
</html>
