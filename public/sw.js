// Service worker PROPOSITALMENTE mínimo.
//
// Por quê: já tivemos um bug real nesse projeto em que o navegador cacheou
// uma versão antiga do JS depois de um deploy, e isso quebrou o login (token
// CSRF ficou desatualizado). Um service worker que cacheia agressivamente o
// "app shell" (JS/CSS/HTML) reintroduziria esse mesmo problema, só que pior
// — o cache de um service worker é mais persistente e mais difícil da
// pessoa limpar manualmente do que o cache normal do navegador.
//
// Então este service worker NÃO intercepta nem cacheia nenhum request da
// aplicação. Ele só existe pra satisfazer o critério técnico do Chrome/
// Android de "app instalável" (precisa ter um service worker registrado).
// Toda página continua sendo sempre buscada da rede, igual sem PWA nenhum.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Sem 'fetch' handler de propósito — deixa o navegador buscar tudo da rede
// normalmente, sem nenhuma camada de cache no meio.
