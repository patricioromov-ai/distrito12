// Service Worker de SIGT — cachea el "cascarón" de la app (HTML, íconos)
// para que abra aunque no haya internet. Las llamadas al backend (Apps
// Script) NUNCA se cachean — siempre van a la red, porque son datos vivos.
const CACHE_NAME = 'sigt-cache-v1';
const ARCHIVOS_APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './iconos/icon-192.png',
  './iconos/icon-512.png'
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ARCHIVOS_APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys().then((nombres) =>
      Promise.all(nombres.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (evento) => {
  const url = new URL(evento.request.url);

  // Las llamadas a Apps Script (el backend) nunca se cachean — siempre red.
  if (url.origin !== self.location.origin) {
    return; // deja pasar la solicitud normal, sin intervenir
  }

  // Para los archivos propios de la app: cache primero, con respaldo a red
  // y actualización silenciosa del caché en segundo plano.
  evento.respondWith(
    caches.match(evento.request).then((respuestaCacheada) => {
      const fetchPromesa = fetch(evento.request).then((respuestaRed) => {
        if (respuestaRed && respuestaRed.status === 200) {
          caches.open(CACHE_NAME).then((cache) => cache.put(evento.request, respuestaRed.clone()));
        }
        return respuestaRed;
      }).catch(() => respuestaCacheada); // sin internet: usa lo que haya en caché

      return respuestaCacheada || fetchPromesa;
    })
  );
});

// ---- Notificaciones locales (mientras la app está abierta o en 2° plano) ----
// El sistema no envía push reales todavía (eso requiere un servicio externo
// tipo Firebase); esto muestra un aviso del sistema operativo cuando la
// propia pestaña detecta algo nuevo, aprovechando el Service Worker.
self.addEventListener('message', (evento) => {
  if (evento.data && evento.data.tipo === 'MOSTRAR_NOTIFICACION') {
    const { titulo, cuerpo, etiqueta, datos } = evento.data;
    self.registration.showNotification(titulo, {
      body: cuerpo,
      icon: './iconos/icon-192.png',
      badge: './iconos/icon-192.png',
      tag: etiqueta || 'sigt-noti',
      data: datos || {}
    });
  }
});

// Al tocar la notificación, enfoca la app (y en el futuro podría llevar a
// una pantalla específica usando "datos.destino").
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  evento.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((listaClientes) => {
      for (const cliente of listaClientes) {
        if ('focus' in cliente) return cliente.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('./index.html');
    })
  );
});
