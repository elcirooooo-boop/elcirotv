# El Ciro en Netlify

La web y la reproducción funcionan con archivos estáticos, Functions (Node.js) y Blobs en Netlify. No necesitan Railway, un bot activo ni un servidor persistente adicional. Las señales se obtienen de los proveedores registrados mediante la API propia. El reproductor sigue siendo HLS.js, sin iframes de terceros, anuncios añadidos ni P2P.

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

`/api/play` resuelve y valida una fuente registrada del canal seleccionado. Devuelve una sesión firmada `/api/media?t=...`, generada con la clave privada persistida en Netlify Blobs. La selección mantiene una caché corta y agrupa solicitudes simultáneas; una reconexión puede pedir una resolución nueva.

Netlify Functions entrega listas, claves y fragmentos desde `/api/media`, conservando las cabeceras requeridas por el proveedor y validando cada destino. Las listas no se almacenan en caché; los enlaces de sus fragmentos y listas hijas están firmados. Los bytes se transmiten progresivamente, con un límite de 19 MB por fragmento. La clave de firma se reutiliza en memoria tras obtenerla de Blobs.

Ante una denegación 401/403, la función puede solicitar una sesión pública nueva del reproductor registrado, dentro de la misma invocación y con un límite de ocho segundos. Solo reutiliza la ruta exacta de la lista o un fragmento inequívoco publicado por ese canal; conserva los identificadores de segmento y no cambia de partido. Si la renovación falla, devuelve el error para la recuperación limitada del cliente.

HLS.js usa FetchLoader progresivo para procesar los datos mientras llegan. Esta versión no ejecuta procesos Gunicorn, FFmpeg, cachés persistentes de fragmentos ni tareas de un bot. Cada descarga consume transferencia e invocaciones de Netlify; las pruebas funcionales no sustituyen una prueba de carga.

Los enlaces antiguos `/stream/live/*` responden 410 desde una función local para que el reproductor solicite una sesión actualizada. No se redirigen a un servicio externo.

Al arrancar, HLS.js intenta acumular un segundo de video; esta preparación añade como máximo un segundo de espera y no exige terminar de descargar el fragmento. Si la reproducción se detiene ante un hueco de hasta un segundo y el siguiente rango ya está descargado, el cliente avanza a ese rango sin renovar la sesión. No realiza ese ajuste en pausa ni atraviesa huecos mayores. Las promesas de reproducción de sesiones anteriores no pueden detener una sesión recuperada.

Documentación: [Functions](https://docs.netlify.com/build/functions/overview/), [límites de respuesta](https://docs.netlify.com/build/functions/api/), [Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/).

Cada partido muestra un contador público de espectadores activos aproximados. Se actualiza cada 30 segundos y descarta sesiones sin actividad después de 75 segundos. Cuenta reproducciones por pestaña, no personas identificadas. No existe panel de estadísticas ni contraseña de administración.

La recuperación conserva el mismo canal y solicita una sesión nueva únicamente cuando es necesaria. Las fuentes de respaldo pertenecen a ese canal. Los reintentos son limitados y se detienen al salir de la página. No se garantiza disponibilidad de proveedores externos ni su aceptación de tráfico desde Netlify.


El catálogo se importó de `TR_CHANNELS`, `CHANNEL_NAMES` y los alias de `channel_source.py` del bot uno. Las solicitudes de manifiestos, claves y segmentos conservan `Referer`, `Origin` y el mismo User-Agent del bot. La web usa HLS; la conversión continua FFmpeg → Telegram del bot requiere un proceso persistente y no se ejecuta en Functions.
