(function () {
    'use strict';

    if (window.lampa_max_adblock_ready) return;
    window.lampa_max_adblock_ready = true;

    // --- 1. Черный список трекеров и рекламы ---
    var adDomains = [
        'cub.best/api/ad',
        'cub.black/api/metric',
        'cubnotrip.top/api/metric', // Добавлено: блокировка метрики cubnotrip.top
        'yandex.ru/adfox',
        'weborama-tech.ru',
        'an.yandex.ru',
        'googleadservices.com',
        'doubleclick.net',
        'ad.cub.red',
        'ads.cub.red'
    ];

    // Опасные паттерны для слова "ad"
    var adPatterns = [
        '/ad/', '.ad.', '/ads/', '/adv/', '=ad', '&ad', '_ad', '-ad', 
        'adserver', 'adservice', 'adfox', 'adsystem', 'advert'
    ];

    function isAdVideoUrl(url) {
        if (!url || typeof url !== 'string') return false;
        return url.indexOf('runtime.strm.yandex.ru') !== -1 && 
               (url.indexOf('vplv') !== -1 || url.indexOf('/ad') !== -1);
    }

    function isAdUrl(url) {
        if (!url || typeof url !== 'string') return false;
        if (isAdVideoUrl(url)) return true;
        
        var lowerUrl = url.toLowerCase();
        
        // 1. Проверка по жесткому черному списку (включая метрику)
        for (var i = 0; i < adDomains.length; i++) {
            if (lowerUrl.indexOf(adDomains[i]) !== -1) {
                return true;
            }
        }

        // 2. Умный поиск рекламных маркеров
        for (var j = 0; j < adPatterns.length; j++) {
            if (lowerUrl.indexOf(adPatterns[j]) !== -1) {
                return true;
            }
        }

        // 3. Блокировка поддоменов вида ad.example.com
        if (/^(https?:\/\/)?(ad|ads|adv|advert|adserver)\.[a-z0-9-]+\.[a-z]+/i.test(lowerUrl)) {
            return true;
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

    // --- 4. Перехват sendBeacon ---
    if (navigator.sendBeacon) {
        var originalBeacon = navigator.sendBeacon;
        navigator.sendBeacon = function (url, data) {
            if (isAdUrl(url)) return true; 
            return originalBeacon.apply(this, arguments);
        };
    }

    // --- 5. Перехват создания видео и картинок ---
    var originalCreateElement = document.createElement;
    document.createElement = new Proxy(originalCreateElement, {
        apply: function (target, thisArg, args) {
            var el = target.apply(thisArg, args);
            var tagName = args[0] ? args[0].toLowerCase() : '';
            
            if (tagName === 'img' || tagName === 'video' || tagName === 'source') {
                var prop = 'src';
                var proto = tagName === 'img' ? HTMLImageElement.prototype : 
                            (tagName === 'video' ? HTMLVideoElement.prototype : HTMLSourceElement.prototype);
                var originalDescriptor = Object.getOwnPropertyDescriptor(proto, prop);
                
                if (originalDescriptor) {
                    Object.defineProperty(el, prop, {
                        set: function (value) {
                            if (isAdUrl(value)) {
                                if (tagName === 'video') {
                                    setTimeout(() => {
                                        this.dispatchEvent(new Event('ended'));
                                        this.dispatchEvent(new Event('error'));
                                    }, 10);
                                }
                                return; 
                            }
                            originalDescriptor.set.call(this, value);
                        },
                        get: function () {
                            return originalDescriptor.get.call(this);
                        }
                    });
                }
            }
            return el;
        }
    });

    // --- 6. Нейтрализация менеджеров рекламы ---
    function killAdManagers() {
        var managers = ['AdManager', 'AdfoxManager', 'CubAdManager', 'PrerollManager', 'AdsManager'];
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

    // --- 7. Удаление баннеров ---
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
                killAdManagers();
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
