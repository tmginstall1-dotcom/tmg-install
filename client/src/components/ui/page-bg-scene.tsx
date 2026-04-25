import { useRef, useEffect } from "react";

/*
 * Pro 3D armchair — puffed cushion geometry, slat detail, spark particles,
 * ground shadow, dual-tone edge rendering (structural amber vs detail gold),
 * 4-phase scroll animation with spring reassembly.
 *
 * UPGRADED: compound harmonic float · ambient particle cloud · 3D sonar rings ·
 * triple-pass bloom · edge breathing · reassembly burst · trailing scan · HUD brackets
 */

type V3   = [number, number, number];
type Edge = [number, number];

/* Two-tone palette: structural (deep amber) / detail (bright gold) */
const AMB  = (a: number) => `rgba(251,191,36,${a.toFixed(3)})`;
const GOLD = (a: number) => `rgba(255,218,90,${a.toFixed(3)})`;

const easeIO = (t: number): number =>
  t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;

const easeSpring = (t: number): number => {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const c1 = 1.45, c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};

/* ── Geometry helpers ───────────────────────────────────────── */

function mkBox(
  cx: number, cy: number, cz: number,
  w: number,  h: number,  d: number,
  xv?: V3[], xe?: Edge[]
): { v: V3[]; e: Edge[]; f: number[][] } {
  const x0 = cx - w/2, x1 = cx + w/2;
  const y0 = cy,       y1 = cy + h;
  const z0 = cz - d/2, z1 = cz + d/2;
  const v: V3[] = [
    [x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],
    [x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],
  ];
  const e: Edge[] = [
    [0,1],[1,2],[2,3],[3,0],
    [4,5],[5,6],[6,7],[7,4],
    [0,4],[1,5],[2,6],[3,7],
  ];
  /* Faces wound CCW when viewed from outside the box */
  const f: number[][] = [
    [0,3,2,1], // back   (-z)
    [4,5,6,7], // front  (+z)
    [3,7,6,2], // top    (+y)
    [0,1,5,4], // bottom (-y)
    [1,2,6,5], // right  (+x)
    [0,4,7,3], // left   (-x)
  ];
  if (xv && xe) {
    const off = v.length;
    v.push(...xv);
    e.push(...xe.map(([a, b]) => [a + off, b + off] as Edge));
  }
  return { v, e, f };
}

function merge(...parts: { v: V3[]; e: Edge[] }[]): [V3[], Edge[]] {
  const v: V3[] = [], e: Edge[] = [];
  let off = 0;
  parts.forEach(p => {
    v.push(...p.v);
    e.push(...p.e.map(([a, b]) => [a + off, b + off] as Edge));
    off += p.v.length;
  });
  return [v, e];
}

function tufts3(topY: number, x0: number, x1: number, z0: number, z1: number) {
  const t1x = x0 + (x1-x0)/3, t2x = x0 + (x1-x0)*2/3;
  const t1z = z0 + (z1-z0)/3, t2z = z0 + (z1-z0)*2/3;
  return {
    v: [[t1x,topY,z0],[t1x,topY,z1],[t2x,topY,z0],[t2x,topY,z1],
        [x0,topY,t1z],[x1,topY,t1z],[x0,topY,t2z],[x1,topY,t2z]] as V3[],
    e: [[0,1],[2,3],[4,5],[6,7]] as Edge[],
  };
}

function domeCap(flatY: number, domeY: number, x0: number, x1: number, z0: number, z1: number) {
  const mx = (x0+x1)/2, mz = (z0+z1)/2;
  return {
    v: [[mx,flatY,z0],[mx,flatY,z1],[x0,flatY,mz],[x1,flatY,mz],
        [mx,domeY,mz]] as V3[],
    e: [[0,4],[1,4],[2,4],[3,4]] as Edge[],
  };
}

function frontPuff(x0: number, x1: number, y0: number, y1: number, zFlat: number, zCrown: number) {
  const mx = (x0+x1)/2, my = (y0+y1)/2;
  return {
    v: [[mx,y0,zFlat],[mx,y1,zFlat],[x0,my,zFlat],[x1,my,zFlat],
        [mx,my,zCrown]] as V3[],
    e: [[0,4],[1,4],[2,4],[3,4]] as Edge[],
  };
}

function slats(x0: number, x1: number, y0: number, y1: number, zFace: number, n = 3) {
  const v: V3[] = [], e: Edge[] = [];
  for (let i = 1; i <= n; i++) {
    const y = y0 + (y1 - y0) * (i / (n + 1));
    const off = (i - 1) * 2;
    v.push([x0, y, zFace], [x1, y, zFace]);
    e.push([off, off + 1]);
  }
  const mx = (x0+x1)/2, cv = n * 2;
  v.push([mx, y0, zFace], [mx, y1, zFace]);
  e.push([cv, cv + 1]);
  return { v, e };
}

