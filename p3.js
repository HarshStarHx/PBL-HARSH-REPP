// TouchTexture class
class TouchTexture {
    constructor() {
        this.size = 64;
        this.width = this.height = this.size;
        this.maxAge = 64;
        this.radius = 0.25 * this.size;
        this.speed = 1 / this.maxAge;
        this.trail = [];
        this.last = null;
        this.initTexture();
    }

    initTexture() {
        this.canvas = document.createElement("canvas");
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.ctx = this.canvas.getContext("2d");
        this.ctx.fillStyle = "black";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.texture = new THREE.Texture(this.canvas);
    }

    update() {
        this.clear();
        let speed = this.speed;
        for (let i = this.trail.length - 1; i >= 0; i--) {
            const point = this.trail[i];
            let f = point.force * speed * (1 - point.age / this.maxAge);
            point.x += point.vx * f;
            point.y += point.vy * f;
            point.age++;
            if (point.age > this.maxAge) {
                this.trail.splice(i, 1);
            } else {
                this.drawPoint(point);
            }
        }
        this.texture.needsUpdate = true;
    }

    clear() {
        this.ctx.fillStyle = "black";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    addTouch(point) {
        let force = 0;
        let vx = 0;
        let vy = 0;
        const last = this.last;
        if (last) {
            const dx = point.x - last.x;
            const dy = point.y - last.y;
            if (dx === 0 && dy === 0) return;
            const dd = dx * dx + dy * dy;
            let d = Math.sqrt(dd);
            vx = dx / d;
            vy = dy / d;
            force = Math.min(dd * 20000, 2.0);
        }
        this.last = { x: point.x, y: point.y };
        this.trail.push({ x: point.x, y: point.y, age: 0, force, vx, vy });
    }

    drawPoint(point) {
        const pos = {
            x: point.x * this.width,
            y: (1 - point.y) * this.height
        };

        let intensity = 1;
        if (point.age < this.maxAge * 0.3) {
            intensity = Math.sin((point.age / (this.maxAge * 0.3)) * (Math.PI / 2));
        } else {
            const t = 1 - (point.age - this.maxAge * 0.3) / (this.maxAge * 0.7);
            intensity = -t * (t - 2);
        }
        intensity *= point.force;

        const radius = this.radius;
        let color = `${((point.vx + 1) / 2) * 255}, ${((point.vy + 1) / 2) * 255}, ${intensity * 255}`;
        let offset = this.size * 5;
        this.ctx.shadowOffsetX = offset;
        this.ctx.shadowOffsetY = offset;
        this.ctx.shadowBlur = radius * 1;
        this.ctx.shadowColor = `rgba(${color},${0.2 * intensity})`;

        this.ctx.beginPath();
        this.ctx.fillStyle = "rgba(255,0,0,1)";
        this.ctx.arc(pos.x - offset, pos.y - offset, radius, 0, Math.PI * 2);
        this.ctx.fill();
    }
}

// GradientBackground class
class GradientBackground {
    constructor(sceneManager) {
        this.sceneManager = sceneManager;
        this.mesh = null;
        this.uniforms = {
            uTime: { value: 0 },
            uResolution: {
                value: new THREE.Vector2(window.innerWidth, window.innerHeight)
            },
            uMouse: { value: new THREE.Vector2(0.5, 0.5) },
            uColor1: { value: new THREE.Vector3(0.2, 0.4, 0.8) },
            uColor2: { value: new THREE.Vector3(0.8, 0.2, 0.6) },
            uColor3: { value: new THREE.Vector3(0.3, 0.7, 0.5) },
            uColor4: { value: new THREE.Vector3(0.9, 0.5, 0.2) },
            uColor5: { value: new THREE.Vector3(0.6, 0.3, 0.9) },
            uColor6: { value: new THREE.Vector3(0.4, 0.8, 0.3) },
            uSpeed: { value: 0.3 },
            uIntensity: { value: 1.5 },
            uTouchTexture: { value: null },
            uGrainIntensity: { value: 0.08 },
            uDarkNavy: { value: new THREE.Vector3(0.039, 0.055, 0.153) },
            uGradientSize: { value: 0.6 },
            uGradientCount: { value: 8.0 },
            uColorChangeSpeed: { value: 0.08 },
            uMouseInfluence: { value: 0.3 }
        };
    }

