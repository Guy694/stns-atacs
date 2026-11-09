import { withBasePath } from "@/lib/base-path";

/**
 * Faint office photograph behind a hero, summary card, login or empty state.
 * Never put it behind tables or forms — data must stay on a clean surface.
 *
 * The parent needs `relative isolate overflow-hidden`; content sits above automatically
 * because the backdrop is `-z-10` inside the parent's own stacking context.
 */
export type BackdropImage = "it-storage" | "office-desk" | "meeting-room";

const POSITION: Record<BackdropImage, string> = {
  "it-storage": "object-[30%_45%]",
  "office-desk": "object-[60%_40%]",
  "meeting-room": "object-[50%_45%]",
};

export function PhotoBackdrop({
  image = "it-storage",
  opacity = "opacity-[0.10]",
  fade = "right",
}: {
  image?: BackdropImage;
  /** Tailwind opacity class; keep ≤ 0.14 so body text keeps 4.5:1 contrast. */
  opacity?: string;
  /** Which side fades to the surface colour, so text there stays on a clean background. */
  fade?: "right" | "left" | "bottom" | "none";
}) {
  const mask =
    fade === "right"
      ? "[mask-image:linear-gradient(90deg,#000_0%,#000_35%,transparent_95%)]"
      : fade === "left"
        ? "[mask-image:linear-gradient(270deg,#000_0%,#000_35%,transparent_95%)]"
        : fade === "bottom"
          ? "[mask-image:linear-gradient(180deg,#000_0%,#000_40%,transparent_100%)]"
          : "";
  return (
    // eslint-disable-next-line @next/next/no-img-element -- decorative, basePath-aware static asset
    <img
      src={withBasePath(`/backdrops/${image}.webp`)}
      alt=""
      aria-hidden="true"
      decoding="async"
      loading="lazy"
      draggable={false}
      className={`pointer-events-none absolute inset-0 -z-10 h-full w-full select-none object-cover saturate-[0.85] ${POSITION[image]} ${opacity} ${mask}`}
    />
  );
}
