import { useRef, useEffect } from "react";

/*
 * Pro 3D armchair — puffed cushion geometry, slat detail, spark particles,
 * ground shadow, dual-tone edge rendering (structural amber vs detail gold),
 * 4-phase scroll animation with spring reassembly.
 */

type V3   = [number, number, number];
type Edge = [number, number];

/* Two-tone palette: structural (deep amber) / detail (bright gold) */
const AMB  = (a: number) => `rgba(251,191,36,${a.toFixed(3)})`;  // structural
const GOLD = (a: number) => `rgba(255,218,90,${a.toFixed(3)})`;  // detail / close highlight

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
): { v: V3[]; e: Edge[] } {
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
  if (xv && xe) {
    const off = v.length;
    v.push(...xv);
    e.push(...xe.map(([a, b]) => [a + off, b + off] as Edge));
  }
  return { v, e };
}

/** Merge multiple extra-geometry objects into one xv/xe pair */
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

/** 3×3 tuft grid on a horizontal face (Y = topY) */
function tufts3(topY: number, x0: number, x1: number, z0: number, z1: number) {
  const t1x = x0 + (x1-x0)/3, t2x = x0 + (x1-x0)*2/3;
  const t1z = z0 + (z1-z0)/3, t2z = z0 + (z1-z0)*2/3;
  return {
    v: [[t1x,topY,z0],[t1x,topY,z1],[t2x,topY,z0],[t2x,topY,z1],
        [x0,topY,t1z],[x1,topY,t1z],[x0,topY,t2z],[x1,topY,t2z]] as V3[],
    e: [[0,1],[2,3],[4,5],[6,7]] as Edge[],
  };
}

/** Dome cap: 4 edge-midpoints + 1 crown → 4 radiating spokes (Y face) */
function domeCap(flatY: number, domeY: number, x0: number, x1: number, z0: number, z1: number) {
  const mx = (x0+x1)/2, mz = (z0+z1)/2;
  return {
    v: [[mx,flatY,z0],[mx,flatY,z1],[x0,flatY,mz],[x1,flatY,mz],
        [mx,domeY,mz]] as V3[],
    e: [[0,4],[1,4],[2,4],[3,4]] as Edge[],
  };
}

/** Backrest pillow puff: 4 edge-midpoints + 1 crown → 4 spokes (Z face) */
function frontPuff(x0: number, x1: number, y0: number, y1: number, zFlat: number, zCrown: number) {
  const mx = (x0+x1)/2, my = (y0+y1)/2;
  return {
    v: [[mx,y0,zFlat],[mx,y1,zFlat],[x0,my,zFlat],[x1,my,zFlat],
        [mx,my,zCrown]] as V3[],
    e: [[0,4],[1,4],[2,4],[3,4]] as Edge[],
  };
}

/** Horizontal slat lines on a vertical front face (Z = zFace) */
function slats(x0: number, x1: number, y0: number, y1: number, zFace: number, n = 3) {
  const v: V3[] = [], e: Edge[] = [];
  for (let i = 1; i <= n; i++) {
    const y = y0 + (y1 - y0) * (i / (n + 1));
    const off = (i - 1) * 2;
    v.push([x0, y, zFace], [x1, y, zFace]);
    e.push([off, off + 1]);
  }
  // Centre vertical
  const mx = (x0+x1)/2, cv = n * 2;
  v.push([mx, y0, zFace], [mx, y1, zFace]);
  e.push([cv, cv + 1]);
  return { v, e };
}

/** X cross-brace between 4 corner points (any face) */
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
  v: V3[]; e: Edge[];
  cx: number; cy: number; cz: number;
  scatter: V3; arcY: number;
  spin: [number, number, number];
  sDel: number; aDel: number; alpha: number;
}

