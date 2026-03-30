import { useRef, useEffect } from "react";

/*
 * Pro scroll-driven 3D armchair — dismantle → pause → reassemble.
 *
 * Scroll phases:
 *   0.00 – 0.12  Assembled idle  (chair floats, camera drifts)
 *   0.12 – 0.62  Dismantle       (pieces scatter with Y-arc, scan line sweeps)
 *   0.62 – 0.74  Scattered pause (camera continues orbiting)
 *   0.74 – 1.00  Reassemble      (pieces snap back with spring overshoot)
 *
 * Per-piece stagger delays create the "click-click-click" assembly feel.
 * Camera yaw drifts continuously (slow ambient orbit) + scroll-driven orbit.
 * Painter's-algorithm Z-sort for correct depth overlap every frame.
 */

type V3   = [number, number, number];
type Edge = [number, number];

const AMB = (a: number) => `rgba(251,191,36,${a.toFixed(3)})`;

/* ── Easing ───────────────────────────────────────────────────────── */
const easeIO = (t: number): number =>
  t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;

/* Spring ease-out: settles just past 1, bounces back — for snappy reassembly */
const easeSpring = (t: number): number => {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const c1 = 1.40, c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};

/* ── Cuboid + optional extra geometry ────────────────────────────── */
function mkBox(
  cx: number, cy: number, cz: number,
  w:  number, h:  number, d:  number,
  xv?: V3[], xe?: Edge[]
): { v: V3[]; e: Edge[] } {
  const x0 = cx - w / 2, x1 = cx + w / 2;
  const y0 = cy,         y1 = cy + h;
  const z0 = cz - d / 2, z1 = cz + d / 2;
  const v: V3[] = [
    [x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],
    [x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],
  ];
  const e: Edge[] = [
    [0,1],[1,2],[2,3],[3,0],
    [4,5],[5,6],[6,7],[7,4],
    [0,4],[1,5],[2,6],[3,7],
  ];
  if (xv && xe) {
    const off = v.length;
    v.push(...xv);
    e.push(...xe.map(([a, b]) => [a + off, b + off] as Edge));
  }
  return { v, e };
}

/* ── Cushion tuft grid on a face ─────────────────────────────────── */
function tufts(y: number, x0: number, x1: number, z0: number, z1: number) {
  const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
  const v: V3[] = [[mx,y,z0],[mx,y,z1],[x0,y,mz],[x1,y,mz]];
  const e: Edge[] = [[0,1],[2,3]];
  return { v, e };
}

/* ── Camera yaw + pitch rotation ─────────────────────────────────── */
function camRot(p: V3, yaw: number, pitch: number): V3 {
  const [x, y, z] = p;
  const cy = Math.cos(yaw),   sy = Math.sin(yaw);
  const x2 = x * cy + z * sy, z2 = -x * sy + z * cy;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  return [x2, y * cp - z2 * sp, y * sp + z2 * cp];
}

/* ── Perspective project ─────────────────────────────────────────── */
function proj(p: V3, ox: number, oy: number, f: number): [number, number, number] {
  const dz = p[2] + f;
  if (dz < 1) return [0, 0, 0];
  const s = f / dz;
  return [ox + p[0] * s, oy - p[1] * s, s];   // -y: canvas Y inverted
}

/* ── Spin vertices around a moving 3D centre ─────────────────────── */
function spinV(
  verts: V3[], cx: number, cy: number, cz: number,
  ax: number, ay: number, az: number
): V3[] {
  return verts.map(([x, y, z]) => {
    x -= cx; y -= cy; z -= cz;
    if (ax) { const c = Math.cos(ax), s = Math.sin(ax); [y, z] = [y*c - z*s, y*s + z*c]; }
    if (ay) { const c = Math.cos(ay), s = Math.sin(ay); [x, z] = [x*c + z*s, -x*s + z*c]; }
    if (az) { const c = Math.cos(az), s = Math.sin(az); [x, y] = [x*c - y*s, x*s + y*c]; }
    return [x + cx, y + cy, z + cz] as V3;
  });
}

/* ── Scroll phase mapping ────────────────────────────────────────── */
const PH_IDLE_END    = 0.12;
const PH_SCATTER_END = 0.62;
const PH_PAUSE_END   = 0.74;

/**
 * Returns scatter amount t ∈ [-0.04, 1]:
 *   0  = piece at assembled position
 *   1  = piece at fully scattered position
 *  <0  = overshoot past assembled (spring snap)
 */
