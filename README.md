# El Ciro TV

Sitio web preparado para Netlify: agenda → partido → canales disponibles → reproductor.

Consulta [la guía de instalación](netlify-site/LEEME-NETLIFY.md).

Netlify detecta `netlify.toml`: base `netlify-site`, comando `npm run build`, publicación `dist`. La clave de reproducción se genera automáticamente en Netlify Blobs.

La web permanece en Netlify. El video de los canales identificados usa sesiones firmadas del servicio persistente ya existente, a través de `/stream/live/*` en el CDN. Mantiene el reproductor propio, sin añadir publicidad ni P2P. Consulta la guía para la dependencia y las rutas de compatibilidad.

Cada partido muestra un contador público de espectadores activos aproximados. Se actualiza cada 30 segundos y descarta sesiones sin actividad después de 75 segundos. Cuenta reproducciones por pestaña, no personas identificadas. No existe panel de estadísticas ni contraseña de administración.
