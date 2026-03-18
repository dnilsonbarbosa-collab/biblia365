const CACHE_NAME = 'biblia365-complete-v4';
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json'
];

const BIBLE_FILES = [
    './bibles/ARA.json',
    './bibles/ACF.json',
    './bibles/ARC.json',
    './bibles/KJF.json',
    './bibles/NVI.json',
    './bibles/NAA.json'
];

const CREED_FILES = [
    './data/creeds-confessions.json',
    './data/apostles-creed.json',
    './data/nicene-creed.json',
    './data/athanasian-creed.json',
    './data/westminster-confession.json',
    './data/belgic-confession.json',
    './data/heidelberg-catechism.json',
    './data/westminster-catechism.json',
    './data/london-confession.json'
];

const ICON_FILES = [
    './icons/icon-72.png',
    './icons/icon-96.png',
    './icons/icon-128.png',
    './icons/icon-144.png',
    './icons/icon-152.png',
    './icons/icon-192.png',
    './icons/icon-384.png',
    './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
    console.log('[SW] Instalando...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Cache aberto');
                return cache.addAll([...STATIC_ASSETS, ...ICON_FILES]);
            })
            .then(() => {
                console.log('[SW] Arquivos estáticos cacheados');
                return caches.open(CACHE_NAME);
            })
            .then(cache => {
                return Promise.allSettled(
                    BIBLE_FILES.map(url => 
                        fetch(url)
                            .then(response => {
                                if(response.ok) {
                                    return cache.put(url, response);
                                }
                            })
                            .catch(err => console.log('[SW] Não foi possível cachear Bíblia:', url))
                    )
                );
            })
            .then(() => {
                console.log('[SW] Bíblias processadas');
                return caches.open(CACHE_NAME);
            })
            .then(cache => {
                return Promise.allSettled(
                    CREED_FILES.map(url => 
                        fetch(url)
                            .then(response => {
                                if(response.ok) {
                                    return cache.put(url, response);
                                }
                            })
                            .catch(err => console.log('[SW] Não foi possível cachear credo:', url))
                    )
                );
            })
            .then(() => {
                console.log('[SW] Credos processados');
                console.log('[SW] Instalação completa');
                return self.skipWaiting();
            })
            .catch(err => {
                console.error('[SW] Erro na instalação:', err);
                return self.skipWaiting();
            })
    );
});

self.addEventListener('activate', (event) => {
    console.log('[SW] Ativando...');
    
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(name => name !== CACHE_NAME)
                        .map(name => {
                            console.log('[SW] Deletando cache antigo:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[SW] Ativado e controlando clients');
                return self.clients.claim();
            })
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    if (BIBLE_FILES.some(file => url.pathname.includes(file.replace('./', '')))) {
        event.respondWith(cacheFirst(request, CACHE_NAME));
        return;
    }

    if (url.pathname.includes('/data/')) {
        event.respondWith(cacheFirst(request, CACHE_NAME));
        return;
    }

    if (url.pathname.includes('/icons/')) {
        event.respondWith(cacheFirst(request, CACHE_NAME));
        return;
    }

    event.respondWith(networkFirst(request, CACHE_NAME));
});

async function cacheFirst(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    
    if (cached) {
        console.log('[SW] Cache hit:', request.url);
        return cached;
    }
    
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        console.error('[SW] Falha completa:', request.url);
        return new Response('Offline', { 
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}

async function networkFirst(request, cacheName) {
    const cache = await caches.open(cacheName);
    
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        const cached = await cache.match(request);
        if (cached) {
            console.log('[SW] Servindo do cache:', request.url);
            return cached;
        }
        
        if (request.mode === 'navigate') {
            return cache.match('./index.html');
        }
        
        return new Response('Offline', { status: 503 });
    }
}

self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-bibles') {
        event.waitUntil(syncBibles());
    }
    if (event.tag === 'sync-creeds') {
        event.waitUntil(syncCreeds());
    }
});

async function syncBibles() {
    console.log('[SW] Sincronizando Bíblias...');
    const cache = await caches.open(CACHE_NAME);
    
    for (const bibleUrl of BIBLE_FILES) {
        try {
            const response = await fetch(bibleUrl);
            if (response.ok) {
                await cache.put(bibleUrl, response);
                console.log('[SW] Bíblia sincronizada:', bibleUrl);
            }
        } catch (e) {
            console.log('[SW] Falha ao sincronizar Bíblia:', bibleUrl);
        }
    }
}

async function syncCreeds() {
    console.log('[SW] Sincronizando Credos...');
    const cache = await caches.open(CACHE_NAME);
    
    for (const creedUrl of CREED_FILES) {
        try {
            const response = await fetch(creedUrl);
            if (response.ok) {
                await cache.put(creedUrl, response);
                console.log('[SW] Credo sincronizado:', creedUrl);
            }
        } catch (e) {
            console.log('[SW] Falha ao sincronizar credo:', creedUrl);
        }
    }
}

self.addEventListener('push', (event) => {
    const data = event.data.json();
    event.waitUntil(
        self.registration.showNotification(data.title || 'Bíblia 365', {
            body: data.body || 'Hora da sua leitura diária!',
            icon: './icons/icon-192.png',
            badge: './icons/icon-72.png',
            tag: 'daily-reading',
            requireInteraction: true,
            actions: [
                { action: 'read', title: '📖 Ler Agora' },
                { action: 'dismiss', title: '✓ Depois' }
            ]
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    if (event.action === 'read') {
        event.waitUntil(clients.openWindow('./?action=read'));
    }
});

self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
    
    if (event.data === 'getVersion') {
        event.ports[0].postMessage(CACHE_NAME);
    }
});
