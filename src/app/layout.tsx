import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Space+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
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
