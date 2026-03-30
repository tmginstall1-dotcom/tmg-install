import { useRef, useEffect } from "react";

/*
 * Scroll-driven 3D armchair dismantle / reassemble — pure canvas, zero deps.
 *
 * Architecture:
 *  - 12 chair pieces defined in world-space Y-up coordinates
 *  - Each piece has: scatter translation, spin axes, stagger delay
 *  - Per-frame: scatter → spin (3D) → camera rotate → perspective project
 *  - Painter's algorithm Z-sort across all edges before drawing
 *  - Scroll progress drives dismantle; scrolling back re-assembles
 *  - Camera yaw drifts +0.3 rad as chair dismantles (cinematic orbit)
 *  - Mouse adds ±3° parallax tilt
 */

type V3   = [number, number, number];
type Edge = [number, number];

const AMB = (a: number) => `rgba(251,191,36,${a.toFixed(3)})`;

/* ── Cubic ease in-out ─────────────────────────────────────── */
const ease = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

/* ── Cuboid: 8 verts + 12 edges ────────────────────────────── */
function box(
  cx: number, cy: number, cz: number,
  w: number,  h: number,  d: number
): { v: V3[]; e: Edge[] } {
  const [x0, x1] = [cx - w / 2, cx + w / 2];
  const [y0, y1] = [cy, cy + h];
  const [z0, z1] = [cz - d / 2, cz + d / 2];
  return {
    v: [[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],
        [x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]] as V3[],
    e: [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],
        [0,4],[1,5],[2,6],[3,7]] as Edge[],
  };
}

/* ── Perspective projection (Y-up, looking along +Z) ───────── */
function project(
  p: V3, ox: number, oy: number, focal: number
): [number, number, number] {
  const dz = p[2] + focal;
  if (dz < 1) return [0, 0, 0];
  const s = focal / dz;
  return [ox + p[0] * s, oy - p[1] * s, s]; // -y: canvas Y inverted
}

/* ── Camera rotation: yaw then pitch ───────────────────────── */
function camRot(p: V3, yaw: number, pitch: number): V3 {
  const [x, y, z] = p;
  const cy = Math.cos(yaw),   sy = Math.sin(yaw);
  const x2 = x * cy + z * sy, z2 = -x * sy + z * cy;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  return [x2, y * cp - z2 * sp, y * sp + z2 * cp];
}

/* ── Spin vertices around a 3D centre point ────────────────── */
function spinVerts(
  verts: V3[], cx: number, cy: number, cz: number,
  ax: number, ay: number, az: number
): V3[] {
  return verts.map(([x, y, z]) => {
    let dx = x - cx, dy = y - cy, dz = z - cz;
    if (ax !== 0) {
      const c = Math.cos(ax), s = Math.sin(ax);
      [dy, dz] = [dy * c - dz * s, dy * s + dz * c];
    }
    if (ay !== 0) {
      const c = Math.cos(ay), s = Math.sin(ay);
      [dx, dz] = [dx * c + dz * s, -dx * s + dz * c];
    }
    if (az !== 0) {
      const c = Math.cos(az), s = Math.sin(az);
      [dx, dy] = [dx * c - dy * s, dx * s + dy * c];
    }
    return [dx + cx, dy + cy, dz + cz] as V3;
  });
}

/* ── Chair piece definition ─────────────────────────────────── */
interface Piece {
  v: V3[];                       // assembled vertices (world space, Y-up)
  e: Edge[];
  cx: number; cy: number; cz: number;  // piece centre (for spin)
  scatter: V3;                   // world-space displacement at t=1
  spin: [number, number, number]; // [ax, ay, az] total angle at t=1
  delay: number;                 // scroll progress at which scatter begins
  alpha: number;                 // base opacity at full assembly
}

