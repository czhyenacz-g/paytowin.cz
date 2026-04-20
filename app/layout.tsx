import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";
import { GOATCOUNTER_CODE } from "./config/analytics";

export const metadata: Metadata = {
  title: "PayToWin.cz — Závody, sázky a finanční chaos",
  description: "Multiplayerová desková hra v prohlížeči. Závoď, sázej a přežij finanční chaos.",
  openGraph: {
    title: "PayToWin.cz — Závody, sázky a finanční chaos",
    description: "Multiplayerová desková hra v prohlížeči. Závoď, sázej a přežij finanční chaos.",
    url: "https://paytowin.cz",
    siteName: "PayToWin.cz",
    locale: "cs_CZ",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PayToWin.cz — Závody, sázky a finanční chaos",
    description: "Multiplayerová desková hra v prohlížeči. Závoď, sázej a přežij finanční chaos.",
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
