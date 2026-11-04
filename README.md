# El Ciro TV

Sitio web preparado para Netlify: agenda → partido → canales disponibles → reproductor.

Consulta [la guía de instalación](netlify-site/LEEME-NETLIFY.md).

Netlify detecta `netlify.toml`: base `netlify-site`, comando `npm run build`, publicación `dist`. Configura `HLS_PROXY_SECRET` y `ADMIN_PASSWORD` en las variables de Functions antes de publicar.
