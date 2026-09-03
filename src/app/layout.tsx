import type { Metadata } from "next";
import { B612_Mono } from "next/font/google";
import "./globals.css";
import { getStory } from "@/lib/content";

const b612Mono = B612_Mono({
  variable: "--font-b612-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export function generateMetadata(): Metadata {
  const { meta } = getStory();
  return { title: meta.title, description: meta.description };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${b612Mono.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