    init() {
        const viewSize = this.sceneManager.getViewSize();
        const geometry = new THREE.PlaneGeometry(viewSize.width, viewSize.height, 1, 1);

        const material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: `
            varying vec2 vUv;
            void main() {
              vec3 pos = position.xyz;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.);
              vUv = uv;
            }
          `,
            fragmentShader: `
            uniform float uTime;
            uniform vec2 uResolution;
            uniform vec2 uMouse;
            uniform vec3 uColor1;
            uniform vec3 uColor2;
            uniform vec3 uColor3;
            uniform vec3 uColor4;
            uniform vec3 uColor5;
            uniform vec3 uColor6;
            uniform float uSpeed;
            uniform float uIntensity;
            uniform sampler2D uTouchTexture;
            uniform float uGrainIntensity;
            uniform vec3 uDarkNavy;
            uniform float uGradientSize;
            uniform float uGradientCount;
            uniform float uColorChangeSpeed;
            uniform float uMouseInfluence;
            
            varying vec2 vUv;
            
            #define PI 3.14159265359
            
            float grain(vec2 uv, float time) {
              vec2 grainUv = uv * uResolution * 0.5;
              float grainValue = fract(sin(dot(grainUv + time, vec2(12.9898, 78.233))) * 43758.5453);
              return grainValue * 2.0 - 1.0;
            }
            
            vec3 dynamicColor(vec3 baseColor, float time, float offset, vec2 uv, vec2 mouse) {
              // Mouse distance influence
              float mouseDist = length(uv - mouse);
              float mouseEffect = 1.0 - smoothstep(0.0, 1.0, mouseDist);
              
              float hueShift = sin(time * uColorChangeSpeed + offset + mouseEffect * PI) * 0.4;
              float satShift = cos(time * uColorChangeSpeed * 0.7 + offset) * 0.25;
              
              vec3 shifted = baseColor;
              shifted.r = clamp(baseColor.r + hueShift * (1.0 + mouseEffect * uMouseInfluence), 0.0, 1.0);
              shifted.g = clamp(baseColor.g + hueShift * 0.5 + mouseEffect * 0.2, 0.0, 1.0);
              shifted.b = clamp(baseColor.b - hueShift * 0.3 + mouseEffect * 0.15, 0.0, 1.0);
              
              return mix(baseColor, shifted, 0.7 + satShift);
            }
            
            vec3 getGradientColor(vec2 uv, float time, vec2 mouse) {
              float gradientRadius = uGradientSize;
              
              // Mouse-influenced centers
              float mouseX = mouse.x;
              float mouseY = mouse.y;
              
              vec2 center1 = vec2(0.5 + sin(time * uSpeed * 0.4 + mouseX) * 0.4, 0.5 + cos(time * uSpeed * 0.5 + mouseY) * 0.4);
              vec2 center2 = vec2(0.5 + cos(time * uSpeed * 0.6 - mouseY) * 0.5, 0.5 + sin(time * uSpeed * 0.45 + mouseX) * 0.5);
              vec2 center3 = vec2(0.5 + sin(time * uSpeed * 0.35 + mouseY * 2.0) * 0.45, 0.5 + cos(time * uSpeed * 0.55) * 0.45);
              vec2 center4 = vec2(0.5 + cos(time * uSpeed * 0.5) * 0.4, 0.5 + sin(time * uSpeed * 0.4 - mouseX) * 0.4);
              vec2 center5 = vec2(0.5 + sin(time * uSpeed * 0.7 + mouseX * 1.5) * 0.35, 0.5 + cos(time * uSpeed * 0.6) * 0.35);
              vec2 center6 = vec2(0.5 + cos(time * uSpeed * 0.45 - mouseY * 1.5) * 0.5, 0.5 + sin(time * uSpeed * 0.65) * 0.5);
              vec2 center7 = vec2(0.5 + sin(time * uSpeed * 0.55) * 0.38, 0.5 + cos(time * uSpeed * 0.48 + mouseX) * 0.42);
              vec2 center8 = vec2(0.5 + cos(time * uSpeed * 0.65 + mouseY) * 0.36, 0.5 + sin(time * uSpeed * 0.52) * 0.44);
              
              float dist1 = length(uv - center1);
              float dist2 = length(uv - center2);
              float dist3 = length(uv - center3);
              float dist4 = length(uv - center4);
              float dist5 = length(uv - center5);
              float dist6 = length(uv - center6);
              float dist7 = length(uv - center7);
              float dist8 = length(uv - center8);
              
              float influence1 = 1.0 - smoothstep(0.0, gradientRadius, dist1);
              float influence2 = 1.0 - smoothstep(0.0, gradientRadius, dist2);
              float influence3 = 1.0 - smoothstep(0.0, gradientRadius, dist3);
              float influence4 = 1.0 - smoothstep(0.0, gradientRadius, dist4);
              float influence5 = 1.0 - smoothstep(0.0, gradientRadius, dist5);
              float influence6 = 1.0 - smoothstep(0.0, gradientRadius, dist6);
              float influence7 = 1.0 - smoothstep(0.0, gradientRadius, dist7);
              float influence8 = 1.0 - smoothstep(0.0, gradientRadius, dist8);
              
              vec3 dynColor1 = dynamicColor(uColor1, time, 0.0, uv, mouse);
              vec3 dynColor2 = dynamicColor(uColor2, time, 2.0, uv, mouse);
              vec3 dynColor3 = dynamicColor(uColor3, time, 4.0, uv, mouse);
              vec3 dynColor4 = dynamicColor(uColor4, time, 6.0, uv, mouse);
              vec3 dynColor5 = dynamicColor(uColor5, time, 8.0, uv, mouse);
              vec3 dynColor6 = dynamicColor(uColor6, time, 10.0, uv, mouse);
              
              vec3 color = vec3(0.0);
              color += dynColor1 * influence1 * (0.6 + 0.4 * sin(time * uSpeed));
              color += dynColor2 * influence2 * (0.6 + 0.4 * cos(time * uSpeed * 1.2));
              color += dynColor3 * influence3 * (0.6 + 0.4 * sin(time * uSpeed * 0.8));
              color += dynColor4 * influence4 * (0.6 + 0.4 * cos(time * uSpeed * 1.3));
              color += dynColor5 * influence5 * (0.6 + 0.4 * sin(time * uSpeed * 1.1));
              color += dynColor6 * influence6 * (0.6 + 0.4 * cos(time * uSpeed * 0.9));
              
              if (uGradientCount > 6.0) {
                color += dynColor1 * influence7 * (0.6 + 0.4 * sin(time * uSpeed * 1.4));
                color += dynColor2 * influence8 * (0.6 + 0.4 * cos(time * uSpeed * 1.5));
              }
              
              color = clamp(color, vec3(0.0), vec3(1.0)) * uIntensity;
              
              float luminance = dot(color, vec3(0.299, 0.587, 0.114));
              color = mix(vec3(luminance), color, 1.2);
              
              color = pow(color, vec3(0.95));
              
              float brightness = length(color);
              float mixFactor = max(brightness * 1.1, 0.2);
              color = mix(uDarkNavy, color, mixFactor);
              
              return clamp(color, vec3(0.0), vec3(1.0));
            }
            
            void main() {
              vec2 uv = vUv;
              
              vec4 touchTex = texture2D(uTouchTexture, uv);
              float vx = -(touchTex.r * 2.0 - 1.0);
              float vy = -(touchTex.g * 2.0 - 1.0);
              float intensity = touchTex.b;
              uv.x += vx * 0.6 * intensity;
              uv.y += vy * 0.6 * intensity;
              
              vec2 center = vec2(0.5);
              float dist = length(uv - center);
              float ripple = sin(dist * 20.0 - uTime * 3.0) * 0.03 * intensity;
              uv += vec2(ripple);
              
              vec3 color = getGradientColor(uv, uTime, uMouse);
              
              float grainValue = grain(uv, uTime);
              color += grainValue * uGrainIntensity;
              
              float timeShift = uTime * 0.5;
              color.r += sin(timeShift) * 0.015;
              color.g += cos(timeShift * 1.4) * 0.015;
              color.b += sin(timeShift * 1.2) * 0.015;
              
              color = clamp(color, vec3(0.0), vec3(1.0));
              
              gl_FragColor = vec4(color, 1.0);
            }
          `
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.z = 0;
        this.sceneManager.scene.add(this.mesh);
    }

