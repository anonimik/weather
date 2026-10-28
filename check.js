(function () {
    'use strict';

    if (window.vpn_icon_plugin_ready) return;
    window.vpn_icon_plugin_ready = true;

    var initialized = false;
    var iconElement = null;
    var isNonRuCached = null; // Кэш для хранения результата проверки

    // SVG-иконка в стиле iOS (щит)
    var VPN_ICON_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" style="vertical-align: middle;"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>';

    // Проверка страны через публичный API
    function checkCountry(callback) {
        // Если результат уже есть в кэше, отдаем его
        if (isNonRuCached !== null) {
            callback(isNonRuCached);
            return;
        }

        var xhr = new XMLHttpRequest();
        xhr.open('GET', 'https://ipapi.co/json/', true);
        xhr.timeout = 5000;
        xhr.onload = function () {
            if (xhr.status === 200) {
                try {
                    var data = JSON.parse(xhr.responseText);
                    var countryCode = data.country_code || '';
                    isNonRuCached = countryCode.toUpperCase() !== 'RU';
                    callback(isNonRuCached);
                } catch (e) {
                    callback(false);
                }
            } else {
                callback(false);
            }
        };
        xhr.onerror = function () { callback(false); };
        xhr.ontimeout = function () { callback(false); };
        xhr.send();
    }

    // Создание иконки
    function createIcon() {
        if (iconElement && document.body.contains(iconElement)) return; // Уже создана

        // Ищем кнопку поиска по SVG-пути (лупа)
        var searchIcon = document.querySelector('svg path[d^="M15.5 14h-.79l-.28-.27"]') || 
                         document.querySelector('svg path[d^="M15.5"]');
        
        var anchor = null;

        if (searchIcon) {
            // Находим родительский кликабельный элемент кнопки
            anchor = searchIcon.closest('.head__action') || searchIcon.parentElement.parentElement;
        } else {
            // Фолбэк: если лупу не нашли, ищем контейнер с иконками
            var headerActions = document.querySelector('.head__actions');
            if (headerActions) {
                anchor = headerActions.firstElementChild; 
            }
        }

        if (!anchor) {
            setTimeout(createIcon, 500);
            return;
        }

        if (iconElement) iconElement.remove();

        iconElement = document.createElement('div');
        iconElement.className = anchor.className; // Копируем стили кнопки (отступы, ховеры)
        iconElement.innerHTML = VPN_ICON_SVG;
        // Зеленый цвет для наглядности
        iconElement.style.cssText = 'display:none; color: #4CD964; align-items: center; justify-content: center; cursor: default;';
        iconElement.title = 'VPN / Non-RU IP';

        // Вставляем СРАЗУ ПОСЛЕ кнопки поиска
        anchor.parentNode.insertBefore(iconElement, anchor.nextSibling);
        
        // Если страна уже определена, сразу показываем/скрываем
        if (isNonRuCached !== null) {
            updateIconVisibility(isNonRuCached);
        }
    }

    // Показать/скрыть иконку
    function updateIconVisibility(isNonRu) {
        if (!iconElement) return;
        iconElement.style.display = isNonRu ? 'flex' : 'none';
    }

    // Основная логика
    function init() {
        if (initialized) return;
        initialized = true;

        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') {
                setTimeout(function () {
                    createIcon();
                    checkCountry(function (isNonRu) {
                        updateIconVisibility(isNonRu);
                    });
                }, 1500);
            }
        });

        // Обновляем при переходах (если Lampa перерисовала шапку)
        Lampa.Listener.follow('activity', function (e) {
            if (e.type === 'complete' || e.type === 'start') {
                setTimeout(function () {
                    createIcon();
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
