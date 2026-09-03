import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { imageSize } from "image-size";

export type Layout = "left" | "right" | "top" | "wide" | "full";

type RawSlide = {
  layout?: Layout;
  lines?: string[];
  /** Optional: pin this text block to a specific filename instead of by order. */
  image?: string;
  /** Optional: override any of the generated drift values for this slide. */
  drift?: Partial<Drift>;
};

type RawEntry = {
  /** Doubles as the image folder name unless `folder` overrides it. */
  id: string;
  /** Shown above the entry, verbatim — whatever date format you write here. */
  date?: string;
  folder?: string;
  background: string;
  foreground: string;
  slides?: RawSlide[];
};

type RawStory = {
  meta: {
    title: string;
    description: string;
    outro?: string[];
  };
  entries: RawEntry[];
};

export type Photo = { src: string; width: number; height: number; alt: string };

/**
 * How far a slide's text and photo pull away from the grid, so that nothing
 * lines up with anything else. Widths and offsets are percentages of the
 * element's own column; `photoY` is rem, and drops the photo below the text
 * sitting beside or above it.
 */
export type Drift = {
  textX: number;
  textW: number;
  photoX: number;
  photoW: number;
  photoY: number;
  /** Gentler offsets for narrow screens, where a big shift only cramps. */
  smPhotoX: number;
  smPhotoW: number;
};

export type Slide = {
  key: string;
  layout: Layout;
  lines: string[];
  photo: Photo;
  drift: Drift;
};

export type Entry = {
  id: string;
  date: string;
  background: string;
  foreground: string;
  slides: Slide[];
};

export type Story = {
  meta: RawStory["meta"];
  entries: Entry[];
};

const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|avif|gif)$/i;
const IMAGES_ROOT = join(process.cwd(), "public", "images");

/** Sorts so `2.jpg` lands before `10.jpg`, matching how people number photos. */
const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

function readPhotos(folder: string): Photo[] {
  const dir = join(IMAGES_ROOT, folder);

  let files: string[];
  try {
    files = readdirSync(dir);
  } catch {
    return [];
  }

  return files
    .filter((name) => IMAGE_EXTENSIONS.test(name) && !name.startsWith("."))
    .sort(collator.compare)
    .map((name) => {
      const { width, height } = imageSize(readFileSync(join(dir, name)));
      return {
        src: `/images/${folder}/${name}`,
        width: width ?? 1600,
        height: height ?? 1200,
        alt: name.replace(IMAGE_EXTENSIONS, "").replace(/[-_]+/g, " "),
      };
    });
}

const DEFAULT_LAYOUTS: Layout[] = ["left", "right", "top", "wide"];

type Range = [min: number, max: number];

// Per layout, how far each piece is allowed to wander. `textW` is the knob for
// how wide a text block runs: a percentage of its own column, which is the
// whole container for the stacked layouts and the grid cell for left/right. Side-by-side layouts
// keep their columns and just pull in off the edges; stacked layouts push the
// text out past the middle and let the photo hang low and left.
const DRIFT_RANGES: Record<Layout, Record<keyof Drift, Range>> = {
  left:  { textX: [0, 8],  textW: [84, 94], photoX: [0, 10], photoW: [88, 100], photoY: [0, 5], smPhotoX: [0, 6], smPhotoW: [92, 100] },
  right: { textX: [0, 10], textW: [82, 94], photoX: [0, 8],  photoW: [90, 100], photoY: [1, 6], smPhotoX: [0, 6], smPhotoW: [92, 100] },
  top:   { textX: [34, 48], textW: [38, 46], photoX: [0, 10], photoW: [58, 74], photoY: [0, 4], smPhotoX: [0, 8], smPhotoW: [92, 100] },
  wide:  { textX: [30, 46], textW: [38, 48], photoX: [2, 12], photoW: [60, 76], photoY: [0, 3], smPhotoX: [0, 8], smPhotoW: [92, 100] },
  // The photo runs edge to edge, so only the caption underneath drifts.
  full:  { textX: [18, 44], textW: [38, 46], photoX: [0, 0], photoW: [100, 100], photoY: [0, 0], smPhotoX: [0, 0], smPhotoW: [100, 100] },
};

/** FNV-1a, so a slide's offsets are stable across builds but look arbitrary. */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h = Math.imul(h ^ value.charCodeAt(i), 0x01000193);
  }
  return h >>> 0;
}

function pick(key: string, salt: string, [min, max]: Range, step = 1): number {
  const t = (hash(`${key}:${salt}`) % 1024) / 1023;
  return Math.round((min + (max - min) * t) / step) * step;
}

function driftFor(
  key: string,
  layout: Layout,
  override?: Partial<Drift>,
): Drift {
  const range = DRIFT_RANGES[layout];
  const textW = pick(key, "textW", range.textW);
  const photoW = pick(key, "photoW", range.photoW);
  const smPhotoW = pick(key, "smPhotoW", range.smPhotoW);
  return {
    textW,
    photoW,
    smPhotoW,
    // Clamp each offset against its own width so a block can never be pushed
    // out past the right edge of its column.
    textX: Math.min(pick(key, "textX", range.textX), 100 - textW),
    photoX: Math.min(pick(key, "photoX", range.photoX), 100 - photoW),
    smPhotoX: Math.min(pick(key, "smPhotoX", range.smPhotoX), 100 - smPhotoW),
    photoY: pick(key, "photoY", range.photoY, 0.5),
    ...override,
  };
}

function buildEntry(entry: RawEntry): Entry {
  const folder = entry.folder ?? entry.id;

  // Every photo in the folder, reachable by filename or by filename without
  // the extension, so re-exporting one in another format keeps it found.
  const byName = new Map<string, Photo>();
  for (const photo of readPhotos(folder)) {
    const name = photo.src.split("/").pop()!;
    byName.set(name.replace(IMAGE_EXTENSIONS, ""), photo);
    byName.set(name, photo);
  }

  // A slide shows the photo it names, in the order written. A name that is not
  // in the folder shows nothing at all.
  const slides: Slide[] = (entry.slides ?? []).flatMap((slide, index) => {
    const photo = slide.image ? byName.get(slide.image) : undefined;
    if (!photo) {
      if (slide.image) {
        console.warn(
          `content/story.json: entry "${entry.id}" names "${slide.image}", ` +
            `which is not in public/images/${folder}. Nothing is shown for it.`,
        );
      }
      return [];
    }
    const layout =
      slide.layout ?? DEFAULT_LAYOUTS[index % DEFAULT_LAYOUTS.length];
    return [
      {
        // Keyed by position, since a photo may be named by more than one slide.
        key: `${entry.id}-${index}`,
        layout,
        lines: slide.lines ?? [],
        photo,
        // Seeded from the photo so its composition stays put as slides move.
        drift: driftFor(photo.src, layout, slide.drift),
      },
    ];
  });

  return {
    id: entry.id,
    date: entry.date ?? "",
    background: entry.background,
    foreground: entry.foreground,
    slides,
  };
}

export function getStory(): Story {
  const raw: RawStory = JSON.parse(
    readFileSync(join(process.cwd(), "content", "story.json"), "utf8"),
  );
  return { meta: raw.meta, entries: raw.entries.map(buildEntry) };
}