/* ── Armchair geometry (enriched) ─────────────────────────── */
function buildChair(): Piece[] {
  const P: Piece[] = [];

  function add(
    bx: number, by: number, bz: number,
    w:  number, h:  number, d:  number,
    sc: V3, arcY: number, spn: [number,number,number],
    sDel: number, aDel: number, alpha: number,
    xv?: V3[], xe?: Edge[]
  ) {
    const g = mkBox(bx, by, bz, w, h, d, xv, xe);
    P.push({ v:g.v, e:g.e, cx:bx, cy:by+h/2, cz:bz, scatter:sc, arcY, spin:spn, sDel, aDel, alpha });
  }

  // ── Seat cushion — 3×3 tuft grid + dome puff on top (Y=58)
  const [sv, se] = merge(
    tufts3(58, -93, 93, -85, 85),
    domeCap(58, 66.5, -93, 93, -85, 85)
  );
  add(0, 38, 0, 186, 20, 170,
      [0,-272,0], 44, [0.50,0,0.20], 0.22, 0.46, 1.00, sv, se);

  // ── Seat frame — X brace on underside
  const [sfv, sfe] = merge(
    xBrace([-98,5,-90],[98,40,90],[98,5,-90],[-98,40,90])
  );
  add(0, 5, 0, 200, 35, 184,
      [0,-318,58], 0, [0.38,0,-0.18], 0.28, 0.36, 0.86, sfv, sfe);

  // ── Front skirt rail (decorative apron)
  add(0, 7, 92, 196, 14, 8,
      [0,-285,62], 16, [0.32,0,0.18], 0.25, 0.42, 0.88);

  // ── Backrest cushion — front puff + 3 horizontal slats + centre vertical
  const [bcv, bce] = merge(
    frontPuff(-84, 84, 58, 218, -75, -66.5),
    slats(-84, 84, 58, 218, -75, 3)
  );
  add(0, 58, -84, 168, 160, 18,
      [0,308,-382], 92, [-1.05,0.12,0], 0.04, 0.70, 1.00, bcv, bce);

  // ── Backrest frame — X brace on front face
  const [bfv, bfe] = merge(
    xBrace([-97,53,-82],[97,243,-82],[97,53,-82],[-97,243,-82])
  );
  add(0, 53, -95, 198, 190, 28,
      [0,228,-422], 70, [-0.82,0,0.10], 0.08, 0.62, 0.84, bfv, bfe);

  // ── Left arm — inner front-face detail line
  const [lav, lae] = merge({ v:[[-85,12,-90],[-85,94,-90]] as V3[], e:[[0,1]] as Edge[] });
  add(-96, 12, 0, 22, 82, 186,
      [-365,88,0], 52, [0,-1.22,0], 0.13, 0.52, 0.90, lav, lae);

  // ── Left arm top rail
  add(-96, 92, 8, 22, 14, 168,
      [-392,132,-52], 32, [0,-1.42,-0.42], 0.18, 0.56, 0.92);

  // ── Right arm — inner front-face detail line
  const [rav, rae] = merge({ v:[[85,12,-90],[85,94,-90]] as V3[], e:[[0,1]] as Edge[] });
  add(96, 12, 0, 22, 82, 186,
      [365,88,0], 52, [0,1.22,0], 0.13, 0.52, 0.90, rav, rae);

  // ── Right arm top rail
  add(96, 92, 8, 22, 14, 168,
      [392,132,-52], 32, [0,1.42,0.42], 0.18, 0.56, 0.92);

  // ── Four legs
  add( 74,-75, 74,14,80,14,[ 218,-285, 218],0,[ 0.42,-0.92,-0.62],0.30,0.20,0.82);
  add(-74,-75, 74,14,80,14,[-218,-285, 218],0,[ 0.42, 0.92, 0.62],0.30,0.20,0.82);
  add( 74,-75,-74,14,80,14,[ 218,-285,-268],0,[-0.42,-0.92,-0.62],0.37,0.08,0.82);
  add(-74,-75,-74,14,80,14,[-218,-285,-268],0,[-0.42, 0.92, 0.62],0.37,0.08,0.82);

  return P;
}

const CHAIR = buildChair();

/* ── Floor grid ─────────────────────────────────────────────── */
const FLOOR: [V3, V3][] = [];
for (let i = -5; i <= 5; i++)
  FLOOR.push([[i*100,-75,-200],[i*100,-75,450]]);
for (let j = 0; j <= 8; j++)
  FLOOR.push([[-530,-75,j*80-200],[530,-75,j*80-200]]);

/* ── Spark particle ─────────────────────────────────────────── */
interface Spark { x:number;y:number;z:number;vx:number;vy:number;vz:number;life:number; }

