import BackgroundStage from "@/components/BackgroundStage";
import Reveal from "@/components/Reveal";
import Slide from "@/components/Slide";
import { getStory } from "@/lib/content";

const PROSE = "max-w-prose space-y-5 text-[13px] leading-[1.7] sm:text-sm";

export default function Home() {
  const { meta, entries } = getStory();
  const themes = entries.map(({ id, background, foreground }) => ({
    id,
    background,
    foreground,
  }));

  return (
    <BackgroundStage themes={themes}>
      {/* The page opens on the first date, so the top margin lives here rather
          than on a separate intro block. */}
      <main className="pt-[20vh]">
        {entries.map((entry) => (
          <section key={entry.id} data-entry-id={entry.id}>
            {entry.date && (
              <Reveal className="mx-auto max-w-6xl px-6 pt-10 sm:px-10">
                <p className="text-[11px] tracking-[0.35em] uppercase opacity-50">
                  {entry.date}
                </p>
              </Reveal>
            )}
            {entry.slides.map((slide) => (
              <Slide key={slide.key} slide={slide} />
            ))}
          </section>
        ))}

        <footer className="mx-auto max-w-6xl px-6 pt-[10vh] pb-[22vh] sm:px-10">
          <Reveal>
            <div className={PROSE}>
              {meta.outro?.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </Reveal>
        </footer>
      </main>
    </BackgroundStage>
  );
}
