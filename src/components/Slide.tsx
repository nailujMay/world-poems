import Image from "next/image";
import type { CSSProperties } from "react";
import Reveal from "@/components/Reveal";
import type { Drift, Slide as SlideData } from "@/lib/content";

const TEXT = "max-w-prose space-y-5 text-[13px] leading-[1.7] sm:text-sm";

/** max-w-6xl (1152px) less sm:px-10 either side. */
const CONTAINER = 1072;
/** A col-span-8 cell of the 12-column grid, as a fraction of the container. */
const WIDE_COLUMN = 2 / 3;

/**
 * Next picks which resized file to download from `sizes`, so it has to match
 * how wide the photo actually paints — understate it and the browser upscales
 * a too-small file. The drift already knows each photo's width, so derive it
 * from there rather than quoting one figure for every layout.
 */
function photoSizes({ layout, drift }: SlideData): string {
  // Full-bleed: no container, no padding, edge to edge.
  if (layout === "full") return "100vw";
  const sideBySide = layout === "left" || layout === "right";
  const fraction = (drift.photoW / 100) * (sideBySide ? WIDE_COLUMN : 1);
  return [
    `(max-width: 768px) ${drift.smPhotoW}vw`,
    `(max-width: 1152px) ${Math.round(fraction * 100)}vw`,
    `${Math.round(fraction * CONTAINER)}px`,
  ].join(", ");
}

// Drift is handed down as custom properties so the same markup can apply it at
// one strength on phones and another from md up.
const TEXT_DRIFT = "md:ml-[var(--text-x)] md:w-[var(--text-w)]";
const PHOTO_DRIFT =
  "ml-[var(--photo-x-sm)] w-[var(--photo-w-sm)] md:mt-[var(--photo-y)] md:ml-[var(--photo-x)] md:w-[var(--photo-w)]";

function driftVars(drift: Drift): CSSProperties {
  return {
    "--text-x": `${drift.textX}%`,
    "--text-w": `${drift.textW}%`,
    "--photo-x": `${drift.photoX}%`,
    "--photo-w": `${drift.photoW}%`,
    "--photo-y": `${drift.photoY}rem`,
    "--photo-x-sm": `${drift.smPhotoX}%`,
    "--photo-w-sm": `${drift.smPhotoW}%`,
  } as CSSProperties;
}

function Text({ lines }: { lines: string[] }) {
  if (!lines.length) return null;
  return (
    <div className={TEXT}>
      {lines.map((line, i) => (
        <p key={i} className="whitespace-pre-line">
          {line}
        </p>
      ))}
    </div>
  );
}

function Photo({ photo, sizes }: { photo: SlideData["photo"]; sizes: string }) {
  return (
    <Image
      src={photo.src}
      alt={photo.alt}
      width={photo.width}
      height={photo.height}
      sizes={sizes}
      className="h-auto w-full"
    />
  );
}

export default function Slide({ slide }: { slide: SlideData }) {
  const text = <Text lines={slide.lines} />;
  const photo = <Photo photo={slide.photo} sizes={photoSizes(slide)} />;
  const style = driftVars(slide.drift);

  // Each layout mirrors one of the slide compositions from the design file;
  // the drift then pulls the text and the photo off each other's edges. Every
  // layout leads with its text and follows with the photo.
  if (slide.layout === "full") {
    return (
      <section style={style} className="px-0 py-16 sm:py-24">
        {slide.lines.length > 0 && (
          <Reveal
            className={`mx-auto mb-8 max-w-6xl px-6 sm:px-10 ${TEXT_DRIFT}`}
          >
            {text}
          </Reveal>
        )}
        <Reveal delay={0.15}>{photo}</Reveal>
      </section>
    );
  }

  if (slide.layout === "left" || slide.layout === "right") {
    const textFirst = slide.layout === "left";
    return (
      <section
        style={style}
        className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:px-10 sm:py-24 md:grid-cols-12 md:gap-12"
      >
        <Reveal
          // The 4/8 split here is the other half of the text-width knob;
          // `textW` in content.ts then fills a share of this cell.
          className={`md:col-span-4 md:self-start ${TEXT_DRIFT} ${
            textFirst ? "md:order-1" : "md:order-2 md:col-start-9"
          }`}
        >
          {text}
        </Reveal>
        <Reveal
          delay={0.15}
          className={`md:col-span-8 ${PHOTO_DRIFT} ${
            textFirst ? "md:order-2" : "md:order-1 md:row-start-1"
          }`}
        >
          {photo}
        </Reveal>
      </section>
    );
  }

  if (slide.layout === "top") {
    return (
      <section
        style={style}
        className="mx-auto max-w-6xl px-6 py-16 sm:px-10 sm:py-24"
      >
        <Reveal className={`mb-12 sm:mb-16 ${TEXT_DRIFT}`}>{text}</Reveal>
        <Reveal delay={0.15} className={PHOTO_DRIFT}>
          {photo}
        </Reveal>
      </section>
    );
  }

  // "wide": a short line of text floating out past the middle, with the photo
  // sitting low and left underneath it.
  return (
    <section
      style={style}
      className="mx-auto max-w-6xl px-6 py-16 sm:px-10 sm:py-24"
    >
      <Reveal className={`mb-8 ${TEXT_DRIFT}`}>{text}</Reveal>
      <Reveal delay={0.15} className={PHOTO_DRIFT}>
        {photo}
      </Reveal>
    </section>
  );
}
