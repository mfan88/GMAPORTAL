import { Geist_Mono, Instrument_Sans, Montserrat } from "next/font/google";
import type { Viewport } from "next";

import "@/app/globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { FileProvider } from "./fileprovider";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

const montserratHeading = Montserrat({
  subsets: ["latin"],
  variable: "--font-heading",
});

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        instrumentSans.variable,
        montserratHeading.variable
      )}
    >
      <head>
        <title>GMA Upload Portal</title>
      </head>
      <body>
        <FileProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </FileProvider>
      </body>
    </html>
  );
}