/* ── Armchair geometry ──────────────────────────────────────── */
function buildChair(): Piece[] {
  const pieces: Piece[] = [];

  function add(
    bx: number, by: number, bz: number,
    w: number, h: number, d: number,
    scatter: V3, spin: [number, number, number],
    delay: number, alpha: number
  ) {
    const g = box(bx, by, bz, w, h, d);
    pieces.push({
      v: g.v, e: g.e,
      cx: bx, cy: by + h / 2, cz: bz,
      scatter, spin, delay, alpha,
    });
  }

  /* The chair sits on the floor (Y=0 = ground, Y-up).
     Legs: y=-75 to y=4 (80 tall).  Seat: y=4 to y=56.
     Arms: y=4 to y=105.  Backrest: y=56 to y=255. */

  // ── Seat cushion (top soft layer)
  add(  0,  38,   0, 186, 20, 170,
        [0, -260, 0],        [ 0.55,  0,    0.22], 0.22, 1.00);

  // ── Seat frame (structural undercarriage)
  add(  0,   5,   0, 200, 35, 184,
        [0, -315, 55],       [ 0.40,  0,   -0.20], 0.28, 0.86);

  // ── Backrest cushion
  add(  0,  58, -85, 168, 160, 18,
        [0,  295, -370],     [-1.05,  0.12, 0   ], 0.04, 1.00);

  // ── Backrest frame
  add(  0,  53, -96, 198, 190, 28,
        [0,  215, -415],     [-0.80,  0,    0.10], 0.07, 0.84);

  // ── Left arm body
  add(-96,  12,   0,  22,  82, 186,
        [-365, 85, 0],       [ 0,    -1.20, 0   ], 0.13, 0.90);

  // ── Left arm top rail
  add(-96,  92,   8,  22,  14, 168,
        [-390, 128, -50],    [ 0,    -1.40, -0.40], 0.18, 0.92);

  // ── Right arm body
  add( 96,  12,   0,  22,  82, 186,
        [ 365, 85, 0],       [ 0,     1.20, 0   ], 0.13, 0.90);

  // ── Right arm top rail
  add( 96,  92,   8,  22,  14, 168,
        [ 390, 128, -50],    [ 0,     1.40,  0.40], 0.18, 0.92);

  // ── Front-right leg
  add( 74, -75,  74,  14,  80,  14,
        [ 210, -280, 215],   [ 0.40, -0.90, -0.60], 0.30, 0.82);

  // ── Front-left leg
  add(-74, -75,  74,  14,  80,  14,
        [-210, -280, 215],   [ 0.40,  0.90,  0.60], 0.30, 0.82);

  // ── Back-right leg
  add( 74, -75, -74,  14,  80,  14,
        [ 210, -280, -265],  [-0.40, -0.90, -0.60], 0.37, 0.82);

  // ── Back-left leg
  add(-74, -75, -74,  14,  80,  14,
        [-210, -280, -265],  [-0.40,  0.90,  0.60], 0.37, 0.82);

  return pieces;
}

const CHAIR_PIECES = buildChair();

/* ── Floor grid (world space, Y = -75 = ground level) ───────── */
const FLOOR_GRID: [V3, V3][] = [];
for (let i = -5; i <= 5; i++) {
  FLOOR_GRID.push([[i * 100, -75, -200], [i * 100, -75, 450]]);
}
for (let j = 0; j <= 8; j++) {
  FLOOR_GRID.push([[-530, -75, j * 80 - 200], [530, -75, j * 80 - 200]]);
}