    update(delta) {
        if (this.uniforms.uTime) {
            this.uniforms.uTime.value += delta;
        }
    }

    updateMouse(x, y) {
        if (this.uniforms.uMouse) {
            this.uniforms.uMouse.value.set(x, y);
        }
    }

    onResize(width, height) {
        const viewSize = this.sceneManager.getViewSize();
        if (this.mesh) {
            this.mesh.geometry.dispose();
            this.mesh.geometry = new THREE.PlaneGeometry(viewSize.width, viewSize.height, 1, 1);
        }
        if (this.uniforms.uResolution) {
            this.uniforms.uResolution.value.set(width, height);
        }
    }
}

// App class
class App {
    constructor() {
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: "high-performance",
            alpha: false,
            stencil: false,
            depth: false
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setAnimationLoop(null);
        document.body.appendChild(this.renderer.domElement);
        this.renderer.domElement.id = "webGLApp";

        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 10000);
        this.camera.position.z = 50;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0e27);
        this.clock = new THREE.Clock();

        this.touchTexture = new TouchTexture();
        this.gradientBackground = new GradientBackground(this);
        this.gradientBackground.uniforms.uTouchTexture.value = this.touchTexture.texture;

        this.init();
    }

    init() {
        this.gradientBackground.init();
        this.render();
        this.tick();

        window.addEventListener("resize", () => this.onResize());
        window.addEventListener("mousemove", (ev) => this.onMouseMove(ev));
        window.addEventListener("touchmove", (ev) => this.onTouchMove(ev));

        document.addEventListener("visibilitychange", () => {
            if (!document.hidden) {
                this.render();
            }
        });
    }

    onTouchMove(ev) {
        const touch = ev.touches[0];
        this.onMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
    }

    onMouseMove(ev) {
        const x = ev.clientX / window.innerWidth;
        const y = 1 - ev.clientY / window.innerHeight;

        this.mouse = { x, y };
        this.touchTexture.addTouch(this.mouse);
        this.gradientBackground.updateMouse(x, y);
    }

    getViewSize() {
        const fovInRadians = (this.camera.fov * Math.PI) / 180;
        const height = Math.abs(this.camera.position.z * Math.tan(fovInRadians / 2) * 2);
        return { width: height * this.camera.aspect, height };
    }

    update(delta) {
        this.touchTexture.update();
        this.gradientBackground.update(delta);
    }

    render() {
        const delta = this.clock.getDelta();
        const clampedDelta = Math.min(delta, 0.1);
        this.renderer.render(this.scene, this.camera);
        this.update(clampedDelta);
    }

    tick() {
        this.render();
        requestAnimationFrame(() => this.tick());
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.gradientBackground.onResize(window.innerWidth, window.innerHeight);
    }
}

