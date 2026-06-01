import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";
import { GOATCOUNTER_CODE } from "./config/analytics";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://paytowin.cz"),
  title: "PayToWin.cz – česká multiplayer závodní deskovka",
  description: "Multiplayerová desková hra v prohlížeči. Kupuj závodníky, riskuj v závodech a přežij finanční chaos. Hraj online s přáteli.",
  openGraph: {
    title: "PayToWin.cz – česká multiplayer závodní deskovka",
    description: "Multiplayerová desková hra v prohlížeči. Kupuj závodníky, riskuj v závodech a přežij finanční chaos.",
    url: "https://paytowin.cz",
    siteName: "PayToWin.cz",
    locale: "cs_CZ",
    type: "website",
    images: [{ url: "/api/og?title=PayToWin.cz&sub=Multiplayer+závodní+deskovka", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "PayToWin.cz – česká multiplayer závodní deskovka",
    description: "Multiplayerová desková hra v prohlížeči. Kupuj závodníky, riskuj v závodech a přežij finanční chaos.",
    images: ["/api/og?title=PayToWin.cz&sub=Multiplayer+závodní+deskovka"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="cs">
      <body className="bg-gray-900 text-white antialiased">
        {children}
        <Analytics />
        {GOATCOUNTER_CODE && (
          <Script
            data-goatcounter={`https://${GOATCOUNTER_CODE}.goatcounter.com/count`}
            src="//gc.zgo.at/count.js"
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}
