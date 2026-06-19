import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { cn } from "@/lib/utils";

// Inter para todo (BRAND.md): el caracter tecnico se logra con peso y tracking,
// no con otra fuente. Fallback system-ui.
const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "Atlas",
  description: "Plataforma clinica de Connected Nutrition Ventures.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={cn("h-full antialiased font-sans", inter.variable)}>
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster closeButton richColors position="top-right" />
      </body>
    </html>
  );
}