// Start the app
const app = new App();

// Navigation active state
const navLinks = document.querySelectorAll('.nav-link');
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        const href = link.getAttribute('href') || '';

        // Only intercept hash links for in-page smooth scrolling.
        if (!href.startsWith('#')) {
            return;
        }

        e.preventDefault();
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        const targetId = href.substring(1);
        const targetSection = document.getElementById(targetId);
        if (targetSection) {
            targetSection.scrollIntoView({ behavior: 'smooth' });
        }
    });
});

// Enhanced Custom cursor with smooth animation
const cursor = document.getElementById("customCursor");
let mouseX = 0;
let mouseY = 0;
let cursorX = 0;
let cursorY = 0;

function animateCursor() {
    const dx = mouseX - cursorX;
    const dy = mouseY - cursorY;

    cursorX += dx * 0.15;
    cursorY += dy * 0.15;

    cursor.style.left = cursorX + "px";
    cursor.style.top = cursorY + "px";

    requestAnimationFrame(animateCursor);
}

document.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
});

animateCursor();

// Make cursor larger on hover over interactive elements
const interactiveElements = document.querySelectorAll('.nav-link');
interactiveElements.forEach(el => {
    el.addEventListener("mouseenter", () => {
        cursor.classList.add('hovering');
    });
    el.addEventListener("mouseleave", () => {
        cursor.classList.remove('hovering');
    });
});

// ==========================================
// SHADER RENDERER FOR SCROLL SECTION
// ==========================================

class ShaderRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.dpr = Math.min(window.devicePixelRatio, 2);
        this.gl = canvas.getContext("webgl2", {
            alpha: false,
            antialias: false,
            depth: false
        });

        if (!this.gl) {
            console.error("WebGL2 not supported");
            return;
        }

        this.vertexSrc = "#version 300 es\\nprecision highp float;\\nin vec4 position;\\nvoid main(){gl_Position=position;}";

        this.fragmentSrc = `#version 300 es
precision highp float;
out vec4 O;
uniform float time;
uniform vec2 resolution;

#define FC gl_FragCoord.xy
#define R resolution
#define T time
#define MN min(R.x,R.y)
#define S smoothstep
#define SE(v,a) S(fwidth(a),-.35,v-a)
#define PI radians(180.)
#define lum(a) dot(a,vec3(.21,.71,.07))
#define hue(a)(.5+.5*sin(PI*(a)+vec3(1,2,3)))

void main() {
    vec3 bg=vec3(.08);
    vec2 uv=2.*FC-R, st=(FC-.5*R)/MN;
    
    uv*=mat2(cos(sin(T*.2)-vec4(0,11,33,0)))*exp(cos(T)*.321)*(.7+.5*cos(T*.5));
    float d=length(uv)/MN;
    uv=vec2(log(d),.205+atan(uv.x,uv.y))*8./PI;
    vec2 p=uv;
    uv.x+=floor(uv.y*.5)*.5-T*1.5;
    uv=mod(uv,2.)-1.;
    p+=sin(T*10.-p*vec2(10,30))*.01;
    uv*=uv*uv*uv;
    float l=dot(uv,uv);
    l=abs(d-SE(l,.2));
    vec3 col=hue(l*l-T*.5);
    col=tanh(col*col)/(.01+.25*lum(vec3(distance(cos((p.x-T)*12.),sin(p.y*42.)))));
    col=sqrt(col);
    l=dot(abs(uv)/dot(p,4.5*p)-.9,st);
    col=mix(2.*sqrt(hue(.1+l)/max(l*l*l*l,.1)),col,S(-.5,.5,length((FC-.5*R)/MN)));
    col/=4.;
    col=mix(vec3(.85),col,mix(.6,1.,fract(sin(dot(st, vec2(12.9898,78.233)))*345678.)));
    col=max(col,.1);
    col=mix(col,vec3(1),S(1e-5,-1e-2,dot(st,st)));
    
    vec2 c=FC/R;
    c*=1.-c.yx;
    float vig=c.x*c.y*25.;
    vig=S(.0,1.,pow(vig,.3));
    col=mix(vec3(lum(col)),col,vig);
    col=mix(vec3(0),col,vig);
    col*=vec3(1.2*lum(col));
    col=sqrt(col);
    
    O=vec4(col,1);
}`;

        this.vertices = [-1, 1, -1, -1, 1, 1, 1, -1];
        this.init();
        this.resize();
    }

    compile(shader, source) {
        const gl = this.gl;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(shader));
            return false;
        }
        return true;
    }

    init() {
        const gl = this.gl;
        this.vs = gl.createShader(gl.VERTEX_SHADER);
        this.fs = gl.createShader(gl.FRAGMENT_SHADER);

        if (!this.compile(this.vs, this.vertexSrc)) return;
        if (!this.compile(this.fs, this.fragmentSrc)) return;

        this.program = gl.createProgram();
        gl.attachShader(this.program, this.vs);
        gl.attachShader(this.program, this.fs);
        gl.linkProgram(this.program);

        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            console.error(gl.getProgramInfoLog(this.program));
            return;
        }

        this.buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.vertices), gl.STATIC_DRAW);

        const position = gl.getAttribLocation(this.program, "position");
        gl.enableVertexAttribArray(position);
        gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

        this.uniformResolution = gl.getUniformLocation(this.program, "resolution");
        this.uniformTime = gl.getUniformLocation(this.program, "time");
    }

    resize() {
        const { innerWidth: width, innerHeight: height } = window;
        this.canvas.width = width * this.dpr;
        this.canvas.height = height * this.dpr;
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    render(now = 0) {
        const { gl, program, canvas } = this;
        if (!program) return;

        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(program);

        if (this.uniformResolution) gl.uniform2f(this.uniformResolution, canvas.width, canvas.height);
        if (this.uniformTime) gl.uniform1f(this.uniformTime, now * 1e-3);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
}

// Initialize shader when in view
const shaderCanvas = document.getElementById('shaderCanvas');
let shaderRenderer = null;
let shaderAnimationFrame = null;

function initShader() {
    if (!shaderRenderer) {
        shaderRenderer = new ShaderRenderer(shaderCanvas);
        animateShader(0);
    }
}

function animateShader(now) {
    if (shaderRenderer) {
        shaderRenderer.render(now);
        shaderAnimationFrame = requestAnimationFrame(animateShader);
    }
}

// Observe shader section to start animation when visible
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            initShader();
        }
    });
}, { threshold: 0.1 });

observer.observe(document.getElementById('shaderSection'));

window.addEventListener('resize', () => {
    if (shaderRenderer) shaderRenderer.resize();
});
