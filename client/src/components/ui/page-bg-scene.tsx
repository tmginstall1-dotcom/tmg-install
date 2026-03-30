import { useRef, useEffect } from "react";

/*
 * Premium scroll-driven 3D perspective background — pure canvas, zero dependencies.
 *
 * Technique: perspective projection (no WebGL / no Three.js).
 *   - 3D points projected to 2D via: sx = cx + (x-cx)*f/(z+f), sy = cy + (y-cy)*f/(z+f)
 *   - Scroll drives camera Y (floor-to-ceiling tilt)
 *   - Mouse adds gentle X/Y tilt (parallax)
 *   - All transforms are lerped → elastic, lag-free feel
 *   - RAF runs at 60 fps; canvas draw is CPU-trivial (line strokes only)
 */

const AMBER  = (a: number) => `rgba(251,191,36,${a})`;
const WHITE  = (a: number) => `rgba(255,255,255,${a})`;

/* ── 3D → 2D perspective projection ───────────────────────────────────── */
function project(
  x: number, y: number, z: number,
  cx: number, cy: number, focal: number
): [number, number, number] {
  const dz = z + focal;
  if (dz <= 0) return [cx, cy, 0];
  const scale = focal / dz;
  return [cx + (x - cx) * scale, cy + (y - cy) * scale, scale];
}

/* ── Furniture wireframe definitions (room-space coords) ──────────────── */
/* Each piece is a list of edges: [[x1,y1,z1],[x2,y2,z2]] in world-units.
   The room is roughly -400…+400 wide, -200…+200 tall, 50…900 deep. */
function buildScene() {
  const edges: [number[], number[]][] = [];

  const box = (
    x: number, y: number, z: number,
    w: number, h: number, d: number
  ) => {
    const x0 = x, x1 = x + w;
    const y0 = y, y1 = y + h;
    const z0 = z, z1 = z + d;
    // 12 edges of a cuboid
    const verts: [number,number,number][] = [
      [x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],
      [x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],
    ];
    const idx = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],
                 [0,4],[1,5],[2,6],[3,7]];
    idx.forEach(([a,b]) => edges.push([verts[a],verts[b]]));
  };

  // Wardrobe left
  box(-380, -200, 200, 110, 230, 70);
  // Wardrobe inner shelf detail
  edges.push([[-380,-40,200],[-270,-40,200]]);
  edges.push([[-380,-40,270],[-270,-40,270]]);

  // Wardrobe right
  box(270, -200, 180, 110, 230, 70);
  edges.push([[270,-40,180],[380,-40,180]]);
  edges.push([[270,-40,250],[380,-40,250]]);

  // Low table centre-front
  box(-100, 60, 120, 200, 18, 120);
  // Table legs
  [[-90,78,130],[-90,78,228],[90,78,130],[90,78,228]].forEach(([lx,,lz]) =>
    edges.push([[lx,78,lz],[lx,200,lz]])
  );

  // Armchair hint (simplified silhouette)
  box(-60, -60, 500, 120, 120, 100);  // seat
  box(-60,-140,500, 120, 80, 20);    // backrest

  // Ceiling grid lines (overhead structure)
  for (let i = -3; i <= 3; i++) {
    edges.push([[i*130, -200, 100],[i*130, -200, 900]]);
  }
  for (let j = 2; j <= 8; j++) {
    edges.push([[-400,-200,j*100],[400,-200,j*100]]);
  }

  // Floor edge at horizon
  edges.push([[-500,200,900],[500,200,900]]);

  return edges;
}

const SCENE_EDGES = buildScene();

