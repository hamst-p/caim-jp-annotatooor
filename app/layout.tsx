import type { Metadata } from "next";
import { BIZ_UDGothic } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

const bizUdGothic = BIZ_UDGothic({
  variable: "--font-biz-ud-gothic",
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
  fallback: ["Yu Gothic", "YuGothic", "Meiryo"],
});

export const metadata: Metadata = {
  title: "Translation Audio Manager",
  description:
    "Manage English source text, Japanese translations, romaji readings, and MP3 narration for each sentence or phrase.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${bizUdGothic.variable} h-full`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
          <Toaster position="bottom-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
