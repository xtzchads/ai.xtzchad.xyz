!(function (a) {
    var b = ("object" == typeof self && self.self === self && self) || ("object" == typeof global && global.global === global && global);
    "function" == typeof define && define.amd
        ? define(["exports"], function (c) {
              b.ParticleNetwork = a(b, c);
          })
        : "object" == typeof module && module.exports
        ? (module.exports = a(b, {}))
        : (b.ParticleNetwork = a(b, {}));
})(function (a, b) {
    var c = function (a) {
        this.canvas = a.canvas;
        this.g = a.g;
        this.particleColor = a.options.particleColor;
        this.x = Math.random() * this.canvas.width;
        this.y = Math.random() * this.canvas.height;
        this.velocity = {
            x: (Math.random() - 0.5) * a.options.velocity,
            y: (Math.random() - 0.5) * a.options.velocity
        };
    };
    
    c.prototype.update = function () {
        if (this.x > this.canvas.width + 20 || this.x < -20) this.velocity.x = -this.velocity.x;
        if (this.y > this.canvas.height + 20 || this.y < -20) this.velocity.y = -this.velocity.y;
        this.x += this.velocity.x;
        this.y += this.velocity.y;
    };
    
    c.prototype.draw = function () {
        this.g.beginPath();
        this.g.fillStyle = this.particleColor;
        this.g.globalAlpha = 0.7;
        this.g.arc(this.x, this.y, 1.5, 0, 2 * Math.PI);
        this.g.fill();
    };
    
    var ParticleNetwork = function (a, b) {
        this.element = a;
        this.size = { width: this.element.offsetWidth, height: this.element.offsetHeight - 1 };
        b = b || {};
        this.options = {
            particleColor: b.particleColor || "#fff",
            background: b.background || "#1a252f",
            interactive: b.interactive !== undefined ? b.interactive : true,
            velocity: this.setVelocity(b.speed),
            density: this.setDensity(b.density)
        };
        this.init();
    };
    
    ParticleNetwork.prototype.init = function () {
        this.createBackground();
        this.createCanvas();
        this.bindEvents();
        this.createParticles();
        requestAnimationFrame(this.update.bind(this));
    };
    
    ParticleNetwork.prototype.createBackground = function () {
        this.bgDiv = document.createElement("div");
        this.element.appendChild(this.bgDiv);
        this.setStyle(this.bgDiv, { position: "absolute", top: 0, left: 0, bottom: 0, right: 0 });
        this.setStyle(this.bgDiv, { background: this.options.background });
    };
    
    ParticleNetwork.prototype.createCanvas = function () {
        this.canvas = document.createElement("canvas");
        this.element.appendChild(this.canvas);
        this.g = this.canvas.getContext("2d");
        this.canvas.width = this.size.width;
        this.canvas.height = this.size.height;
        this.setStyle(this.element, { position: "absolute" });
        this.setStyle(this.canvas, { position: "absolute" });
    };
    
    ParticleNetwork.prototype.bindEvents = function () {
        if (this.options.interactive) {
            this.canvas.addEventListener("mousemove", this.onMouseMove.bind(this));
        }
        window.addEventListener("resize", this.onResize.bind(this));
    };
    
    ParticleNetwork.prototype.createParticles = function () {
        this.particles = [];
        for (var i = 0; i < (this.canvas.width * this.canvas.height) / this.options.density; i++) {
            this.particles.push(new c(this));
        }
        if (this.options.interactive) {
            this.interactiveParticle = new c(this);
            this.interactiveParticle.velocity = { x: 0, y: 0 };
            this.particles.push(this.interactiveParticle);
        }
    };
    
    ParticleNetwork.prototype.onMouseMove = function (e) {
        this.interactiveParticle.x = e.clientX - this.canvas.offsetLeft;
        this.interactiveParticle.y = e.clientY - this.canvas.offsetTop;
    };
    
    ParticleNetwork.prototype.onResize = function () {
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(function () {
            this.canvas.width = this.size.width = this.element.offsetWidth;
            this.canvas.height = this.size.height = this.element.offsetHeight-1;
            this.createParticles();
            requestAnimationFrame(this.update.bind(this));
        }.bind(this), 500);
    };
    
    ParticleNetwork.prototype.update = function () {
        this.g.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.g.globalAlpha = 1;
        this.particles.forEach(function (particle, index) {
            particle.update();
            particle.draw();
            for (var j = index + 1; j < this.particles.length; j++) {
                var otherParticle = this.particles[j];
                var dist = Math.hypot(particle.x - otherParticle.x, particle.y - otherParticle.y);
                if (dist <= 120) {
                    this.g.beginPath();
                    this.g.strokeStyle = this.options.particleColor;
                    this.g.globalAlpha = (120 - dist) / 120;
                    this.g.lineWidth = 0.7;
                    this.g.moveTo(particle.x, particle.y);
                    this.g.lineTo(otherParticle.x, otherParticle.y);
                    this.g.stroke();
                }
            }
        }.bind(this));
        
        if (this.options.velocity !== 0) {
            requestAnimationFrame(this.update.bind(this));
        }
    };
    
    ParticleNetwork.prototype.setVelocity = function (speed) {
        return speed === "fast" ? 1 : speed === "slow" ? 0.33 : speed === "none" ? 0 : 0.66;
    };
    
    ParticleNetwork.prototype.setDensity = function (density) {
        return density === "high" ? 5000 : density === "low" ? 20000 : isNaN(parseInt(density, 10)) ? 10000 : density;
    };
    
    ParticleNetwork.prototype.setStyle = function (element, styles) {
        Object.assign(element.style, styles);
    };
    
    return ParticleNetwork;
});

document.addEventListener("DOMContentLoaded", function () {
    var canvasDiv = document.getElementById("particle-canvas");
    var options = {
        particleColor: "#888",
        interactive: false,
        speed: "slow",
        density: "low",
    };
    new ParticleNetwork(canvasDiv, options);
});
