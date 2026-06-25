import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wahala Portal",
  description: "Wahala Group — client services CRM & portal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
