import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NICARA Project OS — Interior Design Management",
  description:
    "Professional interior design project management platform. Manage estimates, procurement, vendors, and client workflows — built for interior design firms.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
