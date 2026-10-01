import { anchors, type BakeryPlace } from "./bakery-scene-routes";
export function actorFacing(place: BakeryPlace, active: boolean) {
  return active && ["knead", "oven", "machine", "study"].includes(place)
    ? Math.PI
    : 0;
}
export function cameraFrame(
  focus: "ahe" | "xiaoman" | "wide" | "auto",
  beat: { ahe: BakeryPlace; xiaoman: BakeryPlace; active: boolean },
) {
  if (focus === "ahe" || focus === "xiaoman")
    return {
      target: [anchors[beat[focus]][0], 0.9, anchors[beat[focus]][2]] as const,
      horizontalSpan: 6.2,
      verticalSpan: 7.5,
    };
  if (focus === "wide" || !beat.active)
    return {
      target: [0, 0.65, 0.1] as const,
      horizontalSpan: 16.5,
      verticalSpan: 11.5,
    };
  const a = anchors[beat.ahe],
    b = anchors[beat.xiaoman];
  const span = Math.max(6.5, Math.hypot(a[0] - b[0], a[2] - b[2]) + 4.5);
  return {
    target: [(a[0] + b[0]) / 2, 0.8, (a[2] + b[2]) / 2] as const,
    horizontalSpan: span,
    verticalSpan: Math.max(7.5, span * 0.8),
  };
}
