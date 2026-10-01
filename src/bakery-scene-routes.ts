export type BakeryPlace =
  "knead" | "oven" | "machine" | "counter" | "rest" | "study" | "delivery";
export type Point = [number, number, number];
export const anchors: Record<BakeryPlace, Point> = {
  knead: [-1.5, 0, 0.2],
  oven: [-2.6, 0, -1],
  machine: [0.5, 0, -1.4],
  counter: [-0.8, 0, 1.8],
  rest: [3.7, 0, 0.8],
  study: [3.6, 0, -2.3],
  delivery: [0.5, 0, 3.3],
};
const nodes: Record<string, Point> = {
  ...anchors,
  K: [-1.5, 0, 0.5],
  O: [-2.7, 0, 0.5],
  M: [1.9, 0, -1.4],
  E: [1.9, 0, 0.5],
  R: [2.4, 0, 0.8],
  ST: [2.4, 0, -2.3],
  C: [-0.8, 0, 2.8],
  S: [2.4, 0, 2.8],
};
const edges = [
  ["knead", "K"],
  ["oven", "O"],
  ["O", "K"],
  ["K", "E"],
  ["machine", "M"],
  ["M", "E"],
  ["E", "R"],
  ["R", "ST"],
  ["ST", "study"],
  ["R", "rest"],
  ["R", "S"],
  ["S", "C"],
  ["C", "counter"],
  ["counter", "K"],
  ["C", "delivery"],
];
export function bakeryRoute(from: Point, to: BakeryPlace): Point[] {
  const nearest = Object.keys(nodes).reduce((a, b) =>
    distance(from, nodes[a]) < distance(from, nodes[b]) ? a : b,
  );
  const queue = [[nearest]];
  const visited = new Set([nearest]);
  while (queue.length) {
    const path = queue.shift()!;
    const tail = path[path.length - 1];
    if (tail === to)
      return [nodes[nearest], ...path.slice(1).map((n) => nodes[n])];
    for (const [a, b] of edges) {
      const next = a === tail ? b : b === tail ? a : null;
      if (next && !visited.has(next)) {
        visited.add(next);
        queue.push([...path, next]);
      }
    }
  }
  throw new Error("Scene route unavailable");
}
function distance(a: Point, b: Point) {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}
