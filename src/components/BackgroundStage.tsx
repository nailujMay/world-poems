"use client";

import { useEffect, useState, type ReactNode } from "react";

export type EntryTheme = { id: string; background: string; foreground: string };

type Props = { themes: EntryTheme[]; children: ReactNode };

/**
 * Paints the page background from whichever entry currently owns the middle of
 * the viewport, and cross-fades between entries as you scroll.
 */
export default function BackgroundStage({ themes, children }: Props) {
  const [active, setActive] = useState(themes[0]);

  useEffect(() => {
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>("[data-entry-id]"),
    );
    if (!sections.length) return;

    const byId = new Map(themes.map((theme) => [theme.id, theme]));

    const pick = () => {
      const middle = window.innerHeight / 2;
      // The last section whose top has crossed the middle of the screen wins.
      let current = themes[0];
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= middle) {
          current = byId.get(section.dataset.entryId ?? "") ?? current;
        }
      }
      setActive(current);
      // Also paint the root element so overscroll bounce matches the entry.
      document.documentElement.style.backgroundColor = current.background;
    };

    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        pick();
      });
    };

    pick();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [themes]);

  return (
    <div
      style={{ backgroundColor: active.background, color: active.foreground }}
      className="min-h-screen transition-colors duration-[900ms] ease-linear"
    >
      {children}
    </div>
  );
}
