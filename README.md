# El Ciro TV para Hostinger Premium

Esta versión utiliza HTML, JavaScript y PHP. No requiere Node.js, Netlify, créditos ni una base de datos externa en el servidor. Conserva agenda, canales, reproducción HLS, alternativas del mismo canal, enlaces compartidos, contador de espectadores, escudos, banderas y estado EN VIVO estimado.

## Instalar

1. Crea un **sitio web PHP/HTML nuevo** en Hostinger, con un dominio o subdominio de prueba. No sobrescribas otra web existente.
2. En hPanel elige **PHP 8.2 o superior**, con extensiones **curl**, **mbstring** e **iconv** habilitadas.
3. Abre el Administrador de archivos y entra en `public_html` del sitio nuevo.
4. Sube `elcirotv-hostinger.zip` y extráelo allí. Deben quedar directamente `index.html`, `api.php`, `.htaccess`, `server/`, `flags/`, etc., sin una carpeta adicional que los envuelva. Activa mostrar archivos ocultos para comprobar `.htaccess`.
5. Activa el certificado SSL, abre la dirección HTTPS y comprueba la agenda. Prueba un partido y un canal desde el equipo y desde el móvil.
6. Comprueba un enlace `/partido/...` abierto directamente y recarga esa página. Si da 404, revisa que `.htaccess` se haya extraído y que la reescritura de URL esté habilitada.

La clave que firma las sesiones de vídeo se genera automáticamente. La agenda y los espectadores se guardan en una carpeta privada creada **al lado de `public_html`**, no dentro. PHP necesita permiso de escritura en esa carpeta superior. No copies esa carpeta privada al cambiar de dominio; se regenera. Para una ubicación personalizada crea `config.php` en `public_html` que devuelva `['storage_dir'=>'/ruta/privada/fuera/de/public_html']`. Nunca indiques una carpeta pública.

## Qué se ha comprobado

El paquete se comprueba localmente con PHP real: rutas de API, agenda de las fuentes, firma y caducidad de sesiones, reescritura HLS, unión de duplicados y contador. Las pruebas de reproducción dependen de que cada proveedor publique una señal disponible. El país/IP de salida de Hostinger puede obtener resultados distintos de Netlify.

La emisión depende de servicios externos. Esta conversión no garantiza que todos los canales estén disponibles ni capacidad ilimitada. Cada reproducción consume ancho de banda, conexiones PHP y recursos de Hostinger. Los límites del plan siguen aplicándose. La web de Netlify continúa independiente y no se modifica al subir este ZIP.

## Actualizar desde el proyecto

En el equipo de desarrollo, con las dependencias de `netlify-site` instaladas: `node hostinger-php/build.mjs`. El resultado queda en `hostinger-package/public_html`. Crea el ZIP con **el contenido** de esa carpeta, incluyendo `.htaccess`.
