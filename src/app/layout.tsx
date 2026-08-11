import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getCurrentOrganization } from "@/lib/organizations/getCurrentOrganization";
import { readableTextColor } from "@/lib/organizations/brandColor";
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

  if (!organization) {
    return {
      title: "Aularia — crea y vende tus cursos online",
      description:
        "Monta tu escuela online con tu propia marca, sube tus cursos y cobra a tus alumnos. 20€/mes.",
    };
  }

  return {
    title: organization.name,
    description: `Cursos online de ${organization.name}.`,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const organization = await getCurrentOrganization();
  const brandColor = organization?.primaryColor ?? null;
  const brandTextColor = readableTextColor(brandColor);

  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      style={
        brandColor
          ? ({
              "--accent": brandColor,
              // Calculado a partir del propio color: una empresa con marca clara
              // necesita texto oscuro encima, no el blanco por defecto.
              ...(brandTextColor
                ? { "--accent-foreground": brandTextColor }
                : {}),
            } as React.CSSProperties)
          : undefined
      }
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
