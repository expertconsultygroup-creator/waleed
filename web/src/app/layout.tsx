import type { Metadata, Viewport } from "next";
import { Amiri_Quran, Noto_Kufi_Arabic, Readex_Pro } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

/* Fonts are downloaded at build time and served from this site: the page asks
   nothing of a third party at runtime. */
const readex = Readex_Pro({ subsets: ["arabic", "latin"], variable: "--font-readex", display: "swap" });
const kufi = Noto_Kufi_Arabic({ subsets: ["arabic", "latin"], weight: ["500", "600", "700"], variable: "--font-kufi", display: "swap" });
const amiri = Amiri_Quran({ subsets: ["arabic", "latin"], weight: "400", variable: "--font-amiri", display: "swap" });

export const metadata: Metadata = {
  title: "إسناد — Isnad",
  description:
    "حاور نموذجًا تُطابَق اقتباساته من القرآن والحديث مع مصادر معتمدة قبل أن تراها. Chat with a model whose Qur’an and hadith quotations are checked against pinned sources before you see them.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0a3b2c" },
    { media: "(prefers-color-scheme: dark)", color: "#071f17" },
  ],
};

/* Language, direction and theme are applied before the first paint, from
   what the reader chose last time (the same keys as the classic interface),
   so an English reader never sees the Arabic layout flash first. */
const PREPAINT = `(function(){try{var d=document.documentElement;
var l=JSON.parse(localStorage.getItem('isnad.gui.lang.v1')||'null');l=l==='en'?'en':'ar';
d.lang=l;d.dir=l==='ar'?'rtl':'ltr';
var t=JSON.parse(localStorage.getItem('isnad.gui.theme.v1')||'null');
if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}
d.classList.toggle('dark',t==='dark');d.style.colorScheme=t;}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" className={`${readex.variable} ${kufi.variable} ${amiri.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREPAINT }} />
      </head>
      <body className="h-dvh overflow-clip">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
