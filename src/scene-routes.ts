import layout from "./town-layout.json";
export type Point = [number, number, number];
const nodes = layout.navigation.nodes as Record<string, number[]>;
const distance = (a: number[], b: number[]) =>
  Math.hypot(a[0] - b[0], a[2] - b[2]);
export function routeBetween(from: Point, to: Point): Point[] {
  if (distance(from, to) < 0.3) return [from, to];
  const nearest = (p: Point) =>
    Object.keys(nodes).sort(
      (a, b) => distance(nodes[a], p) - distance(nodes[b], p),
    )[0];
  const first = nearest(from),
    last = nearest(to),
    queue = [first],
    parents: Record<string, string | null> = { [first]: null };
  while (queue.length) {
    const n = queue.shift()!;
    if (n === last) break;
    for (const [a, b] of layout.navigation.edges) {
      const next = a === n ? b : b === n ? a : null;
      if (next && !Object.hasOwn(parents, next)) {
        parents[next] = n;
        queue.push(next);
      }
    }
  }
  const middle: string[] = [];
  let node: string | null = last;
  while (node !== null && Object.hasOwn(parents, node)) {
    middle.unshift(node);
    node = parents[node];
  }
  return [from, ...middle.map((n) => nodes[n] as Point), to];
}
export function pointOnRoute(route: Point[], progress: number): Point {
  const lengths = route.slice(1).map((p, i) => distance(route[i], p));
  const total = lengths.reduce((a, b) => a + b, 0);
  let left = Math.max(0, Math.min(1, progress)) * total;
  for (let i = 0; i < lengths.length; i++) {
    if (left <= lengths[i] || i === lengths.length - 1) {
      const t = lengths[i] ? left / lengths[i] : 1;
      return route[i].map((v, j) => v + (route[i + 1][j] - v) * t) as Point;
    }
    left -= lengths[i];
  }
  return route[0];
}
export function residentHome(index: number): Point {
  const a = layout.homeAnchors[Math.floor(index / 2)];
  return [
    a.position[0] + (index % 2 ? 0.24 : -0.24),
    0.06,
    a.position[2] + (index % 2 ? 0.25 : -0.25),
  ];
}
export function buildingForHouse(id: string) {
  const i = Number(id.slice(1)) - 1;
  return layout.homeAnchors[i]?.building || id;
}
export function firstHouseForBuilding(id: string) {
  return (
    "h" + (layout.homeAnchors.find((a) => a.building === id)?.household || 1)
  );
}
