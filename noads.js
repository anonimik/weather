(function () {
    'use strict';

    if (window.lampa_max_adblock_ready) return;
    window.lampa_max_adblock_ready = true;

    // --- 1. Жесткий черный список ---
    var adDomains = [
        'api2.rstprgapipt.com',  // Главный источник видеорекламы
        'cub.best/api/ad',       // Встроенная реклама CUB
        'yandex.ru/adfox',       // Рекламная сеть Яндекса
        'weborama-tech.ru',      // Трекер показов
        'an.yandex.ru',          // Баннеры
        'googleadservices.com',
        'doubleclick.net',
        'ad.cub.red',
        'ads.cub.red'
    ];

    function isAdUrl(url) {
        if (!url || typeof url !== 'string') return false;
        var lowerUrl = url.toLowerCase();
        for (var i = 0; i < adDomains.length; i++) {
            if (lowerUrl.indexOf(adDomains[i]) !== -1) {
                return true;
            }
        }
        return false;
    }

    // --- 2. Перехват fetch ---
    var originalFetch = window.fetch;
    if (originalFetch) {
        window.fetch = function (input, init) {
            var url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
            if (isAdUrl(url)) {
                return Promise.resolve(new Response('', { status: 200, statusText: 'OK' }));
            }
            return originalFetch.apply(this, arguments);
        };
    }

    // --- 3. Перехват XMLHttpRequest ---
    var originalXHR = window.XMLHttpRequest;
    if (originalXHR) {
        window.XMLHttpRequest = function () {
            var xhr = new originalXHR();
            var originalOpen = xhr.open;
            var originalSend = xhr.send;

            xhr.open = function (method, url) {
                if (isAdUrl(url)) {
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

    // --- 4. Перехват navigator.sendBeacon (трекеры часто используют его) ---
    if (navigator.sendBeacon) {
        var originalBeacon = navigator.sendBeacon;
        navigator.sendBeacon = function (url, data) {
            if (isAdUrl(url)) return true; // Имитируем успешную отправку
            return originalBeacon.apply(this, arguments);
        };
    }

    // --- 5. Блокировка рекламных картинок-пикселей ---
    var originalCreateElement = document.createElement;
    document.createElement = new Proxy(originalCreateElement, {
        apply: function (target, thisArg, args) {
            var el = target.apply(thisArg, args);
            if (args[0] && args[0].toLowerCase() === 'img') {
                var originalSrcDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
                Object.defineProperty(el, 'src', {
                    set: function (value) {
                        if (isAdUrl(value)) return; // Игнорируем установку src
                        originalSrcDescriptor.set.call(this, value);
                    },
                    get: function () {
                        return originalSrcDescriptor.get.call(this);
                    }
                });
            }
            return el;
        }
    });

    // --- 6. Нейтрализация менеджеров рекламы ---
    function killAdManagers() {
        var managers = ['AdManager', 'AdfoxManager', 'CubAdManager', 'PrerollManager'];
        managers.forEach(function (name) {
            if (window[name]) {
                window[name] = {
                    init: function () {}, load: function () {}, show: function () {},
                    showPreroll: function () {}, showBanner: function () {}
                };
            }
            if (window.Lampa && window.Lampa[name]) {
                window.Lampa[name] = {
                    init: function () {}, load: function () {}, show: function () {}
                };
            }
        });
    }

    // --- 7. Удаление визуальных баннеров ---
    function removeBanners() {
        var selectors = [
            '.cub-premium-banner', '.cub-ad', '.cub-subscribe',
            '[class*="cub"][class*="premium"]', '[class*="cub"][class*="ad"]',
            '[id*="banner"]', '[class*="banner"]',
            'iframe[src*="yandex"]', 'iframe[src*="adfox"]'
        ];
        
        selectors.forEach(function(sel) {
            try {
                var elements = document.querySelectorAll(sel);
                elements.forEach(function(el) {
                    if (el.tagName !== 'VIDEO') {
                        el.style.display = 'none';
                        el.remove();
                    }
                });
            } catch (e) {}
        });
    }

    function init() {
        killAdManagers();

        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') {
                killAdManagers(); // Повторная нейтрализация

                Lampa.Listener.follow('activity', function (event) {
                    if (event.type === 'start' || event.type === 'complete') {
                        setTimeout(removeBanners, 500);
                    }
                });
                setTimeout(removeBanners, 1500);
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