/* ── Component ──────────────────────────────────────────────── */
export default function PageBgScene() {
  const cvs = useRef<HTMLCanvasElement>(null);
  const t0  = useRef(Date.now());

  useEffect(() => {
    const canvas = cvs.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let W = 0, H = 0, scrollP = 0, mouseX = 0, mouseY = 0, camX = 0, camY = 0, raf = 0;
    const sparks: Spark[] = [];
    let frame = 0;

    const resize   = () => { W = canvas.width  = window.innerWidth; H = canvas.height = window.innerHeight; };
    const onScroll = () => { const mx = document.documentElement.scrollHeight - window.innerHeight; scrollP = mx > 0 ? Math.min(1, window.scrollY / mx) : 0; };
    const onMouse  = (e: MouseEvent) => { mouseX = e.clientX / window.innerWidth - 0.5; mouseY = e.clientY / window.innerHeight - 0.5; };

    resize();
    window.addEventListener("resize",    resize,   { passive:true });
    window.addEventListener("scroll",    onScroll, { passive:true });
    window.addEventListener("mousemove", onMouse,  { passive:true });

    const BASE_YAW = 0.48, BASE_PITCH = 0.30, DEPTH = 480;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      frame++;

      camX += (mouseX * 50 - camX) * 0.05;
      camY += (mouseY * 24 - camY) * 0.05;

      const elapsed  = (Date.now() - t0.current) * 0.001;
      const yaw      = BASE_YAW + elapsed * 0.038 + scrollP * 0.48;
      const pitch    = BASE_PITCH;
      const focal    = Math.max(390, Math.min(W * 0.63, 930));
      const floatY   = scrollP <= PH_IDLE ? Math.sin(elapsed * 1.05) * 5.5 : 0;
      const ox       = W * 0.5 + camX;
      const oy       = H * 0.5 + 58 + camY + floatY;

      ctx.clearRect(0, 0, W, H);

      /* ── Overall scatter amount (for grid/shadow) ──────────── */
      const oT =
        scrollP <= PH_IDLE  ? 0 :
        scrollP <= PH_DIS   ? (scrollP - PH_IDLE) / (PH_DIS - PH_IDLE) :
        scrollP <= PH_PAUSE ? 1 :
        1 - (scrollP - PH_PAUSE) / (1 - PH_PAUSE);

      /* ── Phase-aware glow ───────────────────────────────────── */
      let glow =
        scrollP <= PH_IDLE  ? 1 :
        scrollP <= PH_DIS   ? 1 - (scrollP - PH_IDLE) / (PH_DIS - PH_IDLE) * 0.82 :
        scrollP <= PH_PAUSE ? 0.18 :
        0.18 + (scrollP - PH_PAUSE) / (1 - PH_PAUSE) * 0.82;

      if (glow > 0.02) {
        const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, Math.min(W,H)*0.44);
        g.addColorStop(0,   AMB(0.15 * glow));
        g.addColorStop(0.5, AMB(0.04 * glow));
        g.addColorStop(1,  "transparent");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }

      /* ── Ground shadow ──────────────────────────────────────── */
      const gc = camRot([0, -75, 0], yaw, pitch);
      const [gx, gy, gs] = proj([gc[0],gc[1],gc[2]+DEPTH], ox, oy, focal);
      if (gs > 0) {
        const gr = focal * gs * 0.32 * (1 + oT * 0.4);
        const sdw = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
        sdw.addColorStop(0, AMB(0.10 * (1 - oT * 0.85)));
        sdw.addColorStop(1, "transparent");
        ctx.fillStyle = sdw;
        ctx.fillRect(0, 0, W, H);
      }

      /* ── Floor grid ─────────────────────────────────────────── */
      const gs2 = 1 + oT * 0.18;
      ctx.lineWidth = 0.65; ctx.strokeStyle = AMB(0.065);
      FLOOR.forEach(([a, b]) => {
        const ra = camRot([a[0]*gs2, a[1], a[2]], yaw, pitch);
        const rb = camRot([b[0]*gs2, b[1], b[2]], yaw, pitch);
        const [ax,ay,as_] = proj([ra[0],ra[1],ra[2]+DEPTH], ox, oy, focal);
        const [bx,by,bs_] = proj([rb[0],rb[1],rb[2]+DEPTH], ox, oy, focal);
        if (as_<=0||bs_<=0) return;
        ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
      });

      /* ── Chair — build draw list ────────────────────────────── */
      type DE = { x1:number;y1:number;x2:number;y2:number;avgZ:number;a:number;lw:number;det:boolean };
      const dl: DE[] = [];

      CHAIR.forEach(piece => {
        const t = scatterT(scrollP, piece.sDel, piece.aDel);
        const [sx,sy_,sz] = piece.scatter;
        const arc = piece.arcY * Math.sin(Math.PI * Math.max(0,Math.min(1,t)));
        const tv: V3[] = piece.v.map(([x,y,z]) => [x+t*sx, y+t*sy_+arc, z+t*sz]);
        const mc: V3 = [piece.cx+t*sx, piece.cy+t*sy_+arc, piece.cz+t*sz];
        const sv = spinV(tv, mc[0],mc[1],mc[2], t*piece.spin[0], t*piece.spin[1], t*piece.spin[2]);
        const rv = sv.map(v => camRot(v, yaw, pitch));
        const pv = rv.map(v => proj([v[0],v[1],v[2]+DEPTH], ox, oy, focal));

        piece.e.forEach(([ia, ib], ei) => {
          const [ax,ay,as2] = pv[ia], [bx,by,bs2] = pv[ib];
          if (as2<=0||bs2<=0) return;
          const avgZ = (rv[ia][2]+rv[ib][2])/2 + DEPTH;
          const dep  = Math.max(0.06, Math.min(0.95, focal/avgZ * 1.38));
          const tc   = Math.max(0, Math.min(1, t));
          dl.push({
            x1:ax,y1:ay,x2:bx,y2:by, avgZ,
            a:  piece.alpha * dep * (1 - tc*0.28),
            lw: Math.max(0.5, dep * 1.65 * (1 - tc*0.42)),
            det: ei >= 12,   // extra edges are detail (gold)
          });
        });
      });

      dl.sort((a, b) => b.avgZ - a.avgZ);

      /* ── Glow halo pass (thick dim strokes for near edges) ─── */
      dl.forEach(({ x1,y1,x2,y2,a,lw }) => {
        if (lw < 0.9) return;
        ctx.strokeStyle = AMB(a * 0.09);
        ctx.lineWidth   = lw * 6;
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
      });

      /* ── Main draw pass ─────────────────────────────────────── */
      dl.forEach(({ x1,y1,x2,y2,a,lw,det }) => {
        ctx.strokeStyle = det ? GOLD(a * 1.1) : AMB(a);
        ctx.lineWidth   = lw;
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
      });

      /* ── Spark particles ────────────────────────────────────── */
      if (scrollP > PH_IDLE && scrollP < PH_DIS) {
        if (frame % 3 === 0 && sparks.length < 45) {
          const a = Math.random() * Math.PI * 2;
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
      for (let i = sparks.length-1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx; s.y += s.vy; s.z += s.vz;
        s.vy -= 0.06;
        s.life -= 0.020;
        if (s.life <= 0) { sparks.splice(i,1); continue; }
        const sr = camRot([s.x,s.y,s.z], yaw, pitch);
        const [px,py,ps] = proj([sr[0],sr[1],sr[2]+DEPTH], ox, oy, focal);
        if (ps <= 0) continue;
        const r = Math.max(0.8, ps * 1.8);
        ctx.fillStyle = GOLD(s.life * 0.75);
        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI*2); ctx.fill();
      }

      /* ── Scan line during dismantle ─────────────────────────── */
      if (scrollP > PH_IDLE && scrollP <= PH_DIS) {
        const scanP = (scrollP - PH_IDLE) / (PH_DIS - PH_IDLE);
        const scanY = (oy - H * 0.44) + scanP * H * 0.72;
        const sw    = Math.min(W * 0.88, 680);
        const lg    = ctx.createLinearGradient(ox-sw/2,0,ox+sw/2,0);
        lg.addColorStop(0,"transparent"); lg.addColorStop(0.12,GOLD(0.60));
        lg.addColorStop(0.88,GOLD(0.60)); lg.addColorStop(1,"transparent");
        ctx.strokeStyle = lg; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(ox-sw/2,scanY); ctx.lineTo(ox+sw/2,scanY); ctx.stroke();
        const band = ctx.createLinearGradient(ox,scanY-20,ox,scanY+20);
        band.addColorStop(0,"transparent"); band.addColorStop(0.5,GOLD(0.06)); band.addColorStop(1,"transparent");
        ctx.fillStyle = band; ctx.fillRect(ox-sw/2,scanY-20,sw,40);
      }

      /* ── Edge vignette ──────────────────────────────────────── */
      const vig = ctx.createRadialGradient(W/2,H/2,H*0.16,W/2,H/2,H*0.90);
      vig.addColorStop(0,"transparent"); vig.addColorStop(1,"rgba(0,0,0,0.68)");
      ctx.fillStyle = vig; ctx.fillRect(0,0,W,H);
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
      position:"fixed", inset:0, zIndex:-1, pointerEvents:"none", overflow:"hidden",
      background:"radial-gradient(ellipse at 50% 30%, #1e1440 0%, #08060e 42%, #000000 100%)",
    }}>
      <canvas ref={cvs} style={{ position:"absolute", inset:0, width:"100%", height:"100%" }} />
    </div>
  );
}
