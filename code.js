(function () {
    'use strict';

    if (window.fall_effects_plugin_ready) return;
    window.fall_effects_plugin_ready = true;

    var initialized = false;

    function init() {
        if (initialized) return;
        initialized = true;

        // --- 1. Регистрация раздела ---
        Lampa.SettingsApi.addComponent({
            component: 'fall_effects',
            name: 'Праздничные эффекты',
            icon: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2l2.4 7.2h7.6l-6 4.8 2.4 7.2-6-4.8-6 4.8 2.4-7.2-6-4.8h7.6z"/></svg>'
        });

        Lampa.SettingsApi.addParam({
            component: 'fall_effects',
            param: {
                name: 'fall_effects_halloween',
                type: 'trigger',
                default: false
            },
            field: {
                name: 'Хэллоуин (листья)',
                description: 'Включить падающие мультяшные листья'
            },
            onChange: function () {
                // даём Lampa записать значение в Storage
                setTimeout(updateEffects, 50);
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'fall_effects',
            param: {
                name: 'fall_effects_snow',
                type: 'trigger',
                default: false
            },
            field: {
                name: 'Снег (снеговики)',
                description: 'Включить падающий снег и снеговиков'
            },
            onChange: function () {
                setTimeout(updateEffects, 50);
            }
        });

        // --- 2. Canvas ---
        var canvas = document.createElement('canvas');
        canvas.id = 'fall-effects-canvas';
        canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:999;display:none;';
        document.body.appendChild(canvas);

        var ctx = canvas.getContext('2d');
        var particles = [];
        var animationId = null;
        var currentMode = 'none';

        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        // --- 3. Частицы ---
        function Particle(mode) {
            this.mode = mode;
            this.reset(true);
        }

        Particle.prototype.reset = function (init) {
            this.x = Math.random() * canvas.width;
            this.y = init ? Math.random() * canvas.height : -50;
            this.size = this.mode === 'halloween' ? (8 + Math.random() * 12) : (5 + Math.random() * 10);
            this.speedY = this.mode === 'halloween' ? (1 + Math.random() * 2) : (0.5 + Math.random() * 1.5);
            this.speedX = (Math.random() - 0.5) * 1.5;
            this.rotation = Math.random() * Math.PI * 2;
            this.rotSpeed = (Math.random() - 0.5) * 0.05;

            if (this.mode === 'halloween') {
                var colors = ['#FF8C00', '#FF4500', '#DAA520', '#8B4513', '#CD853F'];
                this.color = colors[Math.floor(Math.random() * colors.length)];
                this.type = 'leaf';
            } else {
                this.type = Math.random() < 0.15 ? 'snowman' : 'flake';
                this.color = 'white';
                if (this.type === 'snowman') {
                    this.size = 20 + Math.random() * 15;
                }
            }
        };

        Particle.prototype.update = function () {
            this.y += this.speedY;
            this.x += this.speedX;
            this.rotation += this.rotSpeed;

            if (this.y > canvas.height + 50 || this.x < -50 || this.x > canvas.width + 50) {
                this.reset(false);
            }
        };

        Particle.prototype.draw = function (ctx) {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.rotation);
            ctx.globalAlpha = 0.8;

            if (this.mode === 'halloween' && this.type === 'leaf') {
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.ellipse(0, 0, this.size, this.size * 0.6, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = 'rgba(0,0,0,0.2)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(0, -this.size * 0.4);
                ctx.lineTo(0, this.size * 0.4);
                ctx.stroke();
            } else if (this.mode === 'snow') {
                if (this.type === 'flake') {
                    ctx.fillStyle = this.color;
                    ctx.beginPath();
                    ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
                    ctx.fill();
                } else if (this.type === 'snowman') {
                    var s = this.size / 2;
                    ctx.fillStyle = 'white';
                    ctx.beginPath();
                    ctx.arc(0, s * 0.5, s * 0.7, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.beginPath();
                    ctx.arc(0, -s * 0.2, s * 0.5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = 'black';
                    ctx.beginPath();
                    ctx.arc(-s * 0.15, -s * 0.25, s * 0.08, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.beginPath();
                    ctx.arc(s * 0.15, -s * 0.25, s * 0.08, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#FF8C00';
                    ctx.beginPath();
                    ctx.moveTo(0, -s * 0.1);
                    ctx.lineTo(s * 0.3, 0);
                    ctx.lineTo(0, s * 0.05);
                    ctx.closePath();
                    ctx.fill();
                }
            }
            ctx.restore();
        };

        // --- 4. Анимация ---
        function startAnimation(mode) {
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
            particles = [];
            currentMode = mode;

            if (mode === 'none') {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                canvas.style.display = 'none';
                return;
            }

            canvas.style.display = 'block';
            var count = mode === 'halloween' ? 40 : 60;
            for (var i = 0; i < count; i++) {
                particles.push(new Particle(mode));
            }

            function loop() {
                if (currentMode !== mode) return; // защита от устаревшего цикла
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                for (var i = 0; i < particles.length; i++) {
                    particles[i].update();
                    particles[i].draw(ctx);
                }
                animationId = requestAnimationFrame(loop);
            }
            loop();
        }

        function updateEffects() {
            var halloween = Lampa.Storage.get('fall_effects_halloween', false);
            var snow = Lampa.Storage.get('fall_effects_snow', false);

            var target = 'none';
            if (snow) target = 'snow';
            else if (halloween) target = 'halloween';

            if (target !== currentMode) startAnimation(target);
        }

        // Применяем сохранённые настройки
        setTimeout(updateEffects, 1000);
    }

    if (window.appready) {
        init();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') init();
        });
    }
})();
