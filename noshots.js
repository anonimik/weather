/**
 * No Shots & No Trailers Plugin - Optimized & Safe Version
 */

(function () {
    'use strict';

    if (window.no_shots_trailers_optimized_ready) return;
    window.no_shots_trailers_optimized_ready = true;

    function init() {
        // 1. Отключаем контентные ряды Shots через Storage
        Lampa.Storage.set('content_rows_shots_main', 'false');

        // 2. Блокируем добавление контентных рядов Shots
        if (Lampa.ContentRows && Lampa.ContentRows.add) {
            const originalAdd = Lampa.ContentRows.add;
            Lampa.ContentRows.add = function (row) {
                if (row && row.name === 'shots_main') return;
                if (row && row.screen && Array.isArray(row.screen) && row.screen.indexOf('bookmarks') >= 0) {
                    if (typeof row.call === 'function') {
                        const callStr = row.call.toString();
                        if (callStr.indexOf('shots_title_favorite') >= 0 || 
                            callStr.indexOf('shots_title_created') >= 0 ||
                            (callStr.indexOf('Favorite.get') >= 0 && callStr.indexOf('Created.get') >= 0)) {
                            return;
                        }
                    }
                }
                return originalAdd.call(this, row);
            };
        }

        // 3. Перехват Select.show для фильтрации Shots и Трейлеров из меню "Смотреть"
        if (Lampa.Select && Lampa.Select.show) {
            const originalSelectShow = Lampa.Select.show;
            Lampa.Select.show = function (options) {
                if (options && Array.isArray(options.items)) {
                    options.items = options.items.filter(function (item) {
                        // --- Проверка на Shots ---
                        if (item.btn) {
                            const btn = $(item.btn);
                            if (btn.hasClass('shots-view-button') || btn.find('.shots-view-button__title').length > 0) {
                                return false;
                            }
                        }
                        if (item.title && item.title.toLowerCase().indexOf('shots') >= 0) return false;
                        if (item.icon && item.icon.indexOf('sprite-shots') >= 0) return false;

                        // --- Проверка на Трейлеры ---
                        var titleStr = (item.title || '').toLowerCase();
                        // Проверяем русские и английские названия
                        if (titleStr.indexOf('трейлер') >= 0 || titleStr.indexOf('trailer') >= 0) {
                            return false;
                        }
                        // Некоторые версии Lampa используют иконку или специфичный класс для трейлеров
                        if (item.btn && $(item.btn).hasClass('trailer-button')) {
                            return false;
                        }

                        return true;
                    });
                }
                return originalSelectShow.call(this, options);
            };
        }

        // 4. Внедрение безопасного CSS
        var style = document.createElement('style');
        style.id = 'no-shots-trailers-styles';
        style.textContent = `
            /* Скрываем кнопку Shots из карточки фильма */
            .shots-view-button,
            .full-start__button.shots-view-button,
            .buttons--container .shots-view-button,
            [class*="shots-view"] {
                display: none !important;
            }
            /* Скрываем элементы плеера Shots */
            .shots-player-segments,
            .shots-player-recorder,
            [class*="shots-player"] {
                display: none !important;
            }
            /* Скрываем ряды Shots */
            .line[data-name="shots_main"],
            .line[data-type*="shots"] {
                display: none !important;
            }
            /* Скрываем кнопку Трейлера, если она где-то осталась */
            .full-start__button[data-action="trailer"],
            .trailer-button,
            .button--trailer {
                display: none !important;
            }
        `;
        document.head.appendChild(style);

        // 5. Скрытие кнопки Shots в плеере
        if (Lampa.Listener) {
            Lampa.Listener.follow('player', function (e) {
                if (e.type === 'render' || e.type === 'ready' || e.type === 'open') {
                    setTimeout(function () {
                        $('[data-controller="player_panel"]').each(function () {
                            var $btn = $(this);
                            if ($btn.find('circle[fill="#FF0707"]').length > 0 || 
                                $btn.find('circle[fill="#ff0707"]').length > 0) {
                                $btn.hide();
                            }
                        });
                    }, 100);
                }
            });
        }

        // 6. Очистка меню от кнопки Shots
        if (Lampa.Listener) {
            Lampa.Listener.follow('menu', function (e) {
                if (e.type === 'end' || e.type === 'start') {
                    setTimeout(function () {
                        var menu = Lampa.Menu.render();
                        if (menu && menu.length) {
                            menu.find('.menu__item').each(function () {
                                var $item = $(this);
                                var text = $item.find('.menu__text').text();
                                var hasShotsIcon = $item.find('use[xlink\\:href="#sprite-shots"]').length > 0;
                                if ((text && text.toLowerCase().indexOf('shots') >= 0) || hasShotsIcon) {
                                    $item.hide();
                                }
                            });
                        }
                    }, 50);
                }
            });
        }

        console.log('No Shots & Trailers', 'Optimized plugin initialized');
    }

    if (window.appready) {
        init();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') init();
        });
    }
})();
