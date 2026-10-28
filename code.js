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
                name: 'Хэллоуин (листья и тыквы)',
                description: 'Включить падающие листья и тыквы'
            },
            onChange: function () {
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
        var desiredMode = 'none';

        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        // --- Проверка: активен ли плеер ---
        function isPlayerScreen() {
            try {
                var active = Lampa.Activity.active();
                if (!active) return false;
                return active.component === 'player' || active.component === 'tv';
            } catch (e) {
                return false;
            }
        }

        // --- 3. Частицы ---
        function Particle(mode) {
            this.mode = mode;
            this.reset(true);
        }

        Particle.prototype.reset = function (init) {
            this.x = Math.random() * canvas.width;
            this.y = init ? Math.random() * canvas.height : -60;
            this.rotation = Math.random() * Math.PI * 2;
            this.rotSpeed = (Math.random() - 0.5) * 0.05;
            this.speedX = (Math.random() - 0.5) * 1.5;

            if (this.mode === 'halloween') {
                this.type = Math.random() < 0.18 ? 'pumpkin' : 'leaf';
                if (this.type === 'pumpkin') {
                    this.size = 18 + Math.random() * 14;
                    this.speedY = 0.6 + Math.random() * 1.2;
                } else {
                    this.size = 14 + Math.random() * 14;
                    this.speedY = 1 + Math.random() * 2;
                    var colors = ['#FF8C00', '#FF4500', '#DAA520', '#8B4513', '#CD853F', '#B22222'];
                    this.color = colors[Math.floor(Math.random() * colors.length)];
                }
            } else {
                this.type = Math.random() < 0.15 ? 'snowman' : 'flake';
                this.color = 'white';
                this.size = this.type === 'snowman' ? (20 + Math.random() * 15) : (5 + Math.random() * 10);
                this.speedY = 0.5 + Math.random() * 1.5;
            }
        };

        Particle.prototype.update = function () {
            this.y += this.speedY;
            this.x += this.speedX;
            this.rotation += this.rotSpeed;

            if (this.y > canvas.height + 60 || this.x < -60 || this.x > canvas.width + 60) {
                this.reset(false);
            }
        };

        function drawLeafVeins(ctx, size) {
            ctx.strokeStyle = 'rgba(60, 30, 0, 0.45)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, -size * 0.55);
            ctx.lineTo(0, size * 0.55);
            ctx.stroke();
            var pairs = [
                [-0.35, -0.25], [-0.45, 0.05], [-0.35, 0.35]
            ];
            for (var i = 0; i < pairs.length; i++) {
                var dy = pairs[i][0] * size;
                var len = Math.abs(pairs[i][1]) * size;
                ctx.beginPath();
                ctx.moveTo(0, dy);
                ctx.lineTo(len, dy + size * 0.12);
                ctx.moveTo(0, dy);
                ctx.lineTo(-len, dy + size * 0.12);
                ctx.stroke();
            }
        }

        function drawLeafShape(ctx, size) {
            ctx.beginPath();
            ctx.moveTo(0, -size * 0.6);
            ctx.lineTo(size * 0.15, -size * 0.3);
            ctx.lineTo(size * 0.45, -size * 0.35);
            ctx.lineTo(size * 0.3, -size * 0.05);
            ctx.lineTo(size * 0.55, size * 0.1);
            ctx.lineTo(size * 0.25, size * 0.2);
            ctx.lineTo(size * 0.35, size * 0.55);
            ctx.lineTo(0, size * 0.4);
            ctx.lineTo(-size * 0.35, size * 0.55);
            ctx.lineTo(-size * 0.25, size * 0.2);
            ctx.lineTo(-size * 0.55, size * 0.1);
            ctx.lineTo(-size * 0.3, -size * 0.05);
            ctx.lineTo(-size * 0.45, -size * 0.35);
            ctx.lineTo(-size * 0.15, -size * 0.3);
            ctx.closePath();
        }

        Particle.prototype.draw = function (ctx) {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.rotation);

            if (this.mode === 'halloween' && this.type === 'leaf') {
                ctx.globalAlpha = 0.9;
                ctx.fillStyle = this.color;
                drawLeafShape(ctx, this.size);
                ctx.fill();
                ctx.strokeStyle = 'rgba(60, 30, 0, 0.25)';
                ctx.lineWidth = 1;
                drawLeafShape(ctx, this.size);
                ctx.stroke();
                drawLeafVeins(ctx, this.size);
            } else if (this.mode === 'halloween' && this.type === 'pumpkin') {
                ctx.globalAlpha = 0.95;
                var r = this.size * 0.5;

                ctx.fillStyle = '#3B2412';
                ctx.fillRect(-r * 0.12, -r * 1.15, r * 0.24, r * 0.35);

                ctx.fillStyle = '#F57C00';
                ctx.beginPath();
                ctx.ellipse(0, 0, r, r * 0.85, 0, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = 'rgba(180, 80, 0, 0.55)';
                ctx.lineWidth = Math.max(1, r * 0.08);
                var slices = [-0.55, 0, 0.55];
                for (var i = 0; i < slices.length; i++) {
                    ctx.beginPath();
                    ctx.ellipse(0, 0, r * (1 - Math.abs(slices[i]) * 0.5), r * 0.85, 0, Math.PI * 0.55, Math.PI * 1.45);
                    ctx.stroke();
                }

                ctx.fillStyle = '#2B1A0A';
                var eyeY = -r * 0.15;
                var eyeDx = r * 0.32;
                var eyeSize = r * 0.22;
                ctx.beginPath();
                ctx.moveTo(-eyeDx, eyeY - eyeSize * 0.5);
                ctx.lineTo(-eyeDx - eyeSize * 0.5, eyeY + eyeSize * 0.4);
                ctx.lineTo(-eyeDx + eyeSize * 0.5, eyeY + eyeSize * 0.4);
                ctx.closePath();
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(eyeDx, eyeY - eyeSize * 0.5);
                ctx.lineTo(eyeDx - eyeSize * 0.5, eyeY + eyeSize * 0.4);
                ctx.lineTo(eyeDx + eyeSize * 0.5, eyeY + eyeSize * 0.4);
                ctx.closePath();
                ctx.fill();

                ctx.beginPath();
                var mouthY = r * 0.35;
                var mouthW = r * 0.55;
                ctx.moveTo(-mouthW, mouthY);
                var steps = 4;
                for (var j = 1; j <= steps; j++) {
                    var px = -mouthW + (2 * mouthW) * (j / steps);
                    var py = mouthY + ((j % 2 === 0) ? r * 0.12 : 0);
                    ctx.lineTo(px, py);
                }
                ctx.lineTo(mouthW, mouthY);
                ctx.strokeStyle = '#2B1A0A';
                ctx.lineWidth = Math.max(1.5, r * 0.12);
                ctx.stroke();
            } else if (this.mode === 'snow') {
                ctx.globalAlpha = 0.8;
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
            var count = mode === 'halloween' ? 45 : 60;
            for (var i = 0; i < count; i++) {
                particles.push(new Particle(mode));
            }

            function loop() {
                if (currentMode !== mode) return;
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
            var halloween = Lampa.Storage.field('fall_effects_halloween');
            var snow = Lampa.Storage.field('fall_effects_snow');

            var target = 'none';
            if (snow) target = 'snow';
            else if (halloween) target = 'halloween';

            desiredMode = target;

            if (isPlayerScreen()) {
                if (currentMode !== 'none') startAnimation('none');
                return;
            }

            if (target !== currentMode) startAnimation(target);
        }

        Lampa.Listener.follow('activity', function (e) {
            if (e.type === 'start' || e.type === 'complete') {
                setTimeout(updateEffects, 100);
            }
        });

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
