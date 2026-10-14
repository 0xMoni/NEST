import type { Metadata } from "next";
import { DM_Sans, Newsreader } from "next/font/google";
import "./globals.css";

// Both are variable fonts, so no weight list: next/font ships the whole axis
// in one file. Enumerating weights makes Turbopack emit one @font-face query
// per weight, which it then refuses to resolve.
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "NEST",
  description: "Nurturing Education & Student Tracking",
};

// Runs before first paint, so a pinned theme never flashes the other one.
// Inline and blocking on purpose — the alternative is a visible flicker.
const themeScript = `
try {
  var t = localStorage.getItem("nest-theme");
  if (t === "dark" || t === "light") document.documentElement.setAttribute("data-theme", t);
} catch (e) {}
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${newsreader.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
