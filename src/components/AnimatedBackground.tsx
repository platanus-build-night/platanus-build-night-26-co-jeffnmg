"use client";

// Fondo geométrico animado y barato: partículas conectadas + polígonos
// wireframe que rotan lento, con parallax según mouse y scroll.
// Optimizaciones: un solo canvas 2D, ~30 nodos, DPR limitado a 1.5,
// se pausa cuando la pestaña está oculta y respeta prefers-reduced-motion.

import { useEffect, useRef } from "react";

const NODE_COUNT = 30;
const LINK_DIST = 150;
const MAX_DPR = 1.5;

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  depth: number; // 0..1 — cuánto le afecta el parallax
}

interface Poly {
  x: number;
  y: number;
  radius: number;
  sides: number;
  angle: number;
  spin: number;
  depth: number;
}

export function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let width = 0;
    let height = 0;
    let raf = 0;
    let running = true;

    // Parallax suavizado (lerp hacia el objetivo)
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    let scrollOffset = 0;
    let scrollTarget = 0;

    const rand = (min: number, max: number) => min + Math.random() * (max - min);

    const nodes: Node[] = Array.from({ length: NODE_COUNT }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: rand(-0.012, 0.012),
      vy: rand(-0.012, 0.012),
      r: rand(1, 2.2),
      depth: rand(0.2, 1),
    }));

    const polys: Poly[] = Array.from({ length: 5 }, (_, i) => ({
      x: Math.random(),
      y: Math.random(),
      radius: rand(40, 110),
      sides: [3, 4, 6][i % 3],
      angle: rand(0, Math.PI * 2),
      spin: rand(-0.0015, 0.0015),
      depth: rand(0.3, 1),
    }));

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw() {
      ctx!.clearRect(0, 0, width, height);

      // Parallax con inercia
      pointer.x += (pointer.tx - pointer.x) * 0.05;
      pointer.y += (pointer.ty - pointer.y) * 0.05;
      scrollOffset += (scrollTarget - scrollOffset) * 0.06;

      // Polígonos wireframe grandes
      for (const p of polys) {
        p.angle += p.spin;
        const px =
          p.x * width + pointer.x * 26 * p.depth;
        const py =
          ((p.y * height - scrollOffset * 0.08 * p.depth) % (height + 220)) +
          pointer.y * 18 * p.depth;
        const y = py < -110 ? py + height + 220 : py;

        ctx!.beginPath();
        for (let s = 0; s <= p.sides; s++) {
          const a = p.angle + (s / p.sides) * Math.PI * 2;
          const vx = px + Math.cos(a) * p.radius;
          const vy = y + Math.sin(a) * p.radius;
          if (s === 0) ctx!.moveTo(vx, vy);
          else ctx!.lineTo(vx, vy);
        }
        ctx!.strokeStyle = `rgba(129, 140, 248, ${0.05 + 0.03 * p.depth})`;
        ctx!.lineWidth = 1;
        ctx!.stroke();
      }

      // Nodos: mover y proyectar con parallax
      const projected: { x: number; y: number; r: number }[] = [];
      for (const n of nodes) {
        n.x += n.vx / width;
        n.y += n.vy / height;
        if (n.x < -0.02) n.x = 1.02;
        if (n.x > 1.02) n.x = -0.02;
        if (n.y < -0.02) n.y = 1.02;
        if (n.y > 1.02) n.y = -0.02;
        projected.push({
          x: n.x * width + pointer.x * 34 * n.depth,
          y:
            n.y * height +
            pointer.y * 24 * n.depth -
            ((scrollOffset * 0.12 * n.depth) % height),
          r: n.r,
        });
      }

      // Líneas entre nodos cercanos
      for (let i = 0; i < projected.length; i++) {
        for (let j = i + 1; j < projected.length; j++) {
          const dx = projected[i].x - projected[j].x;
          const dy = projected[i].y - projected[j].y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK_DIST * LINK_DIST) {
            const alpha = 0.09 * (1 - Math.sqrt(d2) / LINK_DIST);
            ctx!.strokeStyle = `rgba(148, 163, 255, ${alpha})`;
            ctx!.lineWidth = 1;
            ctx!.beginPath();
            ctx!.moveTo(projected[i].x, projected[i].y);
            ctx!.lineTo(projected[j].x, projected[j].y);
            ctx!.stroke();
          }
        }
      }

      // Puntos
      for (const p of projected) {
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fillStyle = "rgba(165, 180, 252, 0.35)";
        ctx!.fill();
      }
    }

    function loop() {
      if (!running) return;
      draw();
      raf = requestAnimationFrame(loop);
    }

    function onPointerMove(e: PointerEvent) {
      pointer.tx = (e.clientX / width) * 2 - 1;
      pointer.ty = (e.clientY / height) * 2 - 1;
    }
    function onScroll() {
      scrollTarget = window.scrollY;
    }
    function onVisibility() {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!reducedMotion) {
        running = true;
        raf = requestAnimationFrame(loop);
      }
    }

    resize();
    window.addEventListener("resize", resize);

    if (reducedMotion) {
      draw(); // un solo frame estático
    } else {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      window.addEventListener("scroll", onScroll, { passive: true });
      document.addEventListener("visibilitychange", onVisibility);
      raf = requestAnimationFrame(loop);
    }

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      {/* Glows estáticos en CSS puro: costo cero en runtime */}
      <div
        className="absolute -top-40 -left-40 size-[480px] rounded-full opacity-25"
        style={{
          background:
            "radial-gradient(circle, rgba(99,102,241,0.5) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute -right-32 top-1/3 size-[420px] rounded-full opacity-20"
        style={{
          background:
            "radial-gradient(circle, rgba(56,189,248,0.4) 0%, transparent 70%)",
        }}
      />
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}
