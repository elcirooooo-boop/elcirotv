/**
 * Cloudflare Worker: El Ciro TV - Stream Proxy
 * Extrae y retransmite flujos HLS (.m3u8) limpios con soporte CORS y HTTPS
 * sin consumir recursos de CPU ni ancho de banda en Hostinger.
 */

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Referer': 'https://tvf90.com/',
  'Origin': 'https://tvf90.com',
  'Accept': '*/*',
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = url.origin;

    // Manejar peticiones CORS preflight (OPTIONS)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    };

    // RUTA 1: Proxy para trozos de vídeo (.ts)
    if (url.pathname === '/proxy') {
      const targetUrl = url.searchParams.get('url');
      if (!targetUrl) {
        return new Response('Falta parámetro URL', { status: 400, headers: corsHeaders });
      }

      try {
        const upstream = await fetch(targetUrl, {
          headers: HEADERS,
          redirect: 'follow',
        });

        const headers = new Headers(upstream.headers);
        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        headers.set('Cache-Control', 'public, max-age=60');

        return new Response(upstream.body, {
          status: upstream.status,
          headers,
        });
      } catch (err) {
        return new Response('Error en proxy de vídeo: ' + err.message, { status: 502, headers: corsHeaders });
      }
    }

    // RUTA 2: Manifiesto HLS principal del canal (/stream.m3u8?channel=espn)
    const channel = url.searchParams.get('channel') || url.searchParams.get('canal') || url.searchParams.get('stream') || 'espn';
    const cleanChannel = channel.toLowerCase().trim();

    try {
      // 1. Obtener la página del reproductor para extraer el .m3u8 fresco con token
      const pageRes = await fetch(`https://tvf90.com/5.php?stream=${encodeURIComponent(cleanChannel)}`, {
        headers: HEADERS,
        redirect: 'follow',
      });

      if (!pageRes.ok) {
        return new Response(`Canal no disponible en el proveedor (status: ${pageRes.status})`, { status: 404, headers: corsHeaders });
      }

      const html = await pageRes.text();
      const match = html.match(/https?:\/\/[^\s"'<>]+\.m3u8(?:\?[^\s"'<>]*)?/i);
      if (!match) {
        return new Response('No se encontró señal activa para: ' + cleanChannel, { status: 404, headers: corsHeaders });
      }

      // Limpiar puerto :443 si viene en la URL
      let m3u8Url = match[0].replace(':443', '');
      const baseM3u8Url = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);

      // 2. Descargar la lista de reproducción .m3u8
      const playlistRes = await fetch(m3u8Url, {
        headers: HEADERS,
        redirect: 'follow',
      });

      if (!playlistRes.ok) {
        const errorText = await playlistRes.text().catch(() => '');
        return new Response(`Error al cargar lista HLS (status: ${playlistRes.status}): ${errorText} [URL: ${m3u8Url}]`, {
          status: 502,
          headers: corsHeaders,
        });
      }

      const playlistText = await playlistRes.text();

      // 3. Reescribir los fragmentos para que pasen por /proxy
      const rewritten = playlistText.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return line;

        let absoluteUrl = trimmed;
        if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
          absoluteUrl = new URL(trimmed, baseM3u8Url).href;
        }

        return `${origin}/proxy?url=${encodeURIComponent(absoluteUrl)}`;
      }).join('\n');

      return new Response(rewritten, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    } catch (err) {
      return new Response('Error en Worker: ' + err.message, { status: 500, headers: corsHeaders });
    }
  },
};