function scatterT(sp: number, sDel: number, aDel: number): number {
  // Phase 1: idle — fully assembled
  if (sp <= PH_IDLE_END) return 0;

  // Phase 2: dismantle — scatter out with stagger
  if (sp <= PH_SCATTER_END) {
    const p  = (sp - PH_IDLE_END) / (PH_SCATTER_END - PH_IDLE_END);
    const pp = Math.max(0, (p - sDel) / (1 - Math.min(sDel, 0.95)));
    return easeIO(Math.min(1, pp));
  }

  // Phase 3: scattered pause — all fully scattered
  if (sp <= PH_PAUSE_END) return 1;

  // Phase 4: reassemble — snap back in with stagger (reverse order)
  const p  = (sp - PH_PAUSE_END) / (1 - PH_PAUSE_END);
  const pp = Math.max(0, (p - aDel) / (1 - Math.min(aDel, 0.95)));
  // Allow slight negative for spring overshoot
  return Math.max(-0.06, 1 - easeSpring(Math.min(1, pp)));
}

/* ── Piece data ──────────────────────────────────────────────────── */
interface Piece {
  v: V3[]; e: Edge[];
  cx: number; cy: number; cz: number; // assembled centre
  scatter: V3;                         // world displacement at t=1
  arcY: number;                        // extra Y lift at arc peak (t≈0.5)
  spin: [number, number, number];      // [ax,ay,az] at t=1
  sDel: number;                        // dismantle stagger delay (0–0.5)
  aDel: number;                        // reassemble stagger delay (0–0.5, legs=0)
  alpha: number;                       // base opacity
}

/* ── Armchair geometry ───────────────────────────────────────────── */
function buildChair(): Piece[] {
  const P: Piece[] = [];

  function add(
    bx: number, by: number, bz: number,
    w:  number, h:  number, d:  number,
    sc: V3, arcY: number,
    spn: [number, number, number],
    sDel: number, aDel: number, alpha: number,
    xv?: V3[], xe?: Edge[]
  ) {
    const g = mkBox(bx, by, bz, w, h, d, xv, xe);
    P.push({
      v: g.v, e: g.e,
      cx: bx, cy: by + h / 2, cz: bz,
      scatter: sc, arcY, spin: spn,
      sDel, aDel, alpha,
    });
  }

  /* Chair Y-up: ground = −75, seat top = 58, backrest top = 218 */

  // Seat cushion (with tuft cross lines on top face y=58)
  const st = tufts(58, -93, 93, -85, 85);
  add(  0,  38,   0,  186,  20, 170,
        [0, -272, 0],          42,
        [ 0.50,  0,    0.20], 0.22, 0.46, 1.00,
        st.v, st.e);

  // Seat frame (structural under-carriage)
  add(  0,   5,   0,  200,  35, 184,
        [0, -318, 58],          0,
        [ 0.38,  0,   -0.18], 0.28, 0.36, 0.86);

  // Backrest cushion (with tuft lines on front z-face)
  const bt = tufts(218, -84, 84, -93, -75);
  add(  0,  58, -84,  168, 160,  18,
        [0, 308, -382],         88,
        [-1.05,  0.12,  0   ], 0.04, 0.70, 1.00,
        bt.v, bt.e);

  // Backrest frame
  add(  0,  53, -95,  198, 190,  28,
        [0, 228, -422],         68,
        [-0.82,  0,    0.10], 0.08, 0.62, 0.84);

  // Left arm body
  add(-96,  12,   0,   22,  82, 186,
        [-365, 88,   0],         52,
        [ 0,  -1.22, 0   ], 0.13, 0.52, 0.90);

  // Left arm top rail
  add(-96,  92,   8,   22,  14, 168,
        [-392, 132, -52],        32,
        [ 0,  -1.42,-0.42], 0.18, 0.56, 0.92);

  // Right arm body
  add( 96,  12,   0,   22,  82, 186,
        [ 365, 88,   0],         52,
        [ 0,   1.22, 0   ], 0.13, 0.52, 0.90);

  // Right arm top rail
  add( 96,  92,   8,   22,  14, 168,
        [ 392, 132, -52],        32,
        [ 0,   1.42, 0.42], 0.18, 0.56, 0.92);

  // Front-right leg
  add( 74, -75,  74,   14,  80,  14,
        [ 218, -285, 218],        0,
        [ 0.42,-0.92,-0.62], 0.30, 0.20, 0.82);

  // Front-left leg
  add(-74, -75,  74,   14,  80,  14,
        [-218, -285, 218],        0,
        [ 0.42, 0.92, 0.62], 0.30, 0.20, 0.82);

  // Back-right leg
  add( 74, -75, -74,   14,  80,  14,
        [ 218, -285,-268],        0,
        [-0.42,-0.92,-0.62], 0.37, 0.08, 0.82);

  // Back-left leg
  add(-74, -75, -74,   14,  80,  14,
        [-218, -285,-268],        0,
        [-0.42, 0.92, 0.62], 0.37, 0.08, 0.82);

  return P;
}