function xBrace(p0: V3, p1: V3, p2: V3, p3: V3) {
  return { v: [p0, p1, p2, p3] as V3[], e: [[0,1],[2,3]] as Edge[] };
}

/* ── Camera / projection ───────────────────────────────────── */

function camRot(p: V3, yaw: number, pitch: number): V3 {
  const [x, y, z] = p;
  const cy = Math.cos(yaw),   sy = Math.sin(yaw);
  const x2 = x*cy + z*sy,     z2 = -x*sy + z*cy;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  return [x2, y*cp - z2*sp, y*sp + z2*cp];
}

function proj(p: V3, ox: number, oy: number, f: number): [number, number, number] {
  const dz = p[2] + f;
  if (dz < 1) return [0, 0, 0];
  const s = f / dz;
  return [ox + p[0]*s, oy - p[1]*s, s];
}

function spinV(
  verts: V3[], cx: number, cy: number, cz: number,
  ax: number, ay: number, az: number
): V3[] {
  return verts.map(([x, y, z]) => {
    x -= cx; y -= cy; z -= cz;
    if (ax) { const c=Math.cos(ax),s=Math.sin(ax); [y,z]=[y*c-z*s,y*s+z*c]; }
    if (ay) { const c=Math.cos(ay),s=Math.sin(ay); [x,z]=[x*c+z*s,-x*s+z*c]; }
    if (az) { const c=Math.cos(az),s=Math.sin(az); [x,y]=[x*c-y*s,x*s+y*c]; }
    return [x+cx, y+cy, z+cz] as V3;
  });
}

/* ── Scroll phases ─────────────────────────────────────────── */
const PH_IDLE = 0.12, PH_DIS = 0.62, PH_PAUSE = 0.74;

function scatterT(sp: number, sDel: number, aDel: number): number {
  if (sp <= PH_IDLE) return 0;
  if (sp <= PH_DIS) {
    const p = (sp - PH_IDLE) / (PH_DIS - PH_IDLE);
    return easeIO(Math.min(1, Math.max(0, p - sDel) / (1 - Math.min(sDel, 0.95))));
  }
  if (sp <= PH_PAUSE) return 1;
  const p = (sp - PH_PAUSE) / (1 - PH_PAUSE);
  return Math.max(-0.06, 1 - easeSpring(Math.min(1, Math.max(0, p - aDel) / (1 - Math.min(aDel, 0.95)))));
}

/* ── Piece type ────────────────────────────────────────────── */
interface Piece {
  v: V3[]; e: Edge[]; f: number[][];
  cx: number; cy: number; cz: number;
  scatter: V3; arcY: number;
  spin: [number, number, number];
  sDel: number; aDel: number; alpha: number;
}

