import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"]
});

const ibmPlexMono = IBM_Plex_Mono({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"]
});

export const metadata: Metadata = {
  title: "fiscus",
  description: "Manual cashflow planning",
  icons: {
    icon: [
      { url: "/brand/favicon.svg", type: "image/svg+xml" },
      { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" }
    ],
    apple: [{ url: "/brand/app-icon-512.png", sizes: "512x512" }]
  }
};

const showLocalPreviewNotice = process.env.NODE_ENV !== "production";

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className={`${spaceGrotesk.variable} ${ibmPlexMono.variable}`} lang="en">
      <body>
        {children}
        <footer className="site-footer">
          <p>© 2026 fiscus by altera est.</p>
          {showLocalPreviewNotice ? <p>Local development preview.</p> : null}
          <p>Manual planning estimates only; verify balances before making financial decisions.</p>
        </footer>
      </body>
    </html>
  );
}
