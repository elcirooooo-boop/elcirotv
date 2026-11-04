# El Ciro TV

Sitio web preparado para Netlify: agenda → partido → canales disponibles → reproductor.

Consulta [la guía de instalación](netlify-site/LEEME-NETLIFY.md).

Netlify detecta `netlify.toml`: base `netlify-site`, comando `npm run build`, publicación `dist`. La clave de reproducción se genera automáticamente en Netlify Blobs.

Cada partido muestra un contador público de espectadores activos aproximados. Se actualiza cada 30 segundos y descarta sesiones sin actividad después de 75 segundos. Cuenta reproducciones por pestaña, no personas identificadas. No existe panel de estadísticas ni contraseña de administración.