export default function PageBgScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let W = 0, H = 0;
    let scrollP = 0;          // 0-1 page scroll progress
    let mouseX = 0, mouseY = 0;

    /* smoothed camera state */
    let camTiltX = 0;  // current horizontal lean (driven by mouse)
    let camTiltY = 0;  // current vertical tilt (driven by scroll + mouse)

    /* Resize */
    const resize = () => {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize, { passive: true });

    /* Scroll */
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      scrollP = max > 0 ? Math.min(1, window.scrollY / max) : 0;
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    /* Mouse */
    const onMouse = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth  - 0.5);
      mouseY = (e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener("mousemove", onMouse, { passive: true });

    let rafId: number;

    const tick = () => {
      rafId = requestAnimationFrame(tick);

      /* ── Smooth camera ──────────────────────────────────────────── */
      const targetTiltX = mouseX * 60;
      const targetTiltY = mouseY * 30 - scrollP * 140;
      camTiltX += (targetTiltX - camTiltX) * 0.06;
      camTiltY += (targetTiltY - camTiltY) * 0.06;

      /* ── Clear ─────────────────────────────────────────────────── */
      ctx.clearRect(0, 0, W, H);

      /* ── Camera parameters ─────────────────────────────────────── */
      const focal = Math.max(W, H) * 0.65;
      const cx = W * 0.5 + camTiltX;           // horizon centre X
      const cy = H * 0.42 + camTiltY;          // horizon centre Y

      /* ── Horizon glow ──────────────────────────────────────────── */
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, H * 0.55);
      glow.addColorStop(0, AMBER(0.07));
      glow.addColorStop(0.5, AMBER(0.02));
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);

      /* ── Perspective floor grid ────────────────────────────────── */
      ctx.save();
      ctx.strokeStyle = AMBER(0.10);
      ctx.lineWidth   = 0.8;

      /* vertical lines converging to VP */
      const cols = 12;
      for (let i = 0; i <= cols; i++) {
        const t   = i / cols;
        const bx  = t * W;
        const [px, py] = project(bx - W / 2, 200, 600, 0, 0, focal);
        ctx.beginPath();
        ctx.moveTo(cx + (bx - W * 0.5), H);      // bottom of screen
        ctx.lineTo(cx + px, cy + py);
        ctx.stroke();
      }

      /* horizontal lines (depth bands) */
      const rows = 10;
      for (let r = 1; r <= rows; r++) {
        const t   = r / rows;
        const z   = 100 + t * 700;
        const [, py, scale] = project(0, 200, z, 0, 0, focal);
        const hy  = cy + py;
        if (hy < 0 || hy > H) continue;
        const hw  = W * scale * 2.5;
        ctx.beginPath();
        ctx.moveTo(cx - hw, hy);
        ctx.lineTo(cx + hw, hy);
        ctx.stroke();
      }
      ctx.restore();

      /* ── Scene objects ─────────────────────────────────────────── */
      /* Sort edges by average Z (painter's algorithm) so far objects
         don't overdraw near objects in the depth glow fade. */
      const projected = SCENE_EDGES.map(([a, b]) => {
        const [ax, ay, az] = a;
        const [bx, by, bz] = b;
        const avgZ = (az + bz) / 2;
        const [sax, say, saScale] = project(ax, ay, az, 0, 0, focal);
        const [sbx, sby]          = project(bx, by, bz, 0, 0, focal);
        return { sax, say, sbx, sby, avgZ, saScale };
      }).filter(e => e.saScale > 0)
        .sort((a, b) => b.avgZ - a.avgZ);  // far → near

      projected.forEach(({ sax, say, sbx, sby, avgZ, saScale }) => {
        /* fade-by-depth: far = dim, near = brighter */
        const depthAlpha = Math.max(0.04, Math.min(0.55, saScale * 1.8));

        ctx.save();
        ctx.strokeStyle = AMBER(depthAlpha);
        ctx.lineWidth   = Math.max(0.5, saScale * 2);
        ctx.beginPath();
        ctx.moveTo(cx + sax, cy + say);
        ctx.lineTo(cx + sbx, cy + sby);
        ctx.stroke();
        ctx.restore();
      });

      /* ── Architectural corner marks ────────────────────────────── */
      const m = 28, l = 18;
      ctx.save();
      ctx.strokeStyle = AMBER(0.18);
      ctx.lineWidth   = 1;
      [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(
        ([x, y, sx, sy]) => {
          ctx.beginPath();
          ctx.moveTo(x + sx * l, y); ctx.lineTo(x, y); ctx.lineTo(x, y + sy * l);
          ctx.stroke();
        }
      );
      ctx.restore();

      /* ── Subtle vignette ───────────────────────────────────────── */
      const vig = ctx.createRadialGradient(W/2, H/2, H * 0.2, W/2, H/2, H * 0.9);
      vig.addColorStop(0, "transparent");
      vig.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize",    resize);
      window.removeEventListener("scroll",    onScroll);
      window.removeEventListener("mousemove", onMouse);
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: -1,
        pointerEvents: "none",
        overflow: "hidden",
        background:
          "radial-gradient(ellipse at 50% 20%, #16122e 0%, #08060f 45%, #000000 100%)",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
      />
    </div>
  );
}
