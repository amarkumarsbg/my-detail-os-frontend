import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { BrandThemeApplier } from "@/components/shared/brand-theme-applier";
import { AttendanceRealtimeSync } from "@/components/attendance/attendance-realtime-sync";
import { VisualViewportCssVars } from "@/components/shared/visual-viewport-css-vars";
import { TenantProvider } from "@/components/tenant/tenant-context";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MY DETAIL OS - Car Service Management",
  description: "Admin CRM portal for car service business management",
  icons: {
    icon: [
      { url: "/my-detail-os-mark.png", type: "image/png" },
      { url: "/favicon.png", type: "image/png" },
      { url: "/icon.png", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png" }],
  },
};

/**
 * resizes-visual: only the visual viewport shrinks when the keyboard opens.
 * The layout viewport stays constant → no page-wide reflow → no jump.
 * Fixed-position sheets stay in place; their scroll container handles
 * keyboard overlap via --vv-keyboard-inset padding.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-visual",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/my-detail-os-mark.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function(){
  try {
    var k='theme';
    var t=localStorage.getItem(k);
    var d=document.documentElement;
    if(t==='dark') d.classList.add('dark');
    else if(t==='light') d.classList.remove('dark');
    else if(!t||t==='system'){
      if(window.matchMedia('(prefers-color-scheme: dark)').matches) d.classList.add('dark');
      else d.classList.remove('dark');
    }
  }catch(e){}
})();`,
          }}
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider>
          <TenantProvider>
            <BrandThemeApplier />
            <VisualViewportCssVars />
            <AttendanceRealtimeSync />
            {children}
            <Toaster position="top-right" richColors closeButton />
          </TenantProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
