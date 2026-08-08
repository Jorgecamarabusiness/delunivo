import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getCurrentOrganization } from "@/lib/organizations/getCurrentOrganization";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const organization = await getCurrentOrganization();
  const name = organization?.name ?? "Aularia";
  return {
    title: name,
    description: `Crea y vende cursos en línea con ${name}.`,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const organization = await getCurrentOrganization();

  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      style={
        organization?.primaryColor
          ? ({ "--accent": organization.primaryColor } as React.CSSProperties)
          : undefined
      }
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
