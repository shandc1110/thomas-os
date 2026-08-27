import type { Metadata } from "next";
import { Montserrat, Playfair_Display } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/context/CartContext";
import { cbcV4Assets, cbcV4Brand } from "@/lib/brand/chosen-by-chloe";
import { getActiveTenant } from "@/lib/thomas/tenant/resolve";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const tenant = getActiveTenant();

function siteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.VERCEL_URL?.trim()) return `https://${process.env.VERCEL_URL.trim()}`;
  return "http://localhost:3000";
}

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: {
    default: cbcV4Brand.displayName,
    template: `%s | ${cbcV4Brand.displayName}`,
  },
  description: tenant.storefront.description,
  icons: {
    icon: [{ url: cbcV4Assets.favicon, type: "image/png" }],
    apple: [{ url: cbcV4Assets.avatarIvory }],
  },
  openGraph: {
    title: cbcV4Brand.displayName,
    description: tenant.storefront.description,
    images: [{ url: cbcV4Assets.logoPrimaryHorizontal, alt: cbcV4Brand.logoAlt }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${montserrat.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-ivory text-charcoal">
        <div className="w-full border-b border-sand/70 bg-charcoal px-4 py-2 text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-ivory">
            {tenant.storefront.bannerText}
          </p>
        </div>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
