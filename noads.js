(function () {
    'use strict';

    if (window.cub_hard_adblock_ready) return;
    window.cub_hard_adblock_ready = true;

    // --- 1. Настройка списка блокировки ---
    var adDomains = [
        'cub.best/api/ad',
        'ad.cub.red',
        'ads.cub.red',
        'cub.red/ad',
        'cub.red/ads'
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
                // Возвращаем пустой успешный ответ, чтобы Lampa не падала с ошибкой
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
                    // Эмулируем успешную загрузку пустого ответа
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

    // --- 4. Нейтрализация менеджера рекламы (если он глобальный) ---
    // Некоторые сборки Lampa выносят логику рекламы в глобальные объекты
    function killAdManager() {
        if (window.AdManager) {
            window.AdManager = {
                init: function() {},
                load: function() {},
                show: function() {},
                showPreroll: function() {},
                showBanner: function() {},
                render: function() {}
            };
        }
        // Если менеджер спрятан в Lampa
        if (window.Lampa && window.Lampa.AdManager) {
            window.Lampa.AdManager = {
                init: function() {},
                load: function() {},
                show: function() {}
            };
        }
    }

    // --- 5. Удаление баннеров из интерфейса ---
    function removeCubAds() {
        var selectors = [
            '.cub-premium-banner',
            '.cub-ad',
            '.cub-subscribe',
            '[class*="cub"][class*="premium"]',
            '[class*="cub"][class*="ad"]',
            '[id*="banner"]',
            '[class*="banner"]'
        ];
        
        selectors.forEach(function(sel) {
            try {
                var elements = document.querySelectorAll(sel);
                elements.forEach(function(el) {
                    // Осторожно: не удаляем элементы самого плеера
                    if (el.tagName !== 'VIDEO') {
                        el.style.display = 'none';
                        el.remove();
                    }
                });
            } catch (e) {}
        });
    }

    function init() {
        killAdManager();

        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') {
                killAdManager(); // Повторяем на всякий случай

                Lampa.Listener.follow('activity', function (event) {
                    if (event.type === 'start' || event.type === 'complete') {
                        setTimeout(removeCubAds, 500);
                    }
                });
                setTimeout(removeCubAds, 1500);
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
