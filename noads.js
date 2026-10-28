(function () {
    'use strict';

    if (window.lampa_security_plugin_ready) return;
    window.lampa_security_plugin_ready = true;

    // --- 1. Блокировка сетевых запросов к рекламным/трекинговым доменам ---
    var blockDomains = [
        'ad.cub.red',
        'ads.cub.red',
        'cub.red/ad',
        'cub.red/ads',
        'yandex.ru/ads',
        'an.yandex.ru',
        'googleadservices.com',
        'doubleclick.net',
        'adservice.google.com',
        'googlesyndication.com',
        'google-analytics.com',
        'mc.yandex.ru',
        'top-fwz1.mail.ru',
        'vk.com/rtrg'
    ];

    function isBlockedUrl(url) {
        if (!url || typeof url !== 'string') return false;
        var lowerUrl = url.toLowerCase();
        for (var i = 0; i < blockDomains.length; i++) {
            if (lowerUrl.indexOf(blockDomains[i]) !== -1) return true;
        }
        return false;
    }

    // Перехват fetch
    var originalFetch = window.fetch;
    if (originalFetch) {
        window.fetch = function (input, init) {
            var url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
            if (isBlockedUrl(url)) {
                return Promise.resolve(new Response('', { status: 200, statusText: 'OK' }));
            }
            return originalFetch.apply(this, arguments);
        };
    }

    // Перехват XMLHttpRequest
    var originalXHR = window.XMLHttpRequest;
    if (originalXHR) {
        window.XMLHttpRequest = function () {
            var xhr = new originalXHR();
            var originalOpen = xhr.open;
            var originalSend = xhr.send;

            xhr.open = function (method, url) {
                if (isBlockedUrl(url)) {
                    this._blocked = true;
                    return;
                }
                return originalOpen.apply(this, arguments);
            };

            xhr.send = function () {
                if (this._blocked) {
                    setTimeout(function () {
                        if (xhr.onload) xhr.onload();
                        else if (xhr.onreadystatechange) {
                            xhr.readyState = 4;
                            xhr.status = 200;
                            xhr.onreadystatechange();
                        }
                    }, 10);
                    return;
                }
                return originalSend.apply(this, arguments);
            };
            return xhr;
        };
    }

    // --- 2. Удаление сторонних iframe (потенциально опасные виджеты) ---
    function removeUnsafeIframes() {
        try {
            var iframes = document.querySelectorAll('iframe');
            iframes.forEach(function (iframe) {
                var src = (iframe.src || '').toLowerCase();
                // Оставляем только iframe с того же домена, что и Lampa
                if (src && src.indexOf(window.location.hostname) === -1 && src.indexOf('lampa') === -1) {
                    iframe.remove();
                }
            });
        } catch (e) {}
    }

    // --- 3. Удаление баннеров и рекламных блоков ---
    function removeBanners() {
        var selectors = [
            '.cub-premium-banner',
            '.cub-ad',
            '.cub-subscribe',
            '[class*="cub"][class*="premium"]',
            '[class*="cub"][class*="ad"]',
            '[id*="ad-"]',
            '[class*="ad-banner"]'
        ];
        selectors.forEach(function (sel) {
            try {
                document.querySelectorAll(sel).forEach(function (el) {
                    el.remove();
                });
            } catch (e) {}
        });
    }

    // --- Запуск ---
    function init() {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') {
                // Очистка при старте
                setTimeout(function () {
                    removeBanners();
                    removeUnsafeIframes();
                }, 1000);

                // Очистка при смене экранов
                Lampa.Listener.follow('activity', function (event) {
                    if (event.type === 'start' || event.type === 'complete') {
                        setTimeout(function () {
                            removeBanners();
                            removeUnsafeIframes();
                        }, 500);
                    }
                });
            }
        });
    }

    if (window.appready) {
        init();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') init();
        });
    }
})();
