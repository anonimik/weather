(function () {
    'use strict';

    if (window.custom_player_plugin_ready) return;
    window.custom_player_plugin_ready = true;

    var initialized = false;
    var customPlayerEl = null;
    var videoEl = null;

    function init() {
        if (initialized) return;
        initialized = true;

        // --- Стили для кастомного плеера ---
        var style = document.createElement('style');
        style.textContent = `
            #custom-player-overlay {
                position: fixed;
                top: 0; left: 0; width: 100%; height: 100%;
                background: #000;
                z-index: 10000;
                display: none;
                flex-direction: column;
                font-family: Arial, sans-serif;
            }
            #custom-player-overlay.active { display: flex; }
            #custom-player-video {
                flex: 1;
                width: 100%;
                background: #000;
                object-fit: contain;
            }
            .custom-player-controls {
                position: absolute;
                bottom: 0; left: 0; right: 0;
                background: linear-gradient(transparent, rgba(0,0,0,0.8));
                padding: 20px 24px;
                display: flex;
                align-items: center;
                gap: 16px;
                transition: opacity 0.3s;
            }
            .custom-player-controls.hidden { opacity: 0; pointer-events: none; }
            .custom-player-controls button {
                background: none; border: none; color: #fff;
                font-size: 24px; cursor: pointer; padding: 8px;
            }
            .custom-player-progress {
                flex: 1;
                height: 6px;
                background: rgba(255,255,255,0.3);
                border-radius: 3px;
                cursor: pointer;
                position: relative;
            }
            .custom-player-progress-fill {
                height: 100%;
                background: #f00;
                border-radius: 3px;
                width: 0%;
                transition: width 0.1s linear;
            }
            .custom-player-time {
                color: #fff;
                font-size: 14px;
                min-width: 100px;
                text-align: center;
            }
            .custom-player-close {
                position: absolute;
                top: 16px; right: 16px;
                background: rgba(0,0,0,0.6);
                color: #fff; border: none;
                border-radius: 50%;
                width: 40px; height: 40px;
                font-size: 20px;
                cursor: pointer;
                z-index: 10001;
            }
            .custom-player-background {
                position: absolute;
                top: 0; left: 0; width: 100%; height: 100%;
                background-size: cover;
                background-position: center;
                opacity: 0.3;
                filter: blur(20px);
                z-index: -1;
            }
        `;
        document.head.appendChild(style);

        // --- Создание DOM кастомного плеера ---
        function createPlayerDOM() {
            if (customPlayerEl) return;

            customPlayerEl = document.createElement('div');
            customPlayerEl.id = 'custom-player-overlay';
            customPlayerEl.innerHTML = `
                <div class="custom-player-background" id="custom-player-bg"></div>
                <video id="custom-player-video"></video>
                <button class="custom-player-close" id="custom-player-close">✕</button>
                <div class="custom-player-controls" id="custom-player-controls">
                    <button id="custom-player-playpause">▶</button>
                    <span class="custom-player-time" id="custom-player-current">00:00</span>
                    <div class="custom-player-progress" id="custom-player-progress">
                        <div class="custom-player-progress-fill" id="custom-player-progress-fill"></div>
                    </div>
                    <span class="custom-player-time" id="custom-player-total">00:00</span>
                </div>
            `;
            document.body.appendChild(customPlayerEl);

            videoEl = document.getElementById('custom-player-video');
        }

        // --- Форматирование времени ---
        function formatTime(sec) {
            if (isNaN(sec) || !isFinite(sec)) return '00:00';
            var h = Math.floor(sec / 3600);
            var m = Math.floor((sec % 3600) / 60);
            var s = Math.floor(sec % 60);
            if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
            return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
        }

        // --- Обработчики кастомного плеера ---
        function bindPlayerEvents() {
            var playpauseBtn = document.getElementById('custom-player-playpause');
            var progressBar = document.getElementById('custom-player-progress');
            var progressFill = document.getElementById('custom-player-progress-fill');
            var currentTimeEl = document.getElementById('custom-player-current');
            var totalTimeEl = document.getElementById('custom-player-total');
            var closeBtn = document.getElementById('custom-player-close');
            var controlsEl = document.getElementById('custom-player-controls');

            playpauseBtn.onclick = function () {
                if (videoEl.paused) { videoEl.play(); }
                else { videoEl.pause(); }
            };

            videoEl.onplay = function () { playpauseBtn.textContent = '⏸'; };
            videoEl.onpause = function () { playpauseBtn.textContent = '▶'; };

            videoEl.ontimeupdate = function () {
                var pct = videoEl.duration ? (videoEl.currentTime / videoEl.duration) * 100 : 0;
                progressFill.style.width = pct + '%';
                currentTimeEl.textContent = formatTime(videoEl.currentTime);
            };

            videoEl.onloadedmetadata = function () {
                totalTimeEl.textContent = formatTime(videoEl.duration);
            };

            progressBar.onclick = function (e) {
                var rect = progressBar.getBoundingClientRect();
                var pct = (e.clientX - rect.left) / rect.width;
                if (videoEl.duration) videoEl.currentTime = pct * videoEl.duration;
            };

            closeBtn.onclick = function () {
                closeCustomPlayer();
            };

            // Скрытие контролов через 3 секунды бездействия
            var hideTimer;
            function showControls() {
                controlsEl.classList.remove('hidden');
                clearTimeout(hideTimer);
                hideTimer = setTimeout(function () {
                    controlsEl.classList.add('hidden');
                }, 3000);
            }
            customPlayerEl.addEventListener('mousemove', showControls);
            customPlayerEl.addEventListener('touchstart', showControls);
            showControls();
        }

        function openCustomPlayer(data) {
            createPlayerDOM();
            bindPlayerEvents();

            // Фон из постера (если есть)
            var bgEl = document.getElementById('custom-player-bg');
            var poster = data.movie && data.movie.img ? data.movie.img : '';
            if (poster) {
                bgEl.style.backgroundImage = 'url(' + poster + ')';
            } else {
                bgEl.style.backgroundImage = 'none';
            }

            // Устанавливаем источник
            videoEl.src = data.url;
            videoEl.play().catch(function (e) {
                console.warn('[CustomPlayer] autoplay blocked:', e);
            });

            customPlayerEl.classList.add('active');

            // Пауза стандартного плеера, если он успел запуститься
            try {
                if (Lampa.PlayerVideo && Lampa.PlayerVideo.video) {
                    var stdVideo = Lampa.PlayerVideo.video();
                    if (stdVideo) stdVideo.pause();
                }
            } catch (e) {}

            Lampa.Noty.show('Кастомный плеер запущен');
        }

        function closeCustomPlayer() {
            if (videoEl) {
                videoEl.pause();
                videoEl.src = '';
            }
            if (customPlayerEl) {
                customPlayerEl.classList.remove('active');
            }
            // Возврат в Lampa
            try { Lampa.Activity.back(); } catch (e) {}
        }

        // --- Перехват запуска стандартного плеера ---
        Lampa.Player.listener.follow('create', function (data) {
            // data.data — объект воспроизведения
            // data.abort() — отменить стандартный плеер
            data.abort();

            var playData = data.data;
            console.log('[CustomPlayer] intercepted:', playData);

            // Открываем свой плеер
            openCustomPlayer(playData);
        });

        // --- Очистка при выходе ---
        Lampa.Listener.follow('activity', function (e) {
            if (e.type === 'start' && e.component !== 'custom_player') {
                // Если ушли с нашего экрана — закрываем
                if (customPlayerEl && customPlayerEl.classList.contains('active')) {
                    // Не закрываем сразу, чтобы дать Lampa отрисовать фон
                }
            }
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
