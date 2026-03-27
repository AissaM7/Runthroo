class SpotlightBackground {
    constructor(options = {}) {
        this.container = document.createElement('div');
        this.container.className = 'spotlight-background';
        document.body.appendChild(this.container);

        this.colors = options.colors || ["rgba(10, 132, 255, 0.12)", "rgba(10, 132, 255, 0.04)"];
        if (!Array.isArray(this.colors)) this.colors = [this.colors];

        this.size = options.size || 600;
        this.blur = options.blur || 80;
        this.smoothing = options.smoothing || 0.1;
        this.ambient = options.ambient !== undefined ? options.ambient : true;
        this.opacity = options.opacity !== undefined ? options.opacity : 1;

        this.spotlights = [];
        this.tick = 0;
        this.lastMouseMove = 0;

        this.init();
        this.bindEvents();
        this.animate();
    }

    init() {
        this.container.innerHTML = '';
        const width = window.innerWidth;
        const height = window.innerHeight;
        const centerX = width / 2;
        const centerY = height / 2;

        // Create the gradient divs
        this.spotlightEls = this.colors.map((color, i) => {
            const el = document.createElement('div');
            el.className = 'spotlight-layer';
            el.style.opacity = this.opacity;
            el.style.filter = `blur(${this.blur}px)`;
            this.container.appendChild(el);

            const offset = (i - (this.colors.length - 1) / 2) * 50;
            this.spotlights.push({
                x: centerX + offset,
                y: centerY,
                targetX: centerX + offset,
                targetY: centerY,
                color: color
            });

            return el;
        });

        // Ambient base gradient
        const base = document.createElement('div');
        base.className = 'spotlight-base';
        base.style.background = 'radial-gradient(ellipse at 50% 50%, rgba(10, 132, 255, 0.05) 0%, transparent 80%)';
        this.container.appendChild(base);
    }

    bindEvents() {
        const handleMove = (e) => {
            const x = e.clientX || (e.touches && e.touches[0].clientX);
            const y = e.clientY || (e.touches && e.touches[0].clientY);
            if (x === undefined || y === undefined) return;

            this.lastMouseMove = Date.now();

            this.spotlights.forEach((spotlight, i) => {
                const offset = (i - (this.colors.length - 1) / 2);
                spotlight.targetX = x + offset * 30;
                spotlight.targetY = y + offset * 20;
            });
        };

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('touchmove', handleMove);
        window.addEventListener('resize', () => {
            // Force an ambient drift target update near the new center
            this.lastMouseMove = 0;
        });
    }

    lerp(start, end, factor) {
        return start + (end - start) * factor;
    }

    animate = () => {
        this.tick++;
        const now = Date.now();
        const timeSinceMouseMove = now - this.lastMouseMove;
        const isAmbient = this.ambient && timeSinceMouseMove > 2000;
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.spotlights.forEach((spotlight, i) => {
            if (isAmbient) {
                const offset = i * 0.5;
                spotlight.targetX = width / 2 + Math.sin(this.tick * 0.005 + offset) * (width * 0.2);
                spotlight.targetY = height / 2 + Math.cos(this.tick * 0.003 + offset) * (height * 0.15);
            }

            spotlight.x = this.lerp(spotlight.x, spotlight.targetX, this.smoothing);
            spotlight.y = this.lerp(spotlight.y, spotlight.targetY, this.smoothing);

            // Update DOM
            this.spotlightEls[i].style.background = `radial-gradient(${this.size}px circle at ${spotlight.x}px ${spotlight.y}px, ${spotlight.color}, transparent 70%)`;
        });

        requestAnimationFrame(this.animate);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new SpotlightBackground({
        colors: ["rgba(10, 132, 255, 0.12)", "rgba(10, 132, 255, 0.04)"]
    });
});