/* ── React component ────────────────────────────────────────── */
export default function PageBgScene() {
  const cvs = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = cvs.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let W = 0, H = 0;
    let scrollP  = 0;
    let mouseX   = 0, mouseY = 0;
    let camX     = 0, camY   = 0;   // smoothed mouse offset
    let rafId: number;

    const resize = () => {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    resize();

    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      scrollP = max > 0 ? Math.min(1, window.scrollY / max) : 0;
    };
    const onMouse = (e: MouseEvent) => {
      mouseX = e.clientX / window.innerWidth  - 0.5;
      mouseY = e.clientY / window.innerHeight - 0.5;
    };

    window.addEventListener("resize",    resize,   { passive: true });
    window.addEventListener("scroll",    onScroll, { passive: true });
    window.addEventListener("mousemove", onMouse,  { passive: true });

    const BASE_YAW   = 0.50; // ~29° — shows front-right corner of chair
    const BASE_PITCH = 0.32; // ~18° — slight bird's-eye view
    const DEPTH      = 480;  // chair Z-depth from camera

    const tick = () => {
      rafId = requestAnimationFrame(tick);

      camX += (mouseX * 52 - camX) * 0.05;
      camY += (mouseY * 26 - camY) * 0.05;

      /* Camera slowly orbits as chair dismantles */
      const yaw   = BASE_YAW + scrollP * 0.30;
      const pitch = BASE_PITCH;

      /* Focal length scales with screen to keep chair proportional */
      const focal = Math.max(400, Math.min(1100, W * 0.82));

      const ox = W * 0.5 + camX;
      const oy = H * 0.5 + 55 + camY; // +55 offsets chair centre to mid-screen

      ctx.clearRect(0, 0, W, H);

      /* ── Amber glow (fades as chair dismantles) ─────────── */
      const glowStrength = Math.max(0, 1 - scrollP * 2.2);
      if (glowStrength > 0.01) {
        const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, Math.min(W, H) * 0.44);
        g.addColorStop(0,    AMB(0.13 * glowStrength));
        g.addColorStop(0.5,  AMB(0.04 * glowStrength));
        g.addColorStop(1,   "transparent");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }

      /* ── Floor grid ─────────────────────────────────────── */
      ctx.lineWidth   = 0.65;
      ctx.strokeStyle = AMB(0.07);
      FLOOR_GRID.forEach(([a, b]) => {
        const ra = camRot(a, yaw, pitch);
        const rb = camRot(b, yaw, pitch);
        const [ax, ay, as_] = project([ra[0], ra[1], ra[2] + DEPTH], ox, oy, focal);
        const [bx, by, bs_] = project([rb[0], rb[1], rb[2] + DEPTH], ox, oy, focal);
        if (as_ <= 0 || bs_ <= 0) return;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
      });

      /* ── Chair pieces ───────────────────────────────────── */
      type DrawEdge = {
        x1: number; y1: number; x2: number; y2: number;
        avgZ: number; a: number; lw: number;
      };
      const drawList: DrawEdge[] = [];

      CHAIR_PIECES.forEach(piece => {
        const rawT = piece.delay < 1
          ? Math.max(0, (scrollP - piece.delay) / (1 - piece.delay))
          : scrollP;
        const t = ease(Math.min(1, rawT));

        /* Apply scatter translation */
        const [sx, sy_, sz] = piece.scatter;
        const tv: V3[] = piece.v.map(
          ([x, y, z]) => [x + t * sx, y + t * sy_, z + t * sz]
        );

        /* Spin around translated centre */
        const mc: V3 = [
          piece.cx + t * sx,
          piece.cy + t * sy_,
          piece.cz + t * sz,
        ];
        const sv = spinVerts(tv, mc[0], mc[1], mc[2],
          t * piece.spin[0], t * piece.spin[1], t * piece.spin[2]);

        /* Camera rotate */
        const rv = sv.map(v => camRot(v, yaw, pitch));

        /* Project to 2D */
        const pv = rv.map(v => project([v[0], v[1], v[2] + DEPTH], ox, oy, focal));

        piece.e.forEach(([ia, ib]) => {
          const [ax2, ay2, as2] = pv[ia];
          const [bx2, by2, bs2] = pv[ib];
          if (as2 <= 0 || bs2 <= 0) return;

          const avgZ    = (rv[ia][2] + rv[ib][2]) / 2 + DEPTH;
          const depthA  = Math.max(0.06, Math.min(0.95, (focal / avgZ) * 1.35));
          const fadeOut = 1 - t * 0.32; // pieces dim slightly as they scatter

          drawList.push({
            x1: ax2, y1: ay2, x2: bx2, y2: by2,
            avgZ,
            a:  piece.alpha * depthA * fadeOut,
            lw: Math.max(0.55, depthA * 1.6 * (1 - t * 0.42)),
          });
        });
      });

      /* Painter's algorithm: draw far → near */
      drawList.sort((a, b) => b.avgZ - a.avgZ);

      drawList.forEach(({ x1, y1, x2, y2, a, lw }) => {
        ctx.strokeStyle = AMB(a);
        ctx.lineWidth   = lw;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      });

      /* ── Edge vignette ──────────────────────────────────── */
      const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.18, W / 2, H / 2, H * 0.88);
      vig.addColorStop(0, "transparent");
      vig.addColorStop(1, "rgba(0,0,0,0.65)");
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
          "radial-gradient(ellipse at 50% 28%, #1c1235 0%, #080612 40%, #000000 100%)",
      }}
    >
      <canvas
        ref={cvs}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />
    </div>
  );
}