const CHAIR = buildChair();

/* ── Floor grid (world space, Y = ground level −75) ─────────────── */
const FLOOR: [V3, V3][] = [];
for (let i = -5; i <= 5; i++)
  FLOOR.push([[i * 100, -75, -200], [i * 100, -75, 450]]);
for (let j = 0; j <= 8; j++)
  FLOOR.push([[-530, -75, j * 80 - 200], [530, -75, j * 80 - 200]]);

/* ── Component ───────────────────────────────────────────────────── */
export default function PageBgScene() {
  const cvs = useRef<HTMLCanvasElement>(null);
  const t0  = useRef(Date.now());

  useEffect(() => {
    const canvas = cvs.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let W = 0, H = 0;
    let scrollP = 0;
    let mouseX  = 0, mouseY = 0;
    let camX    = 0, camY   = 0;
    let rafId: number;

    const resize   = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
    const onScroll = () => { const mx = document.documentElement.scrollHeight - window.innerHeight; scrollP = mx > 0 ? Math.min(1, window.scrollY / mx) : 0; };
    const onMouse  = (e: MouseEvent) => { mouseX = e.clientX / window.innerWidth - 0.5; mouseY = e.clientY / window.innerHeight - 0.5; };

    resize();
    window.addEventListener("resize",    resize,   { passive: true });
    window.addEventListener("scroll",    onScroll, { passive: true });
    window.addEventListener("mousemove", onMouse,  { passive: true });

    const BASE_YAW   = 0.48;   // ~27° — show front-right corner
    const BASE_PITCH = 0.30;   // ~17° — mild overhead view
    const DEPTH      = 480;    // chair Z from camera

    const tick = () => {
      rafId = requestAnimationFrame(tick);

      /* Smooth mouse parallax */
      camX += (mouseX * 50 - camX) * 0.05;
      camY += (mouseY * 24 - camY) * 0.05;

      /* Camera orbit:
           slow continuous drift (ambient life)
         + scroll-driven orbit (matches dismantle direction)             */
      const elapsed    = (Date.now() - t0.current) * 0.001; // seconds
      const ambOrbit   = elapsed * 0.038;                    // ~1 rev / 2.7 min
      const scrOrbit   = scrollP * 0.48;
      const yaw        = BASE_YAW + ambOrbit + scrOrbit;
      const pitch      = BASE_PITCH;

      /* Focal length: scales with viewport for consistent chair size */
      const focal = Math.max(380, Math.min(W * 0.62, 920));

      /* Idle float when assembled */
      const floatY = scrollP <= PH_IDLE_END
        ? Math.sin(elapsed * 1.05) * 5.5 * (1 - scrollP / PH_IDLE_END * 0.5)
        : 0;

      const ox = W * 0.5 + camX;
      const oy = H * 0.5 + 58 + camY + floatY;

      ctx.clearRect(0, 0, W, H);

      /* ── Phase-aware ambient glow ──────────────────────────── */
      let glow = 0;
      if      (scrollP <= PH_IDLE_END)    glow = 1;
      else if (scrollP <= PH_SCATTER_END) glow = 1 - (scrollP - PH_IDLE_END) / (PH_SCATTER_END - PH_IDLE_END) * 0.82;
      else if (scrollP <= PH_PAUSE_END)   glow = 0.18;
      else                                glow = 0.18 + (scrollP - PH_PAUSE_END) / (1 - PH_PAUSE_END) * 0.82;

      if (glow > 0.02) {
        const r = Math.min(W, H) * 0.44;
        const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, r);
        g.addColorStop(0,   AMB(0.14 * glow));
        g.addColorStop(0.5, AMB(0.04 * glow));
        g.addColorStop(1,  "transparent");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }

      /* ── Floor grid (expands slightly while chair is scattered) ── */
      const overallT =
        scrollP <= PH_IDLE_END    ? 0 :
        scrollP <= PH_SCATTER_END ? (scrollP - PH_IDLE_END) / (PH_SCATTER_END - PH_IDLE_END) :
        scrollP <= PH_PAUSE_END   ? 1 :
        1 - (scrollP - PH_PAUSE_END) / (1 - PH_PAUSE_END);
      const gs = 1 + overallT * 0.18;  // grid scale at scatter peak = 1.18×

      ctx.lineWidth   = 0.65;
      ctx.strokeStyle = AMB(0.07);
      FLOOR.forEach(([a, b]) => {
        const ra = camRot([a[0] * gs, a[1], a[2]], yaw, pitch);
        const rb = camRot([b[0] * gs, b[1], b[2]], yaw, pitch);
        const [ax, ay, as_] = proj([ra[0], ra[1], ra[2] + DEPTH], ox, oy, focal);
        const [bx, by, bs_] = proj([rb[0], rb[1], rb[2] + DEPTH], ox, oy, focal);
        if (as_ <= 0 || bs_ <= 0) return;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      });

      /* ── Chair pieces ──────────────────────────────────────── */
      type DrawEdge = { x1: number; y1: number; x2: number; y2: number; avgZ: number; a: number; lw: number };
      const dlist: DrawEdge[] = [];

      CHAIR.forEach(piece => {
        const t = scatterT(scrollP, piece.sDel, piece.aDel);

        const [sx, sy_, sz] = piece.scatter;
        const arcBoost = piece.arcY * Math.sin(Math.PI * Math.max(0, Math.min(1, t)));

        /* Translate vertices (scatter + parabolic arc) */
        const tv: V3[] = piece.v.map(
          ([x, y, z]) => [x + t * sx, y + t * sy_ + arcBoost, z + t * sz]
        );

        /* Spin around translated centre */
        const mcx = piece.cx + t * sx;
        const mcy = piece.cy + t * sy_ + arcBoost;
        const mcz = piece.cz + t * sz;
        const sv = spinV(tv, mcx, mcy, mcz,
          t * piece.spin[0], t * piece.spin[1], t * piece.spin[2]);

        /* Camera rotate → project */
        const rv = sv.map(v => camRot(v, yaw, pitch));
        const pv = rv.map(v => proj([v[0], v[1], v[2] + DEPTH], ox, oy, focal));

        piece.e.forEach(([ia, ib]) => {
          const [ax, ay, as_] = pv[ia];
          const [bx, by, bs_] = pv[ib];
          if (as_ <= 0 || bs_ <= 0) return;

          const avgZ    = (rv[ia][2] + rv[ib][2]) / 2 + DEPTH;
          const depthA  = Math.max(0.06, Math.min(0.95, focal / avgZ * 1.38));
          const tClamped = Math.max(0, Math.min(1, t));
          const fadeOut  = 1 - tClamped * 0.28;

          dlist.push({
            x1: ax, y1: ay, x2: bx, y2: by,
            avgZ,
            a:  piece.alpha * depthA * fadeOut,
            lw: Math.max(0.5, depthA * 1.65 * (1 - tClamped * 0.42)),
          });
        });
      });

      /* Painter's algorithm: far → near */
      dlist.sort((a, b) => b.avgZ - a.avgZ);
      dlist.forEach(({ x1, y1, x2, y2, a, lw }) => {
        ctx.strokeStyle = AMB(a);
        ctx.lineWidth   = lw;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      });

      /* ── Scan line sweeps top → bottom during dismantle ─────── */
      if (scrollP > PH_IDLE_END && scrollP <= PH_SCATTER_END) {
        const scanP  = (scrollP - PH_IDLE_END) / (PH_SCATTER_END - PH_IDLE_END);
        const scanY  = (oy - H * 0.44) + scanP * H * 0.72;
        const sw     = Math.min(W * 0.88, 680);

        /* Line */
        const lg = ctx.createLinearGradient(ox - sw / 2, 0, ox + sw / 2, 0);
        lg.addColorStop(0,   "transparent");
        lg.addColorStop(0.15, AMB(0.55));
        lg.addColorStop(0.85, AMB(0.55));
        lg.addColorStop(1,   "transparent");
        ctx.strokeStyle = lg;
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        ctx.moveTo(ox - sw / 2, scanY);
        ctx.lineTo(ox + sw / 2, scanY);
        ctx.stroke();

        /* Soft glow band around scan line */
        const band = ctx.createLinearGradient(ox, scanY - 22, ox, scanY + 22);
        band.addColorStop(0,   "transparent");
        band.addColorStop(0.5, AMB(0.07));
        band.addColorStop(1,   "transparent");
        ctx.fillStyle = band;
        ctx.fillRect(ox - sw / 2, scanY - 22, sw, 44);
      }

      /* ── Edge vignette ─────────────────────────────────────── */
      const vig = ctx.createRadialGradient(W/2, H/2, H * 0.16, W/2, H/2, H * 0.90);
      vig.addColorStop(0, "transparent");
      vig.addColorStop(1, "rgba(0,0,0,0.68)");
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
          "radial-gradient(ellipse at 50% 30%, #1e1440 0%, #08060e 42%, #000000 100%)",
      }}
    >
      <canvas
        ref={cvs}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />
    </div>
  );
}
