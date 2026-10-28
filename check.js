(function () {
    'use strict';

    if (window.vpn_icon_plugin_ready) return;
    window.vpn_icon_plugin_ready = true;

    var initialized = false;
    var iconElement = null;

    // SVG-иконка в стиле iOS (щит с замком / глобус)
    var VPN_ICON_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" style="vertical-align: middle;"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>';

    // Альтернативная иконка (глобус, если первая не нравится)
    // var VPN_ICON_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>';

    // Проверка страны через публичный API (без ключа, лимиты)
    function checkCountry(callback) {
        // Используем ipapi.co (бесплатно, до 1000 запросов в день)
        var xhr = new XMLHttpRequest();
        xhr.open('GET', 'https://ipapi.co/json/', true);
        xhr.timeout = 5000;
        xhr.onload = function () {
            if (xhr.status === 200) {
                try {
                    var data = JSON.parse(xhr.responseText);
                    // country_code — двухбуквенный код страны (RU, US, DE и т.д.)
                    callback(data.country_code || null);
                } catch (e) {
                    callback(null);
                }
            } else {
                callback(null);
            }
        };
        xhr.onerror = function () { callback(null); };
        xhr.ontimeout = function () { callback(null); };
        xhr.send();
    }

    // Создание иконки в верхней панели
    function createIcon() {
        if (iconElement) return;

        // Ищем контейнер для иконок в верхней панели Lampa
        // Класс может отличаться в разных версиях, используем несколько селекторов
        var header = document.querySelector('.head__actions') || 
                     document.querySelector('.head__action') || 
                     document.querySelector('.header__actions');
        
        if (!header) {
            // Если шапки нет (например, мы не на главном экране), пробуем позже
            setTimeout(createIcon, 500);
            return;
        }

        iconElement = document.createElement('div');
        iconElement.className = 'head__action selector vpn-icon-indicator';
        iconElement.innerHTML = VPN_ICON_SVG;
        iconElement.style.cssText = 'display:none; margin-left: 10px; color: #4CD964; align-items: center; justify-content: center;';
        iconElement.title = 'VPN / Non-RU IP';

        // Вставляем в начало панели (или в конец, по вкусу)
        header.insertBefore(iconElement, header.firstChild);
    }

    // Показать/скрыть иконку
    function updateIconVisibility(isNonRu) {
        if (!iconElement) return;
        if (isNonRu) {
            iconElement.style.display = 'flex';
        } else {
            iconElement.style.display = 'none';
        }
    }

    // Основная логика
    function init() {
        if (initialized) return;
        initialized = true;

        // Ждём загрузки интерфейса
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') {
                // Даём Lampa время отрисовать шапку
                setTimeout(function () {
                    createIcon();
                    
                    // Проверяем страну
                    checkCountry(function (countryCode) {
                        if (!countryCode) {
                            // Не удалось определить — не показываем иконку
                            updateIconVisibility(false);
                            return;
                        }
                        // Если код страны НЕ 'RU' — показываем иконку
                        var isNonRu = countryCode.toUpperCase() !== 'RU';
                        updateIconVisibility(isNonRu);
                    });
                }, 1500);
            }
        });

        // Также обновляем при смене экрана (на случай, если шапка пересоздалась)
        Lampa.Listener.follow('activity', function (e) {
            if (e.type === 'complete' || e.type === 'start') {
                setTimeout(function () {
                    if (!iconElement || !document.body.contains(iconElement)) {
                        createIcon();
                    }
                }, 500);
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
