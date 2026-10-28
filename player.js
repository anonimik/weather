(function () {
    'use strict';

    if (window.custom_player_plugin_ready) return;
    window.custom_player_plugin_ready = true;

    var initialized = false;
    var customPlayerEl = null;
    var videoEl = null;
    var previewVideo = null; // Скрытое видео для превью
    var previewCanvas = null;
    var previewCtx = null;

    // Состояние плеера
    var isSeeking = false;
    var seekTargetTime = 0;
    var controlsTimeout = null;
    var activeMenu = null; // 'quality' | 'speed' | null
    var availableQualities = [];
    var currentQuality = 'auto';

    function init() {
        if (initialized) return;
        initialized = true;

        // --- Стили ---
        var style = document.createElement('style');
        style.textContent = `
            #custom-player-overlay {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: #000; z-index: 10000; display: none;
                flex-direction: column; font-family: 'Roboto', Arial, sans-serif;
                color: #fff; outline: none;
            }
            #custom-player-overlay.active { display: flex; }
            #custom-player-video { flex: 1; width: 100%; background: #000; object-fit: contain; }
            
            /* Верхняя панель */
            .custom-player-top {
                position: absolute; top: 0; left: 0; right: 0;
                padding: 20px 32px;
                background: linear-gradient(to bottom, rgba(0,0,0,0.8), transparent);
                display: flex; justify-content: space-between; align-items: center;
                transition: opacity 0.3s;
                opacity: 0; pointer-events: none;
            }
            .custom-player-top.visible { opacity: 1; pointer-events: auto; }
            .custom-player-title { font-size: 20px; font-weight: 500; text-shadow: 0 1px 2px #000; }
            .custom-player-close-btn {
                background: rgba(255,255,255,0.1); border: none; color: #fff;
                font-size: 24px; cursor: pointer; padding: 8px 12px; border-radius: 4px;
            }
            .custom-player-close-btn:focus { background: rgba(255,255,255,0.3); outline: 2px solid #fff; }

            /* Нижняя панель */
            .custom-player-bottom {
                position: absolute; bottom: 0; left: 0; right: 0;
                background: linear-gradient(to top, rgba(0,0,0,0.9), transparent);
                padding: 40px 32px 20px;
                transition: opacity 0.3s;
                opacity: 0; pointer-events: none;
                display: flex; flex-direction: column; gap: 12px;
            }
            .custom-player-bottom.visible { opacity: 1; pointer-events: auto; }

            /* Прогресс-бар */
            .progress-container {
                position: relative; height: 6px; background: rgba(255,255,255,0.3);
                border-radius: 3px; cursor: pointer; margin-bottom: 8px;
            }
            .progress-fill {
                position: absolute; top: 0; left: 0; height: 100%;
                background: #f00; border-radius: 3px; width: 0%;
            }
            .progress-thumb {
                position: absolute; top: 50%; transform: translate(-50%, -50%);
                width: 16px; height: 16px; background: #f00; border-radius: 50%;
                box-shadow: 0 0 4px rgba(0,0,0,0.5); display: none;
            }
            .progress-container:hover .progress-thumb,
            .progress-container.focused .progress-thumb { display: block; }
            .progress-container.focused { outline: 2px solid #f00; outline-offset: 4px; }

            /* Превью кадра */
            #preview-popup {
                position: absolute; bottom: 30px; left: 0;
                width: 160px; height: 90px;
                background: #000; border: 2px solid #fff; border-radius: 4px;
                display: none; z-index: 10002; overflow: hidden;
                transform: translateX(-50%); box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            }
            #preview-popup.visible { display: block; }
            #preview-popup canvas { width: 100%; height: 100%; object-fit: cover; }
            #preview-time {
                position: absolute; bottom: 4px; left: 0; right: 0;
                text-align: center; font-size: 12px; background: rgba(0,0,0,0.7);
                padding: 2px;
            }

            /* Контролы */
            .controls-row { display: flex; align-items: center; justify-content: space-between; }
            .controls-left, .controls-right { display: flex; align-items: center; gap: 16px; }
            .ctrl-btn {
                background: none; border: none; color: #fff;
                font-size: 24px; cursor: pointer; padding: 8px;
                border-radius: 4px; display: flex; align-items: center; justify-content: center;
            }
            .ctrl-btn:focus { background: rgba(255,255,255,0.2); outline: 2px solid #fff; }
            .time-display { font-size: 14px; font-variant-numeric: tabular-nums; }
            .menu-btn { font-size: 14px; font-weight: 500; padding: 6px 12px; border: 1px solid rgba(255,255,255,0.5); border-radius: 4px; }
            .menu-btn:focus { background: #fff; color: #000; border-color: #fff; }

            /* Меню (качество/скорость) */
            .custom-menu {
                position: absolute; bottom: 80px; right: 32px;
                background: rgba(20,20,20,0.95); border-radius: 8px;
                padding: 8px 0; min-width: 160px; display: none; z-index: 10003;
                box-shadow: 0 4px 20px rgba(0,0,0,0.6);
            }
            .custom-menu.visible { display: block; }
            .menu-item {
                padding: 10px 16px; font-size: 14px; cursor: pointer;
                display: flex; justify-content: space-between; align-items: center;
            }
            .menu-item:hover, .menu-item:focus { background: rgba(255,255,255,0.15); outline: none; }
            .menu-item.active { color: #f00; font-weight: bold; }
            .menu-item .check { visibility: hidden; margin-left: 8px; }
            .menu-item.active .check { visibility: visible; }
        `;
        document.head.appendChild(style);

        // --- DOM ---
        function createPlayerDOM() {
            if (customPlayerEl) return;

            customPlayerEl = document.createElement('div');
            customPlayerEl.id = 'custom-player-overlay';
            customPlayerEl.tabIndex = 0;
            customPlayerEl.innerHTML = `
                <video id="custom-player-video" crossorigin="anonymous"></video>
                <div class="custom-player-top" id="custom-player-top">
                    <div class="custom-player-title" id="custom-player-title">Название</div>
                    <button class="custom-player-close-btn" id="custom-player-close">✕</button>
                </div>
                <div class="custom-player-bottom" id="custom-player-bottom">
                    <div class="progress-container" id="progress-container">
                        <div class="progress-fill" id="progress-fill"></div>
                        <div class="progress-thumb" id="progress-thumb"></div>
                    </div>
                    <div class="controls-row">
                        <div class="controls-left">
                            <button class="ctrl-btn" id="btn-playpause">▶</button>
                            <button class="ctrl-btn" id="btn-rewind">⏪</button>
                            <button class="ctrl-btn" id="btn-forward">⏩</button>
                            <span class="time-display" id="time-current">00:00</span>
                            <span class="time-display">/</span>
                            <span class="time-display" id="time-total">00:00</span>
                        </div>
                        <div class="controls-right">
                            <button class="ctrl-btn menu-btn" id="btn-quality">Авто</button>
                            <button class="ctrl-btn menu-btn" id="btn-speed">1x</button>
                        </div>
                    </div>
                </div>
                <div id="preview-popup">
                    <canvas id="preview-canvas" width="160" height="90"></canvas>
                    <div id="preview-time">00:00</div>
                </div>
                <div class="custom-menu" id="menu-quality">
                    <div class="menu-item" data-val="auto">Авто <span class="check">✓</span></div>
                </div>
                <div class="custom-menu" id="menu-speed">
                    <div class="menu-item" data-val="0.5">0.5x <span class="check">✓</span></div>
                    <div class="menu-item" data-val="1" data-default="true">1x <span class="check">✓</span></div>
                    <div class="menu-item" data-val="1.5">1.5x <span class="check">✓</span></div>
                    <div class="menu-item" data-val="2">2x <span class="check">✓</span></div>
                </div>
            `;
            document.body.appendChild(customPlayerEl);

            videoEl = document.getElementById('custom-player-video');
            previewCanvas = document.getElementById('preview-canvas');
            previewCtx = previewCanvas.getContext('2d');

            // Скрытое видео для превью
            previewVideo = document.createElement('video');
            previewVideo.crossOrigin = 'anonymous';
            previewVideo.muted = true;
            previewVideo.style.display = 'none';
            document.body.appendChild(previewVideo);
        }

        // --- Утилиты ---
        function formatTime(sec) {
            if (isNaN(sec) || !isFinite(sec)) return '00:00';
            var h = Math.floor(sec / 3600);
            var m = Math.floor((sec % 3600) / 60);
            var s = Math.floor(sec % 60);
            if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
            return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
        }

        // --- Управление видимостью ---
        function showControls() {
            document.getElementById('custom-player-top').classList.add('visible');
            document.getElementById('custom-player-bottom').classList.add('visible');
            clearTimeout(controlsTimeout);
            controlsTimeout = setTimeout(function () {
                if (!isSeeking && !activeMenu) {
                    document.getElementById('custom-player-top').classList.remove('visible');
                    document.getElementById('custom-player-bottom').classList.remove('visible');
                }
            }, 3000);
        }

        function hideControls() {
            document.getElementById('custom-player-top').classList.remove('visible');
            document.getElementById('custom-player-bottom').classList.remove('visible');
        }

        // --- Превью ---
        function updatePreview(time) {
            var popup = document.getElementById('preview-popup');
            var timeEl = document.getElementById('preview-time');
            var progressContainer = document.getElementById('progress-container');
            
            if (!previewVideo.src) return;

            // Позиционирование
            var rect = progressContainer.getBoundingClientRect();
            var pct = time / videoEl.duration;
            var left = pct * rect.width;
            popup.style.left = left + 'px';
            popup.style.bottom = (window.innerHeight - rect.top + 10) + 'px';
            popup.classList.add('visible');
            timeEl.textContent = formatTime(time);

            // Установка времени и отрисовка
            if (Math.abs(previewVideo.currentTime - time) > 0.5) {
                previewVideo.currentTime = time;
                // Отрисовка после seeked
                previewVideo.onseeked = function () {
                    previewCtx.drawImage(previewVideo, 0, 0, previewCanvas.width, previewCanvas.height);
                    previewVideo.onseeked = null;
                };
            }
        }

        // --- Навигация D-pad ---
        var focusableElements = [];
        var currentFocusIndex = 0;

        function updateFocusables() {
            focusableElements = Array.from(customPlayerEl.querySelectorAll('button, .menu-item, .progress-container'));
            // Фильтруем скрытые
            focusableElements = focusableElements.filter(function (el) {
                return el.offsetParent !== null;
            });
        }

        function focusElement(el) {
            focusableElements.forEach(function (e) { e.blur(); });
            el.focus();
            currentFocusIndex = focusableElements.indexOf(el);
        }

        function moveFocus(direction) {
            updateFocusables();
            if (focusableElements.length === 0) return;
            var current = document.activeElement;
            var idx = focusableElements.indexOf(current);
            
            if (idx === -1) {
                focusElement(focusableElements[0]);
                return;
            }

            var nextIdx = idx;
            if (direction === 'right' || direction === 'down') {
                nextIdx = (idx + 1) % focusableElements.length;
            } else if (direction === 'left' || direction === 'up') {
                nextIdx = (idx - 1 + focusableElements.length) % focusableElements.length;
            }
            focusElement(focusableElements[nextIdx]);
        }

        // --- Привязка событий ---
        function bindPlayerEvents() {
            // Кнопки
            document.getElementById('btn-playpause').onclick = function () {
                if (videoEl.paused) videoEl.play(); else videoEl.pause();
            };
            document.getElementById('btn-rewind').onclick = function () {
                videoEl.currentTime = Math.max(0, videoEl.currentTime - 10);
            };
            document.getElementById('btn-forward').onclick = function () {
                videoEl.currentTime = Math.min(videoEl.duration, videoEl.currentTime + 10);
            };
            document.getElementById('custom-player-close').onclick = function () {
                closeCustomPlayer();
            };

            // Видео события
            videoEl.onplay = function () { document.getElementById('btn-playpause').textContent = '⏸'; };
            videoEl.onpause = function () { document.getElementById('btn-playpause').textContent = '▶'; };
            
            videoEl.ontimeupdate = function () {
                if (!videoEl.duration) return;
                var pct = (videoEl.currentTime / videoEl.duration) * 100;
                document.getElementById('progress-fill').style.width = pct + '%';
                document.getElementById('time-current').textContent = formatTime(videoEl.currentTime);
            };

            videoEl.onloadedmetadata = function () {
                document.getElementById('time-total').textContent = formatTime(videoEl.duration);
            };

            // Прогресс-бар: клик
            var progressContainer = document.getElementById('progress-container');
            progressContainer.onclick = function (e) {
                var rect = progressContainer.getBoundingClientRect();
                var pct = (e.clientX - rect.left) / rect.width;
                if (videoEl.duration) videoEl.currentTime = pct * videoEl.duration;
            };

            // Прогресс-бар: перемотка с превью (мышь)
            progressContainer.onmousemove = function (e) {
                if (!videoEl.duration) return;
                var rect = progressContainer.getBoundingClientRect();
                var pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                var time = pct * videoEl.duration;
                updatePreview(time);
            };
            progressContainer.onmouseleave = function () {
                document.getElementById('preview-popup').classList.remove('visible');
            };

            // Меню качества
            document.getElementById('btn-quality').onclick = function () {
                toggleMenu('menu-quality');
            };
            // Меню скорости
            document.getElementById('btn-speed').onclick = function () {
                toggleMenu('menu-speed');
            };

            // Обработка пунктов меню
            document.querySelectorAll('.menu-item').forEach(function (item) {
                item.onclick = function () {
                    var parent = item.parentElement;
                    if (parent.id === 'menu-speed') {
                        var speed = parseFloat(item.dataset.val);
                        videoEl.playbackRate = speed;
                        document.getElementById('btn-speed').textContent = speed + 'x';
                    } else if (parent.id === 'menu-quality') {
                        var q = item.dataset.val;
                        currentQuality = q;
                        document.getElementById('btn-quality').textContent = q === 'auto' ? 'Авто' : q;
                        // Здесь логика переключения качества (зависит от источника)
                        console.log('Quality changed to', q);
                    }
                    parent.classList.remove('visible');
                    activeMenu = null;
                    showControls();
                    updateFocusables();
                };
            });

            // D-pad
            customPlayerEl.onkeydown = function (e) {
                var key = e.keyCode || e.which;
                showControls();

                // Стрелки
                if (key === 37) { moveFocus('left'); e.preventDefault(); }
                else if (key === 39) { moveFocus('right'); e.preventDefault(); }
                else if (key === 38) { moveFocus('up'); e.preventDefault(); }
                else if (key === 40) { moveFocus('down'); e.preventDefault(); }
                
                // Enter / OK
                else if (key === 13) {
                    if (document.activeElement) {
                        document.activeElement.click();
                    }
                    e.preventDefault();
                }
                
                // Back / Escape
                else if (key === 27 || key === 8 || key === 461) {
                    if (activeMenu) {
                        document.querySelectorAll('.custom-menu.visible').forEach(function (m) { m.classList.remove('visible'); });
                        activeMenu = null;
                    } else {
                        closeCustomPlayer();
                    }
                    e.preventDefault();
                }

                // Медиа-кнопки
                else if (key === 179 || key === 415) { // Play/Pause
                    if (videoEl.paused) videoEl.play(); else videoEl.pause();
                    e.preventDefault();
                }
                else if (key === 177) { // Rewind
                    videoEl.currentTime = Math.max(0, videoEl.currentTime - 10);
                    e.preventDefault();
                }
                else if (key === 176) { // Forward
                    videoEl.currentTime = Math.min(videoEl.duration, videoEl.currentTime + 10);
                    e.preventDefault();
                }
            };

            // Фокус по умолчанию
            setTimeout(function () {
                var playBtn = document.getElementById('btn-playpause');
                if (playBtn) focusElement(playBtn);
            }, 100);
        }

        function toggleMenu(menuId) {
            var menu = document.getElementById(menuId);
            var isVisible = menu.classList.contains('visible');
            document.querySelectorAll('.custom-menu').forEach(function (m) { m.classList.remove('visible'); });
            
            if (!isVisible) {
                menu.classList.add('visible');
                activeMenu = menuId;
                updateFocusables();
                // Фокус на первом элементе меню
                var first = menu.querySelector('.menu-item');
                if (first) focusElement(first);
            } else {
                activeMenu = null;
                updateFocusables();
            }
        }

        // --- Открытие / Закрытие ---
        function openCustomPlayer(data) {
            createPlayerDOM();
            bindPlayerEvents();

            var title = data.movie ? (data.movie.title || data.movie.name || 'Видео') : 'Видео';
            document.getElementById('custom-player-title').textContent = title;

            videoEl.src = data.url;
            previewVideo.src = data.url; // Для превью
            
            videoEl.play().catch(function (e) { console.warn('[CustomPlayer] autoplay blocked:', e); });

            customPlayerEl.classList.add('active');
            customPlayerEl.focus();
            showControls();

            // Пауза стандартного плеера
            try {
                if (Lampa.PlayerVideo && Lampa.PlayerVideo.video) {
                    var stdVideo = Lampa.PlayerVideo.video();
                    if (stdVideo) stdVideo.pause();
                }
            } catch (e) {}

            Lampa.Noty.show('Плеер запущен');
        }

        function closeCustomPlayer() {
            if (videoEl) { videoEl.pause(); videoEl.src = ''; }
            if (previewVideo) { previewVideo.pause(); previewVideo.src = ''; }
            if (customPlayerEl) {
                customPlayerEl.classList.remove('active');
                hideControls();
                document.querySelectorAll('.custom-menu').forEach(function (m) { m.classList.remove('visible'); });
                activeMenu = null;
            }
            try { Lampa.Activity.back(); } catch (e) {}
        }

        // --- Перехват ---
        Lampa.Player.listener.follow('create', function (data) {
            data.abort();
            openCustomPlayer(data.data);
        });

        console.log('[CustomPlayer] Plugin loaded.');
    }

    if (window.appready) {
        init();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') init();
        });
    }
})();
