# El Ciro en Netlify

La web se publica en Netlify con archivos estáticos, Functions (Node.js) y Blobs. La entrega de video utiliza el servicio persistente existente en `web-production-dc68f.up.railway.app`; la web no se aloja allí. Ese servicio debe permanecer activo. El reproductor sigue siendo nuestro HLS.js, sin iframes de terceros, anuncios añadidos ni P2P.

## Crear el proyecto

1. En Netlify, elige **Add new project → Import an existing project → GitHub**, selecciona `srar9/sitiotv` y la rama **`main`**. Esta rama contiene la versión para Netlify.
2. La configuración de `netlify.toml`, en la raíz del repositorio, establece:
   - Base directory: `netlify-site`
   - Build command: `npm run build`
   - Publish directory: `netlify-site/dist` desde la raíz (`dist` dentro de la base).
   - Functions: `netlify-site/functions` desde la raíz.
   - Node.js: 22.
3. La clave privada de reproducción se genera y guarda automáticamente en Netlify Blobs. Opcionalmente puedes configurar `HLS_PROXY_SECRET` (al menos 32 caracteres) en Functions para usar tu propia clave.
4. Publica el proyecto. Netlify entrega el dominio `nombre.netlify.app`; después puedes añadir un dominio propio.

No sirve arrastrar solamente `dist` a Netlify Drop: faltarán las funciones. Usa la importación del repositorio o Netlify CLI con funciones.

## Qué incluye

- Agenda ordenada por hora y búsqueda por equipo, competición o canal.
- Cada partido muestra todas sus señales publicadas antes de cargar el video.
- Cada señal se identifica por su URL completa. Opciones con el mismo nombre o parámetro `stream` pueden apuntar a distintos proveedores.
- Selección de canal con fuentes de respaldo internas y recuperación automática ante errores o congelación, sin elegir proveedores manualmente.
- Controles de video, reintento y pantalla completa.
- Directorio de 72 canales importado del bot uno, además de las señales publicadas del día, y enlace a `@elasdelfutbol`.


La página no añade anuncios ni abre iframes publicitarios. Los anuncios incrustados en la señal de origen y su disponibilidad dependen del proveedor. No se garantiza reproducción de una fuente bloqueada, protegida o caída.

## Validación después del primer despliegue

1. `/api/agenda` debe devolver JSON con `events` y `channels`.
2. Abre un partido: no debe reproducirse nada hasta elegir canal. Elige dos opciones del mismo partido y confirma que cambia la señal.
3. Recarga directamente el enlace `/partido/...`: debe conservar la página.
5. Prueba en móvil el botón de reproducción y pantalla completa. Algunos navegadores exigen tocar reproducir para permitir sonido.

## Desarrollo

En `netlify-site`: `npm ci`, `npm test`, `npm run build`. Para la API real, usa Netlify Dev con el proyecto vinculado y sus variables configuradas; las funciones necesitan el contexto de Blobs. Nunca publiques la raíz completa del repositorio: solo `dist` contiene los archivos públicos.

Para los canales identificados, `/api/play` abre una sesión en `/api/playback/<slug>` del servicio persistente. Devuelve una lista firmada `/stream/live/<slug>/sub.m3u8?...` que fija la fuente durante esa reproducción. No debe utilizarse el antiguo `master.m3u8` como URL permanente: vuelve a resolver la fuente y puede alternar entre servidores y sus cachés cada minuto.

Las reglas de `public/_redirects` y `netlify.toml` envían `/stream/live/*` desde el CDN de Netlify al servicio existente. Las listas no se almacenan en caché; segmentos, claves y listas hijas permanecen firmados por el servicio. Esto evita una invocación de Functions y la lectura de la clave de Blobs por cada fragmento. Las señales adicionales que no tienen un identificador reconocido conservan la ruta compatible `/api/media`. Se consume transferencia en Netlify y en el servicio de video; esta validación no sustituye una prueba de carga.

El servicio prepara hasta tres fragmentos recientes de la misma fuente en paralelo. La caché es privada, limitada a 48 MB por proceso y 45 segundos, y agrupa solicitudes simultáneas del mismo fragmento. Solo se guardan archivos completos; las respuestas vacías, truncadas o de error no entran en caché. Los diagnósticos se escriben en segundo plano para que una espera de SQLite no detenga el video. Las peticiones con Range conservan su ruta compatible.

Documentación: [Functions](https://docs.netlify.com/build/functions/overview/), [límites de respuesta](https://docs.netlify.com/build/functions/api/), [Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/).

Cada partido muestra un contador público de espectadores activos aproximados. Se actualiza cada 30 segundos y descarta sesiones sin actividad después de 75 segundos. Cuenta reproducciones por pestaña, no personas identificadas. No existe panel de estadísticas ni contraseña de administración.

La recuperación conserva el mismo canal y solicita una sesión nueva únicamente cuando es necesaria. El servicio persistente administra sus fuentes; el cliente no excluye una ruta entera al fallar una sesión. Los reintentos son limitados y se detienen al salir de la página. No se garantiza disponibilidad de proveedores externos.

El catálogo se importó de `TR_CHANNELS`, `CHANNEL_NAMES` y los alias de `channel_source.py` del bot uno. Las solicitudes de manifiestos, claves y segmentos conservan `Referer`, `Origin` y el mismo User-Agent del bot. La web usa HLS; la conversión continua FFmpeg → Telegram del bot requiere un proceso persistente y no se ejecuta en Functions.