/* ── Armchair geometry (enriched) ─────────────────────────── */
function buildChair(): Piece[] {
  const P: Piece[] = [];

  /* tilt: optional [ax, ay, az, pivotX, pivotY, pivotZ] applied at build time
     (used to lean the back rearward without breaking face/edge topology) */
  function add(
    bx: number, by: number, bz: number,
    w:  number, h:  number, d:  number,
    sc: V3, arcY: number, spn: [number,number,number],
    sDel: number, aDel: number, alpha: number,
    xv?: V3[], xe?: Edge[],
    tilt?: [number, number, number, number, number, number]
  ) {
    const g = mkBox(bx, by, bz, w, h, d, xv, xe);
    let v = g.v;
    if (tilt) {
      const [ax, ay, az, px, py, pz] = tilt;
      v = spinV(v, px, py, pz, ax, ay, az);
    }
    P.push({ v, e:g.e, f:g.f, cx:bx, cy:by+h/2, cz:bz, scatter:sc, arcY, spin:spn, sDel, aDel, alpha });
  }

  /* ── Seat cushion — plumper, deeper tufting, taller dome ── */
  const [sv, se] = merge(
    tufts3(64, -94, 94, -86, 86),
    domeCap(64, 75, -94, 94, -86, 86)
  );
  add(0, 38, 0, 192, 26, 178,
      [0,-272,0], 44, [0.50,0,0.20], 0.22, 0.46, 1.00, sv, se);

  /* ── Seat frame (heavy structural support, mostly hidden under skirt) ── */
  const [sfv, sfe] = merge(
    xBrace([-98,5,-90],[98,40,90],[98,5,-90],[-98,40,90])
  );
  add(0, 5, 0, 200, 33, 184,
      [0,-318,58], 0, [0.38,0,-0.18], 0.28, 0.36, 0.78, sfv, sfe);

  /* ── Seat skirt — full 4-sided band wrapping the seat (proper sofa frame) ── */
  add(0, 5, 92, 202, 18, 8,
      [0,-285,72], 16, [0.32,0,0.18], 0.25, 0.42, 0.93);
  add(0, 5, -92, 202, 18, 8,
      [0,-285,-72], 16, [0.32,0,-0.18], 0.25, 0.42, 0.90);
  add(-96, 5, 0, 8, 18, 200,
      [-310,-285,0], 16, [0,-0.95,0], 0.26, 0.41, 0.92);
  add(96, 5, 0, 8, 18, 200,
      [310,-285,0], 16, [0,0.95,0], 0.26, 0.41, 0.92);

  /* ── Back — tilted 11° rearward for a real recline (built-in, not animated) ── */
  const BACK_TILT: [number, number, number, number, number, number] =
    [-0.19, 0, 0, 0, 58, -78];

  /* Back cushion (puffed face + 4 vertical slats) */
  const [bcv, bce] = merge(
    frontPuff(-86, 86, 60, 224, -78, -66),
    slats(-86, 86, 60, 224, -78, 4)
  );
  add(0, 60, -86, 174, 164, 22,
      [0,308,-382], 92, [-1.05,0.12,0], 0.04, 0.70, 1.00, bcv, bce, BACK_TILT);

  /* Back panel (X-brace structural backing) */
  const [bfv, bfe] = merge(
    xBrace([-99,57,-84],[99,250,-84],[99,57,-84],[-99,250,-84])
  );
  add(0, 57, -98, 202, 196, 26,
      [0,228,-422], 70, [-0.82,0,0.10], 0.08, 0.62, 0.86, bfv, bfe, BACK_TILT);

  /* ── Arms — slimmer side panels with a fuller rolled cap ── */
  const [lav, lae] = merge({ v:[[-86,14,-90],[-86,96,-90]] as V3[], e:[[0,1]] as Edge[] });
  add(-96, 12, 0, 20, 84, 188,
      [-365,88,0], 52, [0,-1.22,0], 0.13, 0.52, 0.92, lav, lae);
  /* Left arm rolled top — wider cap with slight forward lip */
  add(-96, 96, 4, 26, 16, 180,
      [-392,132,-52], 32, [0,-1.42,-0.42], 0.18, 0.56, 0.96);

  const [rav, rae] = merge({ v:[[86,14,-90],[86,96,-90]] as V3[], e:[[0,1]] as Edge[] });
  add(96, 12, 0, 20, 84, 188,
      [365,88,0], 52, [0,1.22,0], 0.13, 0.52, 0.92, rav, rae);
  add(96, 96, 4, 26, 16, 180,
      [392,132,-52], 32, [0,1.42,0.42], 0.18, 0.56, 0.96);

  /* ── Legs — slim tapered posts with small foot blocks (cabriole feel) ──
     Each corner: thin vertical post (12×68×12) sitting on a wider foot (20×7×20). */
  type LegSpec = readonly [number, number, V3, [number, number, number], number, number];
  const LEGS: ReadonlyArray<LegSpec> = [
    [ 78,  78, [ 220, -285,  220], [ 0.42, -0.92, -0.62], 0.30, 0.20] as const, // FR
    [-78,  78, [-220, -285,  220], [ 0.42,  0.92,  0.62], 0.30, 0.20] as const, // FL
    [ 78, -78, [ 220, -285, -270], [-0.42, -0.92, -0.62], 0.37, 0.08] as const, // BR
    [-78, -78, [-220, -285, -270], [-0.42,  0.92,  0.62], 0.37, 0.08] as const, // BL
  ];
  LEGS.forEach(([lx, lz, sc, spn, sDel, aDel]) => {
    /* Slim post: y = -68 to 0 (height 68), 12×12 cross-section */
    add(lx, -68, lz, 12, 68, 12, sc, 0, spn, sDel, aDel, 0.92);
    /* Foot block at floor: y = -75 to -68 (height 7), 20×20 base */
    add(lx, -75, lz, 20, 7, 20,
        [sc[0]*1.02, sc[1]-6, sc[2]*1.02] as V3, 0, spn,
        Math.min(0.95, sDel + 0.01), Math.max(0, aDel - 0.01), 0.94);
  });

  return P;
}

const CHAIR = buildChair();

/* ── Floor grid ─────────────────────────────────────────────── */
const FLOOR: [V3, V3][] = [];
for (let i = -5; i <= 5; i++)
  FLOOR.push([[i*100,-75,-200],[i*100,-75,450]]);
for (let j = 0; j <= 8; j++)
  FLOOR.push([[-530,-75,j*80-200],[530,-75,j*80-200]]);

/* ── Particle types ─────────────────────────────────────────── */
interface Spark       { x:number;y:number;z:number;vx:number;vy:number;vz:number;life:number; }
interface AmbParticle { x:number;y:number;z:number;vy:number;phase:number;spd:number;size:number; }

