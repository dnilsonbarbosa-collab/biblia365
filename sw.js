const CACHE_NAME = 'biblia365-offline-v1';
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './offline-manifest.json',
    './icons/icon-72x72.png',
    './icons/icon-96x96.png',
    './icons/icon-128x128.png',
    './icons/icon-144x144.png',
    './icons/icon-152x152.png',
    './icons/icon-192x192.png',
    './icons/icon-384x384.png',
    './icons/icon-512x512.png'
];

const BIBLE_FILES = [
    './bibles/ACF.json',
    './bibles/ARA.json',
    './bibles/ARC.json',
    './bibles/KJF.json',
    './bibles/NVI.json',
    './bibles/NAA.json'
];

self.addEventListener('install', (event) => {
    console.log('[SW] Instalando Service Worker...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Cache aberto');
                return cache.addAll(STATIC_ASSETS)
                    .then(() => {
                        console.log('[SW] Assets estáticos cacheados');
                        return cacheBiblesSequentially(cache);
                    });
            })
            .then(() => {
                console.log('[SW] Todos os recursos cacheados');
                return self.skipWaiting();
            })
            .catch((err) => {
                console.error('[SW] Erro ao cachear:', err);
            })
    );
});

async function cacheBiblesSequentially(cache) {
    for (const bible of BIBLE_FILES) {
        try {
            const response = await fetch(bible);
            if (response.ok) {
                await cache.put(bible, response.clone());
                console.log(`[SW] Cacheado: ${bible}`);
            }
        } catch (err) {
            console.warn(`[SW] Falha ao cachear ${bible}:`, err);
        }
    }
}

self.addEventListener('activate', (event) => {
    console.log('[SW] Ativando Service Worker...');
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => {
                        console.log(`[SW] Deletando cache antigo: ${name}`);
                        return caches.delete(name);
                    })
            );
        }).then(() => {
            console.log('[SW] Service Worker ativado');
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    if (url.pathname.includes('/bibles/')) {
        event.respondWith(
            caches.match(request)
                .then((response) => {
                    if (response) {
                        console.log(`[SW] Bíblia do cache: ${url.pathname}`);
                        return response;
                    }
                    
                    return fetch(request)
                        .then((networkResponse) => {
                            if (networkResponse.ok) {
                                const clone = networkResponse.clone();
                                caches.open(CACHE_NAME).then((cache) => {
                                    cache.put(request, clone);
                                });
                            }
                            return networkResponse;
                        })
                        .catch(() => {
                            return new Response(
                                JSON.stringify({ error: 'Bíblia não disponível offline' }),
                                { 
                                    status: 503, 
                                    headers: { 'Content-Type': 'application/json' } 
                                }
                            );
                        });
                })
        );
    } else {
        event.respondWith(
            caches.match(request)
                .then((response) => {
                    if (response) {
                        return response;
                    }
                    
                    return fetch(request)
                        .then((networkResponse) => {
                            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                                return networkResponse;
                            }
                            
                            const responseToCache = networkResponse.clone();
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(request, responseToCache);
                            });
                            
                            return networkResponse;
                        });
                })
        );
    }
});

self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-bibles') {
        event.waitUntil(syncBibles());
    }
});

async function syncBibles() {
    const cache = await caches.open(CACHE_NAME);
    
    for (const bible of BIBLE_FILES) {
        try {
            const response = await fetch(bible);
            if (response.ok) {
                await cache.put(bible, response);
                console.log(`[SW] Sincronizado: ${bible}`);
            }
        } catch (err) {
            console.warn(`[SW] Falha ao sincronizar ${bible}`);
        }
    }
}

self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
    
    if (event.data === 'checkOfflineStatus') {
        checkOfflineStatus().then((status) => {
            event.ports[0].postMessage(status);
        });
    }
});

async function checkOfflineStatus() {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    const biblesCached = BIBLE_FILES.every((bible) => 
        keys.some((key) => key.url.includes(bible))
    );
    
    return {
        biblesCached,
        totalCached: keys.length,
        cacheName: CACHE_NAME
    };
}
