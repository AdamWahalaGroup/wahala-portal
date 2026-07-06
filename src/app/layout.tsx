import type { Metadata } from "next";
import { Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { isDemoMode } from "@/auth/demo";
import "./globals.css";

const sans = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Wahala Portal",
  description: "Wahala Group — client services CRM & portal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Demo deployment: keep it out of search indexes and label every page. The
  // check is false at build time (static pages) and on production requests.
  const demo = isDemoMode();
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      {demo && (
        <head>
          <meta name="robots" content="noindex, nofollow" />
        </head>
      )}
      <body>
        {demo && (
          <div
            className="mono"
            style={{
              position: "sticky",
              top: 0,
              zIndex: 200,
              background: "#2B3EE6",
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: ".08em",
              textTransform: "uppercase",
              textAlign: "center",
              padding: "5px 12px",
            }}
          >
            Design-review demo · read-only · fixture data only
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
