import { useEffect, useRef } from "react";
import { Link } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Sprout, ShieldCheck, Activity, Lock } from "lucide-react";

/**
 * Ambient WebGL background — a slow, flowing field of sage/peach washes over
 * cream that reacts gently to the pointer. Hand-written (no three.js) so it
 * stays a single full-screen quad: cheap, dependency-free, and pauses when the
 * tab is hidden or the user prefers reduced motion. Falls back to the
 * container's CSS gradient if WebGL is unavailable.
 *
 * Note: visibility of page content NEVER depends on this or on framer-motion —
 * animations only enhance. If rAF is throttled/paused, the hero still reads.
 */
function AmbientCanvas({ reduced }: { reduced: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { alpha: false, antialias: true });
    if (!gl) return;

    const vsSrc = `attribute vec2 a_pos; void main(){ gl_Position = vec4(a_pos,0.0,1.0); }`;
    const fsSrc = `
      precision highp float;
      uniform float u_t; uniform vec2 u_res; uniform vec2 u_mouse;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453123); }
      float noise(vec2 p){
        vec2 i=floor(p); vec2 f=fract(p);
        float a=hash(i), b=hash(i+vec2(1.,0.)), c=hash(i+vec2(0.,1.)), d=hash(i+vec2(1.,1.));
        vec2 u=f*f*(3.-2.*f);
        return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
      }
      float fbm(vec2 p){ float v=0.; float a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.0; a*=0.5; } return v; }
      void main(){
        vec2 uv = gl_FragCoord.xy / u_res.xy;
        vec2 p = uv * vec2(u_res.x/u_res.y, 1.0);
        float t = u_t * 0.04;
        vec2 q = vec2(fbm(p*1.5 + t), fbm(p*1.5 - t + 4.0));
        float n = fbm(p*2.0 + q*1.2 + t*0.5);
        vec3 cream = vec3(0.984,0.965,0.933);
        vec3 sage  = vec3(0.741,0.835,0.761);
        vec3 peach = vec3(0.957,0.808,0.722);
        vec3 col = cream;
        col = mix(col, sage, smoothstep(0.35,0.78,n)*0.55);
        col = mix(col, peach, smoothstep(0.55,0.98,fbm(p*1.2 - t))*0.40);
        float g = smoothstep(0.55, 0.0, distance(uv, u_mouse));
        col = mix(col, peach, g*0.16);
        float vig = smoothstep(1.25, 0.2, distance(uv, vec2(0.5)));
        col = mix(cream, col, 0.62 + 0.38*vig);
        gl_FragColor = vec4(col, 1.0);
      }`;

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src); gl.compileShader(sh); return sh;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(prog); gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uT = gl.getUniformLocation(prog, "u_t");
    const uRes = gl.getUniformLocation(prog, "u_res");
    const uMouse = gl.getUniformLocation(prog, "u_mouse");

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const resize = () => {
      canvas.width = Math.floor(canvas.clientWidth * dpr);
      canvas.height = Math.floor(canvas.clientHeight * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    const mouse = { x: 0.5, y: 0.55 };
    const target = { x: 0.5, y: 0.55 };
    const onMove = (e: PointerEvent) => {
      target.x = e.clientX / window.innerWidth;
      target.y = 1 - e.clientY / window.innerHeight;
    };
    window.addEventListener("pointermove", onMove);

    const draw = (tSeconds: number) => {
      gl.uniform1f(uT, tSeconds);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
    // Always paint at least one frame so the background is never blank.
    draw(reduced ? 6.0 : 0);

    let raf = 0;
    const start = performance.now();
    const frame = (now: number) => {
      mouse.x += (target.x - mouse.x) * 0.05;
      mouse.y += (target.y - mouse.y) * 0.05;
      draw((now - start) / 1000);
      raf = requestAnimationFrame(frame);
    };
    if (!reduced) raf = requestAnimationFrame(frame);

    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduced) raf = requestAnimationFrame(frame);
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVis);
      gl.deleteProgram(prog);
      gl.deleteBuffer(buf);
    };
  }, [reduced]);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" aria-hidden="true" />;
}

export default function Home() {
  const reduced = useReducedMotion() ?? false;
  const float = reduced ? undefined : { y: [0, -8, 0] };

  const stats = [
    { icon: ShieldCheck, value: "100%", label: "PIR compliant" },
    { icon: Activity, value: "Real-time", label: "Attendance & health" },
    { icon: Lock, value: "Secure", label: "Keychain + audit log" },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#FBF6EE] to-[#E7F0E9]">
      <AmbientCanvas reduced={reduced} />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-white/40 to-transparent" />

      <main className="relative z-10 mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 text-center">
        {/* Logo mark — gentle float + spring on hover */}
        <motion.div
          className="mb-7 inline-flex h-20 w-20 items-center justify-center rounded-3xl text-white"
          style={{ background: "#4F7C5D", boxShadow: "0 16px 40px -12px rgba(79,124,93,0.55)" }}
          animate={float}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
          whileHover={{ scale: 1.06, rotate: -3 }}
        >
          <Sprout className="h-10 w-10" strokeWidth={2} />
        </motion.div>

        <h1 className="text-6xl font-extrabold tracking-tight text-[#2E2A26] sm:text-7xl">Sprout</h1>

        <p className="mt-4 text-xl font-medium text-[#5b5145]">
          The childcare app so simple, it needs zero training.
        </p>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-[#7c7163]">
          Attendance, health records, family messaging, and compliance — one warm,
          fast platform for directors, teachers, and families.
        </p>

        <Link href="/dashboard" className="mt-9 inline-block">
          <motion.div
            className="group inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#4F7C5D] px-9 py-4 text-lg font-semibold text-white shadow-lg"
            whileHover={{ scale: 1.04, boxShadow: "0 20px 44px -12px rgba(79,124,93,0.6)" }}
            whileTap={{ scale: 0.97 }}
          >
            Get started
            <motion.span className="inline-flex" animate={reduced ? undefined : { x: [0, 5, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}>
              <ArrowRight className="h-5 w-5" />
            </motion.span>
          </motion.div>
        </Link>

        <div className="mt-16 grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <motion.div
                key={s.label}
                className="rounded-2xl border border-white/60 bg-white/55 px-4 py-5 backdrop-blur-md"
                whileHover={reduced ? undefined : { y: -4 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <Icon className="mx-auto mb-2 h-5 w-5 text-[#4F7C5D]" />
                <p className="text-lg font-bold text-[#2E2A26]">{s.value}</p>
                <p className="text-xs font-medium text-[#7c7163]">{s.label}</p>
              </motion.div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
