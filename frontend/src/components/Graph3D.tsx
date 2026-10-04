import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const rng = (seed: number) => () =>
  (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

/**
 * A small 3D attack graph: layered nodes, grey links, one highlighted route with pulses travelling along it.
 * Decorative only. Respects prefers-reduced-motion (renders a still frame) and falls back if WebGL is unavailable.
 */
export default function Graph3D({
  variant = "hero",
  className = "",
}: {
  variant?: "hero" | "banner";
  className?: string;
}) {
  const host = useRef<HTMLDivElement>(null),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setFailed(true);
      return;
    }
    const hero = variant === "hero",
      reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    Object.assign(renderer.domElement.style, {
      width: "100%",
      height: "100%",
      display: "block",
    });
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(40, 1, 0.1, 60),
      group = new THREE.Group();
    camera.position.set(0, 0.2, hero ? 10.5 : 9.5);
    scene.fog = new THREE.Fog(0x000000, 8, 17);
    scene.add(group);

    const rand = rng(11),
      counts = hero ? [1, 3, 5, 5, 4, 2] : [1, 3, 4, 3, 2],
      L = counts.length,
      pts: THREE.Vector3[] = [],
      layers: number[][] = [];
    counts.forEach((n, l) => {
      const ids: number[] = [];
      for (let k = 0; k < n; k++) {
        pts.push(
          new THREE.Vector3(
            (l - (L - 1) / 2) * 1.9,
            (k - (n - 1) / 2) * 1.15 + (rand() - 0.5) * 0.5,
            (rand() - 0.5) * 3,
          ),
        );
        ids.push(pts.length - 1);
      }
      layers.push(ids);
    });
    const edges: [number, number][] = [];
    for (let l = 0; l < L - 1; l++) {
      for (const a of layers[l]) {
        const nb = layers[l + 1],
          i = Math.floor(rand() * nb.length);
        edges.push([a, nb[i]]);
        if (rand() > 0.45) edges.push([a, nb[(i + 1) % nb.length]]);
      }
      for (const b of layers[l + 1])
        if (!edges.some((e) => e[1] === b))
          edges.push([layers[l][Math.floor(rand() * layers[l].length)], b]);
    }
    const route = [layers[0][0]];
    for (let l = 0; l < L - 1; l++)
      route.push(edges.find((e) => e[0] === route[route.length - 1])![1]);

    const lineGeo = new THREE.BufferGeometry().setFromPoints(
      edges.flatMap(([a, b]) => [pts[a], pts[b]]),
    );
    const routeGeo = new THREE.BufferGeometry().setFromPoints(
      route.slice(1).flatMap((b, i) => [pts[route[i]], pts[b]]),
    );
    const lineMat = new THREE.LineBasicMaterial({
        color: 0x2b3d63,
        transparent: true,
        opacity: 0.9,
      }),
      routeMat = new THREE.LineBasicMaterial({ color: 0xfca311 });
    group.add(
      new THREE.LineSegments(lineGeo, lineMat),
      new THREE.LineSegments(routeGeo, routeMat),
    );
    const sph = new THREE.SphereGeometry(1, 16, 12);
    const mats = {
      base: new THREE.MeshBasicMaterial({ color: 0x6f86b3 }),
      route: new THREE.MeshBasicMaterial({ color: 0xfca311 }),
      entry: new THREE.MeshBasicMaterial({ color: 0xe5e5e5 }),
      target: new THREE.MeshBasicMaterial({ color: 0xff4d4f }),
      pulse: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    };
    pts.forEach((p, i) => {
      const isEntry = i === route[0],
        isTarget = i === route[L - 1],
        onRoute = route.includes(i),
        m = new THREE.Mesh(
          sph,
          isEntry
            ? mats.entry
            : isTarget
              ? mats.target
              : onRoute
                ? mats.route
                : mats.base,
        );
      m.scale.setScalar(
        isTarget ? 0.17 : isEntry ? 0.15 : onRoute ? 0.12 : 0.08,
      );
      m.position.copy(p);
      group.add(m);
    });
    const poly = route.map((i) => pts[i]),
      seg = poly.slice(1).map((p, i) => p.distanceTo(poly[i])),
      total = seg.reduce((a, b) => a + b, 0);
    const pulses = [0, 1, 2].map(() => {
      const m = new THREE.Mesh(sph, mats.pulse);
      m.scale.setScalar(0.06);
      group.add(m);
      return m;
    });
    const at = (t: number) => {
      let d = (t % 1) * total,
        i = 0;
      while (i < seg.length - 1 && d > seg[i]) {
        d -= seg[i];
        i++;
      }
      return poly[i].clone().lerp(poly[i + 1], Math.min(1, d / seg[i]));
    };

    const pointer = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      pointer.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
      pointer.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
    };
    el.addEventListener("pointermove", onMove);
    const render = (t: number) => {
      group.rotation.y = (reduce ? 0.5 : t * 0.00012) + pointer.x * 0.35;
      group.rotation.x = -0.12 + pointer.y * 0.18;
      pulses.forEach((m, i) =>
        m.position.copy(at(reduce ? 0.2 + i * 0.3 : t * 0.00022 + i / 3)),
      );
      renderer.render(scene, camera);
    };
    const resize = () => {
      const w = el.clientWidth,
        h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      render(performance.now());
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    if (!reduce) renderer.setAnimationLoop(render);
    return () => {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      el.removeEventListener("pointermove", onMove);
      [lineGeo, routeGeo, sph].forEach((x) => x.dispose());
      [lineMat, routeMat, ...Object.values(mats)].forEach((x) => x.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [variant]);
  return (
    <div ref={host} aria-hidden="true" className={className}>
      {failed && (
        <div className="flex h-full items-center justify-center text-xs text-muted">
          3D preview unavailable
        </div>
      )}
    </div>
  );
}
