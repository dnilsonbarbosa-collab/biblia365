const CACHE_NAME = 'biblia365-v5';
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './icon-72.png',
    './icon-96.png',
    './icon-128.png',
    './icon-144.png',
    './icon-152.png',
    './icon-192.png',
    './icon-384.png',
    './icon-512.png'
];

const BIBLE_FILES = [
    './bibles/ARA.json',
    './bibles/ACF.json',
    './bibles/ARC.json',
    './bibles/KJF.json',
    './bibles/NVI.json',
    './bibles/NAA.json'
];

// Instalação: cacheia assets estáticos
self.addEventListener('install', (event) => {
    console.log('[SW] Instalando...');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Cache aberto');
                // Cacheia assets estáticos
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[SW] Assets estáticos cacheados');
                // Tenta pré-cachear bíblias (não bloqueia instalação se falhar)
                return caches.open(CACHE_NAME);
            })
            .then(cache => {
                return Promise.allSettled(
                    BIBLE_FILES.map(url => 
                        fetch(url, { mode: 'cors' })
                            .then(response => {
                                if(response.ok) {
                                    return cache.put(url, response);
                                }
                            })
                            .catch(err => console.log('[SW] Bíblia não cacheada:', url))
                    )
                );
            })
            .then(() => {
                console.log('[SW] Instalação completa');
                return self.skipWaiting();
            })
            .catch(err => {
                console.error('[SW] Erro na instalação:', err);
                // Mesmo com erro, força ativação
                return self.skipWaiting();
            })
    );
});

// Ativação: limpa caches antigos
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
                console.log('[SW] Ativado');
                // Assume controle imediatamente
                return self.clients.claim();
            })
    );
});

// Fetch: estratégia híbrida
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Não intercepta requisições de extensões do Chrome ou não-GET
    if (!request.url.startsWith('http') || request.method !== 'GET') {
        return;
    }

    // Estratégia Cache First para assets locais
    if (STATIC_ASSETS.some(asset => url.pathname.endsWith(asset.replace('./', '')))) {
        event.respondWith(cacheFirst(request));
        return;
    }

    // Estratégia Cache First para bíblias
    if (BIBLE_FILES.some(file => url.pathname.includes(file.replace('./', '')))) {
        event.respondWith(cacheFirst(request));
        return;
    }

    // Estratégia Network First para HTML/navegação
    if (request.mode === 'navigate' || request.destination === 'document') {
        event.respondWith(networkFirst(request));
        return;
    }

    // Default: cache first
    event.respondWith(cacheFirst(request));
});

async function cacheFirst(request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);

    if (cached) {
        return cached;
    }

    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        console.error('[SW] Falha:', request.url);
        return new Response('Offline', { 
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}

async function networkFirst(request) {
    const cache = await caches.open(CACHE_NAME);

    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        const cached = await cache.match(request);
        if (cached) {
            return cached;
        }

        // Fallback para index.html se for navegação
        if (request.mode === 'navigate') {
            return cache.match('./index.html');
        }

        return new Response('Offline', { status: 503 });
    }
}

// Mensagens do cliente
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});