/* ── Component ──────────────────────────────────────────────── */
export default function PageBgScene() {
  const cvs = useRef<HTMLCanvasElement>(null);
  const t0  = useRef(Date.now());

  useEffect(() => {
    const canvas = cvs.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let W = 0, H = 0, scrollP = 0, prevScrollP = 0;
    let mouseX = 0, mouseY = 0, camX = 0, camY = 0, raf = 0;
    const sparks:  Spark[]       = [];
    const burst:   Spark[]       = [];
    const amb:     AmbParticle[] = [];
    let frame = 0;
    let hasBursted = false;

    /* Sonar ring timers — 3 rings offset by thirds */
    const ringPhase = [0.0, 0.33, 0.67];
    const RING_PERIOD = 2.6; // seconds per cycle

    /* Seed ambient particle cloud */
    for (let i = 0; i < 30; i++) {
      amb.push({
        x: (Math.random() - 0.5) * 300,
        y: Math.random() * 300 - 85,
        z: (Math.random() - 0.5) * 240,
        vy: 0.12 + Math.random() * 0.22,
        phase: Math.random() * Math.PI * 2,
        spd:   0.28 + Math.random() * 0.44,
        size:  0.5 + Math.random() * 1.5,
      });
    }

    const resize   = () => { W = canvas.width  = window.innerWidth; H = canvas.height = window.innerHeight; };
    const onScroll = () => { const mx = document.documentElement.scrollHeight - window.innerHeight; scrollP = mx > 0 ? Math.min(1, window.scrollY / mx) : 0; };
    const onMouse  = (e: MouseEvent) => { mouseX = e.clientX / window.innerWidth - 0.5; mouseY = e.clientY / window.innerHeight - 0.5; };

    resize();
    window.addEventListener("resize",    resize,   { passive: true });
    window.addEventListener("scroll",    onScroll, { passive: true });
    window.addEventListener("mousemove", onMouse,  { passive: true });

    const BASE_YAW = 0.48, BASE_PITCH = 0.30, DEPTH = 480;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      frame++;

      /* Smooth camera tracking — wider range for deeper parallax feel */
      camX += (mouseX * 80  - camX) * 0.038;
      camY += (mouseY * 36  - camY) * 0.038;

      const elapsed = (Date.now() - t0.current) * 0.001;
      const yaw     = BASE_YAW + elapsed * 0.038 + scrollP * 0.48;
      /* Subtle mouse pitch for depth feeling */
      const pitch   = BASE_PITCH + mouseY * 0.07;
      const focal   = Math.max(390, Math.min(W * 0.63, 930));

      /* Compound harmonic float — 3 sine waves for organic breathing */
      const floatY  = scrollP <= PH_IDLE
        ? Math.sin(elapsed * 1.05) * 5.5
        + Math.sin(elapsed * 1.78) * 2.2
        + Math.sin(elapsed * 0.44) * 1.0
        : 0;

      const ox = W * 0.5 + camX;
      const oy = H * 0.5 + 58 + camY + floatY;

      /* Edge breathing — subtle alpha pulse (alive feel) */
      const breathe = 0.87 + 0.13 * Math.sin(elapsed * 0.68);

      /* ── Detect reassembly crossing → emit burst ── */
      if (!hasBursted && prevScrollP < PH_PAUSE && scrollP >= PH_PAUSE) {
        hasBursted = true;
        for (let i = 0; i < 42; i++) {
          const theta = Math.acos(2 * Math.random() - 1);
          const phi   = Math.random() * Math.PI * 2;
          const spd   = 1.4 + Math.random() * 2.8;
          burst.push({
            x: (Math.random() - 0.5) * 50,
            y: (Math.random() - 0.5) * 50,
            z: (Math.random() - 0.5) * 50,
            vx: Math.sin(theta) * Math.cos(phi) * spd,
            vy: Math.abs(Math.cos(theta)) * spd + 0.6,
            vz: Math.sin(theta) * Math.sin(phi) * spd * 0.65,
            life: 1.0,
          });
        }
      }
      if (scrollP < PH_PAUSE - 0.06) hasBursted = false;
      prevScrollP = scrollP;

      ctx.clearRect(0, 0, W, H);

      /* ── Overall scatter amount (for rings/shadow) ── */
      const oT =
        scrollP <= PH_IDLE  ? 0 :
        scrollP <= PH_DIS   ? (scrollP - PH_IDLE) / (PH_DIS - PH_IDLE) :
        scrollP <= PH_PAUSE ? 1 :
        1 - (scrollP - PH_PAUSE) / (1 - PH_PAUSE);

      /* ── Ambient radial glow ── */
      let glow =
        scrollP <= PH_IDLE  ? 1 :
        scrollP <= PH_DIS   ? 1 - (scrollP - PH_IDLE) / (PH_DIS - PH_IDLE) * 0.82 :
        scrollP <= PH_PAUSE ? 0.18 :
        0.18 + (scrollP - PH_PAUSE) / (1 - PH_PAUSE) * 0.82;
      glow *= breathe;

      if (glow > 0.02) {
        const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, Math.min(W, H) * 0.44);
        g.addColorStop(0,   AMB(0.16 * glow));
        g.addColorStop(0.5, AMB(0.05 * glow));
        g.addColorStop(1,  "transparent");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }

      /* ── Ground shadow ── */
      const gc  = camRot([0, -75, 0], yaw, pitch);
      const [gx, gy, gs] = proj([gc[0], gc[1], gc[2] + DEPTH], ox, oy, focal);
      if (gs > 0) {
        const gr  = focal * gs * 0.32 * (1 + oT * 0.4);
        const sdw = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
        sdw.addColorStop(0, AMB(0.11 * (1 - oT * 0.85)));
        sdw.addColorStop(1, "transparent");
        ctx.fillStyle = sdw;
        ctx.fillRect(0, 0, W, H);
      }

      /* ── Ground sonar rings ── */
      const RING_R_MAX = 340;
      const ringFade = 1 - oT * 0.75;
      for (let ri = 0; ri < 3; ri++) {
        ringPhase[ri] = (ringPhase[ri] + 1 / (RING_PERIOD * 60)) % 1;
        const rp = ringPhase[ri];
        const rRadius = rp * RING_R_MAX;
        const rAlpha  = (1 - rp) * 0.13 * ringFade;
        if (rAlpha < 0.005) continue;

        /* Project a 32-gon circle at Y=-75 */
        const N   = 32;
        const pts: [number, number][] = [];
        for (let k = 0; k < N; k++) {
          const ang  = (k / N) * Math.PI * 2;
          const p3: V3  = [Math.cos(ang) * rRadius, -75, Math.sin(ang) * rRadius];
          const rp3 = camRot(p3, yaw, pitch);
          const [px, py, ps] = proj([rp3[0], rp3[1], rp3[2] + DEPTH], ox, oy, focal);
          if (ps > 0) pts.push([px, py]);
        }
        if (pts.length < 3) continue;
        ctx.strokeStyle = AMB(rAlpha);
        ctx.lineWidth   = 0.9;
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
        ctx.closePath();
        ctx.stroke();
      }

      /* ── Floor grid ── */
      const gs2 = 1 + oT * 0.18;
      ctx.lineWidth = 0.65; ctx.strokeStyle = AMB(0.065);
      FLOOR.forEach(([a, b]) => {
        const ra = camRot([a[0]*gs2, a[1], a[2]], yaw, pitch);
        const rb = camRot([b[0]*gs2, b[1], b[2]], yaw, pitch);
        const [ax, ay, as_] = proj([ra[0], ra[1], ra[2]+DEPTH], ox, oy, focal);
        const [bx, by, bs_] = proj([rb[0], rb[1], rb[2]+DEPTH], ox, oy, focal);
        if (as_<=0||bs_<=0) return;
        ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
      });

      /* ── Chair — build draw list ── */
      type EdgeKind = 'silh' | 'int' | 'det';
      type DE = { x1:number;y1:number;x2:number;y2:number;avgZ:number;a:number;lw:number;kind:EdgeKind };
      type DF = { pts:[number,number][]; avgZ:number; shade:number; alpha:number };
      const dl: DE[] = [];
      const fl: DF[] = [];

      /* Light direction in world space (normalized): from upper-front-left */
      const LX = -0.42, LY = -0.78, LZ = 0.46;
      const LL = Math.hypot(LX, LY, LZ);

      /* Edge → adjacent box-face indices (matches mkBox face winding):
         faces: 0=back, 1=front, 2=top, 3=bottom, 4=right, 5=left */
      const EDGE_FACES: ReadonlyArray<readonly [number, number]> = [
        [0, 3], [0, 4], [0, 2], [0, 5],  // edges 0-3 (back rim)
        [1, 3], [1, 4], [1, 2], [1, 5],  // edges 4-7 (front rim)
        [3, 5], [3, 4], [2, 4], [2, 5],  // edges 8-11 (verticals)
      ];

      CHAIR.forEach(piece => {
        const t = scatterT(scrollP, piece.sDel, piece.aDel);
        const [sx, sy_, sz] = piece.scatter;
        const arc = piece.arcY * Math.sin(Math.PI * Math.max(0, Math.min(1, t)));
        const tv: V3[] = piece.v.map(([x,y,z]) => [x+t*sx, y+t*sy_+arc, z+t*sz]);
        const mc: V3 = [piece.cx+t*sx, piece.cy+t*sy_+arc, piece.cz+t*sz];
        const sv = spinV(tv, mc[0],mc[1],mc[2], t*piece.spin[0], t*piece.spin[1], t*piece.spin[2]);
        const rv = sv.map(v => camRot(v, yaw, pitch));
        const pv = rv.map(v => proj([v[0],v[1],v[2]+DEPTH], ox, oy, focal));
        const tc = Math.max(0, Math.min(1, t));

        /* Track which box faces are camera-facing → drives silhouette detection */
        const faceFront: boolean[] = new Array(piece.f.length).fill(false);

        /* Faces — filled, shaded surfaces */
        piece.f.forEach((faceIdx, fi) => {
          const pts: [number,number][] = [];
          let sumZ = 0;
          let valid = true;
          for (const i of faceIdx) {
            const [px, py, ps] = pv[i];
            if (ps <= 0) { valid = false; break; }
            pts.push([px, py]);
            sumZ += rv[i][2] + DEPTH;
          }
          if (!valid || pts.length < 3) return;

          /* Backface cull via signed screen area (y-down → CCW outward = negative) */
          let area = 0;
          for (let i = 0; i < pts.length; i++) {
            const [x1, y1] = pts[i];
            const [x2, y2] = pts[(i + 1) % pts.length];
            area += x1 * y2 - x2 * y1;
          }
          if (area >= 0) return;
          faceFront[fi] = true;

          /* Face normal in camera space → diffuse shading */
          const v0 = rv[faceIdx[0]], v1 = rv[faceIdx[1]], v2 = rv[faceIdx[2]];
          const ux = v1[0]-v0[0], uy = v1[1]-v0[1], uz = v1[2]-v0[2];
          const wx = v2[0]-v0[0], wy = v2[1]-v0[1], wz = v2[2]-v0[2];
          let nx = uy*wz - uz*wy, ny = uz*wx - ux*wz, nz = ux*wy - uy*wx;
          const nl = Math.hypot(nx, ny, nz) || 1;
          nx /= nl; ny /= nl; nz /= nl;
          const dot = (nx*LX + ny*LY + nz*LZ) / LL;
          /* Wrap-around shading so back side isn't pitch black */
          const shade = Math.max(0.16, Math.min(1, 0.34 + 0.66 * Math.max(0, dot * 0.5 + 0.5)));

          fl.push({
            pts,
            avgZ: sumZ / faceIdx.length,
            shade,
            alpha: piece.alpha * (1 - tc * 0.55) * breathe,
          });
        });

        piece.e.forEach(([ia, ib], ei) => {
          const [ax,ay,as2] = pv[ia], [bx,by,bs2] = pv[ib];
          if (as2<=0||bs2<=0) return;

          /* Classify edge: silhouette / internal-seam / decorative-detail */
          let kind: EdgeKind;
          if (ei >= 12) {
            kind = 'det';
          } else {
            const [fA, fB] = EDGE_FACES[ei];
            const fa = faceFront[fA], fb = faceFront[fB];
            if (fa !== fb) kind = 'silh';
            else if (fa && fb) kind = 'int';
            else return; // both adjacent faces hidden → cull edge
          }

          const avgZ = (rv[ia][2]+rv[ib][2])/2 + DEPTH;
          const dep  = Math.max(0.06, Math.min(0.95, focal/avgZ * 1.38));
          dl.push({
            x1:ax, y1:ay, x2:bx, y2:by, avgZ,
            a:  piece.alpha * dep * (1 - tc*0.28) * breathe,
            lw: Math.max(0.5, dep * 1.65 * (1 - tc*0.42)),
            kind,
          });
        });
      });

      dl.sort((a, b) => b.avgZ - a.avgZ);
      fl.sort((a, b) => b.avgZ - a.avgZ);

      /* ── Pass 0: cel-shaded faces (anime draft — solid 3 flat tones) ── */
      fl.forEach(({ pts, shade, alpha }) => {
        /* Near-opaque fills so chair reads as solid form, not see-through */
        const fillA = Math.min(0.98, alpha * 0.96);
        if (fillA < 0.02) return;

        /* 3-tone cel-shade buckets: highlight / midtone / shadow */
        let r: number, g: number, b: number;
        if (shade > 0.72) {
          /* Highlight — warm cream */
          r = 248; g = 204; b = 112;
        } else if (shade > 0.46) {
          /* Midtone — amber */
          r = 176; g = 108; b = 36;
        } else {
          /* Shadow — deep umber */
          r = 48;  g = 26;  b = 10;
        }

        ctx.fillStyle = `rgba(${r},${g},${b},${fillA.toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
        ctx.fill();

        /* Hatching on shadow faces (parallel ink strokes, clipped to face) */
        if (shade < 0.50) {
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          for (const [x, y] of pts) {
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
          }
          const span = (maxX - minX) + (maxY - minY);
          if (span > 8) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(pts[0][0], pts[0][1]);
            for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
            ctx.closePath();
            ctx.clip();

            /* Light gold hatching reads against dark fill — like ink lines on toned paper */
            ctx.strokeStyle = `rgba(232,184,92,${(0.42 * alpha).toFixed(3)})`;
            ctx.lineWidth = 0.7;
            ctx.lineCap = "butt";
            const GAP = 7;
            const h = maxY - minY;
            /* 45° diagonal hatch lines */
            for (let d = minX - h; d < maxX; d += GAP) {
              ctx.beginPath();
              ctx.moveTo(d, minY);
              ctx.lineTo(d + h, maxY);
              ctx.stroke();
            }

            /* Cross-hatch on the very darkest faces for deeper shadow texture */
            if (shade < 0.30) {
              ctx.strokeStyle = `rgba(220,168,76,${(0.30 * alpha).toFixed(3)})`;
              for (let d = minX; d < maxX + h; d += GAP) {
                ctx.beginPath();
                ctx.moveTo(d, minY);
                ctx.lineTo(d - h, maxY);
                ctx.stroke();
              }
            }
            ctx.restore();
          }
        }
      });

      /* ── Pass 1: silhouette glow halo (only outline edges — anime "rim" warmth) ── */
      dl.forEach(({ x1,y1,x2,y2,a,lw,kind }) => {
        if (kind !== 'silh' || lw < 0.8) return;
        ctx.strokeStyle = AMB(a * 0.07);
        ctx.lineWidth   = lw * 5.5;
        ctx.lineCap     = "round";
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
      });

      /* ── Pass 2: ink strokes routed by edge kind ──
         Bold cream silhouette outlines the form (the "ink line"),
         thin amber seams show internal form between visible faces,
         thin gold strokes for decorative slats/tufts/braces.            */
      dl.forEach(({ x1,y1,x2,y2,a,lw,kind }) => {
        if (kind === 'silh') {
          /* Bold inked silhouette — the dominant outline */
          ctx.strokeStyle = `rgba(255,232,162,${Math.min(1, a * 1.30).toFixed(3)})`;
          ctx.lineWidth   = lw * 2.05;
        } else if (kind === 'int') {
          /* Internal seam between visible faces — quiet amber */
          ctx.strokeStyle = `rgba(196,138,52,${(a * 0.55).toFixed(3)})`;
          ctx.lineWidth   = Math.max(0.5, lw * 0.85);
        } else {
          /* Decorative detail — thin gold sketch */
          ctx.strokeStyle = GOLD(a * 0.82);
          ctx.lineWidth   = Math.max(0.5, lw * 0.7);
        }
        ctx.lineCap  = "round";
        ctx.lineJoin = "round";
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
      });

      /* ── Ambient particle cloud (always present) ── */
      amb.forEach(ap => {
        ap.y    += ap.vy;
        ap.phase += 0.016 * ap.spd;
        if (ap.y > 250) {
          ap.y     = -90;
          ap.x     = (Math.random() - 0.5) * 300;
          ap.z     = (Math.random() - 0.5) * 240;
          ap.phase = Math.random() * Math.PI * 2;
        }
        const px3: V3 = [
          ap.x + Math.sin(ap.phase)       * 14,
          ap.y,
          ap.z + Math.cos(ap.phase * 0.7) * 9,
        ];
        const rp3 = camRot(px3, yaw, pitch);
        const [sx, sy_, ss] = proj([rp3[0], rp3[1], rp3[2] + DEPTH], ox, oy, focal);
        if (ss <= 0) return;
        const heightFade = Math.max(0, 1 - Math.abs(ap.y / 250));
        const alpha = heightFade * 0.30;
        if (alpha < 0.015) return;
        const r = Math.max(ap.size * ss, 0.5);
        const ptG = ctx.createRadialGradient(sx, sy_, 0, sx, sy_, r * 3.5);
        ptG.addColorStop(0, GOLD(alpha));
        ptG.addColorStop(1, "transparent");
        ctx.fillStyle = ptG;
        ctx.beginPath(); ctx.arc(sx, sy_, r * 3.5, 0, Math.PI * 2); ctx.fill();
      });

      /* ── Sparks (during dismantle) ── */
      if (scrollP > PH_IDLE && scrollP < PH_DIS) {
        if (frame % 3 === 0 && sparks.length < 48) {
          const a  = Math.random() * Math.PI * 2;
          const sp = 0.7 + Math.random() * 1.6;
          sparks.push({
            x: (Math.random()-0.5)*220, y: Math.random()*140-25, z: (Math.random()-0.5)*160,
            vx: Math.cos(a)*sp, vy: 0.8+Math.random()*1.8, vz: Math.sin(a)*sp*0.6,
            life: 1.0,
          });
        }
      } else {
        sparks.length = 0;
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx; s.y += s.vy; s.z += s.vz;
        s.vy -= 0.06;
        s.life -= 0.020;
        if (s.life <= 0) { sparks.splice(i, 1); continue; }
        const sr = camRot([s.x,s.y,s.z], yaw, pitch);
        const [px,py,ps] = proj([sr[0],sr[1],sr[2]+DEPTH], ox, oy, focal);
        if (ps <= 0) continue;
        const r = Math.max(0.8, ps * 1.8);
        ctx.fillStyle = GOLD(s.life * 0.78);
        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI*2); ctx.fill();
      }

      /* ── Burst particles (reassembly flash) ── */
      for (let i = burst.length - 1; i >= 0; i--) {
        const b = burst[i];
        b.x += b.vx; b.y += b.vy; b.z += b.vz;
        b.vx *= 0.93; b.vy *= 0.93; b.vz *= 0.93;
        b.vy -= 0.05;
        b.life -= 0.014;
        if (b.life <= 0) { burst.splice(i, 1); continue; }
        const br = camRot([b.x, b.y, b.z], yaw, pitch);
        const [px, py, ps] = proj([br[0], br[1], br[2]+DEPTH], ox, oy, focal);
        if (ps <= 0) continue;
        const r = Math.max(0.6, ps * 2.4) * b.life;
        const bg = ctx.createRadialGradient(px, py, 0, px, py, r * 3.5);
        bg.addColorStop(0, GOLD(b.life * 0.95));
        bg.addColorStop(0.4, AMB(b.life * 0.35));
        bg.addColorStop(1, "transparent");
        ctx.fillStyle = bg;
        ctx.beginPath(); ctx.arc(px, py, r * 3.5, 0, Math.PI*2); ctx.fill();
      }

      /* ── Enhanced scan line (3 bands + 2 ghost trails) ── */
      if (scrollP > PH_IDLE && scrollP <= PH_DIS) {
        const scanProg = (scrollP - PH_IDLE) / (PH_DIS - PH_IDLE);
        const scanY    = (oy - H * 0.44) + scanProg * H * 0.72;
        const sw       = Math.min(W * 0.88, 680);

        /* Soft outer band (80px) */
        const b1 = ctx.createLinearGradient(0, scanY-40, 0, scanY+40);
        b1.addColorStop(0, "transparent"); b1.addColorStop(0.5, GOLD(0.045)); b1.addColorStop(1, "transparent");
        ctx.fillStyle = b1; ctx.fillRect(ox-sw/2, scanY-40, sw, 80);

        /* Mid band (22px) */
        const b2 = ctx.createLinearGradient(0, scanY-11, 0, scanY+11);
        b2.addColorStop(0, "transparent"); b2.addColorStop(0.5, GOLD(0.11)); b2.addColorStop(1, "transparent");
        ctx.fillStyle = b2; ctx.fillRect(ox-sw/2, scanY-11, sw, 22);

        /* Sharp core line */
        const lg = ctx.createLinearGradient(ox-sw/2, 0, ox+sw/2, 0);
        lg.addColorStop(0, "transparent"); lg.addColorStop(0.10, GOLD(0.72));
        lg.addColorStop(0.90, GOLD(0.72)); lg.addColorStop(1, "transparent");
        ctx.strokeStyle = lg; ctx.lineWidth = 1.6; ctx.lineCap = "butt";
        ctx.beginPath(); ctx.moveTo(ox-sw/2, scanY); ctx.lineTo(ox+sw/2, scanY); ctx.stroke();

        /* 2 trailing ghost lines above */
        for (let ti = 1; ti <= 2; ti++) {
          const gy = scanY - ti * 20;
          const ga = 0.28 / ti;
          const tl = ctx.createLinearGradient(ox-sw/2, 0, ox+sw/2, 0);
          tl.addColorStop(0, "transparent"); tl.addColorStop(0.14, GOLD(ga));
          tl.addColorStop(0.86, GOLD(ga)); tl.addColorStop(1, "transparent");
          ctx.strokeStyle = tl; ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.moveTo(ox-sw/2, gy); ctx.lineTo(ox+sw/2, gy); ctx.stroke();
        }
      }

      /* ── HUD corner brackets ── */
      const hudA  = 0.20 * (0.65 + 0.35 * Math.sin(elapsed * 1.15));
      const bLen  = 30, bOff = 22;
      const corners: [number, number, number, number][] = [
        [bOff,         bOff,          1,  1],
        [W - bOff,     bOff,         -1,  1],
        [bOff,         H - bOff,      1, -1],
        [W - bOff,     H - bOff,     -1, -1],
      ];
      ctx.strokeStyle = AMB(hudA); ctx.lineWidth = 1; ctx.lineCap = "square";
      corners.forEach(([x, y, sx, sy]) => {
        ctx.beginPath();
        ctx.moveTo(x + sx * bLen, y);
        ctx.lineTo(x, y);
        ctx.lineTo(x, y + sy * bLen);
        ctx.stroke();
      });

      /* ── Edge vignette ── */
      const vig = ctx.createRadialGradient(W/2, H/2, H*0.16, W/2, H/2, H*0.90);
      vig.addColorStop(0, "transparent"); vig.addColorStop(1, "rgba(0,0,0,0.68)");
      ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize",    resize);
      window.removeEventListener("scroll",    onScroll);
      window.removeEventListener("mousemove", onMouse);
    };
  }, []);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none", overflow: "hidden",
      background: "radial-gradient(ellipse at 50% 28%, #1a1035 0%, #0b0818 38%, #060409 70%, #000000 100%)",
    }}>
      <canvas ref={cvs} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
    </div>
  );
}
