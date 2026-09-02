import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getCurrentOrganization } from "@/lib/organizations/getCurrentOrganization";
import { readableTextColor } from "@/lib/organizations/brandColor";
import { PLATFORM_DESCRIPTION, PLATFORM_NAME } from "@/lib/brand";
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
      metadataBase: new URL("https://www.delunivo.com"),
      applicationName: PLATFORM_NAME,
      title: PLATFORM_NAME,
      description: PLATFORM_DESCRIPTION,
      openGraph: {
        type: "website",
        locale: "es_ES",
        siteName: PLATFORM_NAME,
        title: PLATFORM_NAME,
        description: PLATFORM_DESCRIPTION,
      },
      twitter: {
        card: "summary",
        title: PLATFORM_NAME,
        description: PLATFORM_DESCRIPTION,
      },
    };
  }

  return {
    metadataBase: new URL("https://www.delunivo.com"),
    applicationName: PLATFORM_NAME,
    title: `${organization.name} — ${PLATFORM_NAME}`,
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
      <body className="flex min-h-full flex-col">
        <a
          href="#contenido-principal"
          className="sr-only z-[100] rounded-md bg-background px-4 py-3 font-medium focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
        >
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
