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
      { url: "/icon.png", type: "image/png" },
      { url: "/favicon.png", type: "image/png" },
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
  try {
    var hex=localStorage.getItem('prime-brand-primary')||'#14B8A6';
    if(!/^#[0-9A-Fa-f]{6}$/.test(hex)) hex='#14B8A6';
    var svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="18" ry="18" fill="'+hex+'"/><g transform="translate(4, 4) scale(3.83)" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21 8-2 2-1.5-3.7A2 2 0 0 0 15.646 5H8.4a2 2 0 0 0-1.903 1.257L5 10 3 8"/><path d="M7 14h.01"/><path d="M17 14h.01"/><rect width="18" height="8" x="3" y="10" rx="2"/><path d="M5 18v2"/><path d="M19 18v2"/></g></svg>';
    var href='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(svg)));
    var link=document.createElement('link');
    link.rel='icon';
    link.type='image/svg+xml';
    link.setAttribute('data-brand-favicon','true');
    link.href=href;
    document.head.appendChild(link);
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
