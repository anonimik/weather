/**
 * No Shots Plugin - Optimized & Safe Version
 * Убирает функционал Shots без циклической нагрузки на DOM и без поломки других плагинов.
 */

(function () {
    'use strict';

    if (window.no_shots_optimized_ready) return;
    window.no_shots_optimized_ready = true;

    function init() {
        // 1. Отключаем контентные ряды Shots через Storage (самый безопасный метод)
        Lampa.Storage.set('content_rows_shots_main', 'false');

        // 2. Блокируем добавление контентных рядов
        if (Lampa.ContentRows && Lampa.ContentRows.add) {
            const originalAdd = Lampa.ContentRows.add;
            Lampa.ContentRows.add = function (row) {
                if (row && row.name === 'shots_main') {
                    return; // Не добавляем
                }
                if (row && row.screen && Array.isArray(row.screen) && row.screen.indexOf('bookmarks') >= 0) {
                    if (typeof row.call === 'function') {
                        const callStr = row.call.toString();
                        if (callStr.indexOf('shots_title_favorite') >= 0 || 
                            callStr.indexOf('shots_title_created') >= 0 ||
                            (callStr.indexOf('Favorite.get') >= 0 && callStr.indexOf('Created.get') >= 0)) {
                            return; // Не добавляем
                        }
                    }
                }
                return originalAdd.call(this, row);
            };
        }

        // 3. Перехват Select.show для фильтрации Shots из меню "Смотреть"
        if (Lampa.Select && Lampa.Select.show) {
            const originalSelectShow = Lampa.Select.show;
            Lampa.Select.show = function (options) {
                if (options && Array.isArray(options.items)) {
                    options.items = options.items.filter(function (item) {
                        // Проверка по классу кнопки
                        if (item.btn) {
                            const btn = $(item.btn);
                            if (btn.hasClass('shots-view-button') || btn.find('.shots-view-button__title').length > 0) {
                                return false;
                            }
                        }
                        // Проверка по тексту
                        if (item.title && item.title.toLowerCase().indexOf('shots') >= 0) {
                            return false;
                        }
                        // Проверка по иконке
                        if (item.icon && item.icon.indexOf('sprite-shots') >= 0) {
                            return false;
                        }
                        return true;
                    });
                }
                return originalSelectShow.call(this, options);
            };
        }

        // 4. Внедрение безопасного CSS (скрывает элементы, а не удаляет их из DOM)
        var style = document.createElement('style');
        style.id = 'no-shots-styles-optimized';
        style.textContent = `
            /* Скрываем кнопку из карточки фильма */
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
            /* Скрываем ряды в главном меню, если они как-то пролезли */
            .line[data-name="shots_main"],
            .line[data-type*="shots"] {
                display: none !important;
            }
        `;
        document.head.appendChild(style);

        // 5. Точечное скрытие кнопки в плеере (без setInterval и без удаления по цвету)
        if (Lampa.Listener) {
            Lampa.Listener.follow('player', function (e) {
                if (e.type === 'render' || e.type === 'ready' || e.type === 'open') {
                    // Ищем кнопку Shots в панели плеера и скрываем её
                    setTimeout(function () {
                        $('[data-controller="player_panel"]').each(function () {
                            var $btn = $(this);
                            // Проверка по наличию красного круга (иконка записи), 
                            // НО только внутри панели плеера, чтобы не задеть другие кнопки
                            if ($btn.find('circle[fill="#FF0707"]').length > 0 || 
                                $btn.find('circle[fill="#ff0707"]').length > 0) {
                                $btn.hide(); // Скрываем, а не удаляем
                            }
                        });
                    }, 100);
                }
            });
        }

        // 6. Очистка меню от кнопки Shots при его отрисовке (событие вместо setInterval)
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
                                    $item.hide(); // Скрываем, а не удаляем
                                }
                            });
                        }
                    }, 50);
                }
            });
        }

        console.log('No Shots', 'Optimized plugin initialized');
    }

    if (window.appready) {
        init();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') init();
        });
    }
})();
