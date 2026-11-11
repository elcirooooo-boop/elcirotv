<?php
declare(strict_types=1);
header('Cache-Control: no-store');header('X-Robots-Tag: noindex, nofollow');header('X-Content-Type-Options: nosniff');
if(isset($_GET['channel'])){http_response_code(410);header('Content-Type: application/json; charset=utf-8');echo json_encode(['error'=>'Prueba finalizada: el proveedor rechazó el acceso directo desde el contexto publicado.']);exit;}
header('Content-Type: text/html; charset=utf-8');
?><!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>El Ciro TV · Resultado de la prueba</title><style>body{font:16px system-ui,sans-serif;max-width:760px;margin:40px auto;padding:24px;background:#f5f5f7;color:#172336;line-height:1.65}a{color:#006dcc}</style></head><body><h1>Prueba de vídeo directo finalizada</h1><p>Win Sports+ y ESPN Premium reprodujeron en la prueba local, pero las señales obtenidas desde Hostinger fueron rechazadas al reproducirlas en el navegador visitante.</p><p>No se activó esta conexión en la agenda principal. El Ciro TV continúa usando DAMITV.</p><p><a href="/">Volver a El Ciro TV</a></p></body></html>
