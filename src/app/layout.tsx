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

const platformIcons: Metadata["icons"] = {
  icon: [
    {
      url: "/branding/delunivo-favicon-32.png",
      type: "image/png",
      sizes: "32x32",
    },
    {
      url: "/branding/delunivo-favicon-64.png",
      type: "image/png",
      sizes: "64x64",
    },
  ],
  shortcut: "/branding/delunivo-favicon-32.png",
  apple: [
    {
      url: "/branding/delunivo-apple-touch-icon-180.png",
      type: "image/png",
      sizes: "180x180",
    },
  ],
};

export async function generateMetadata(): Promise<Metadata> {
  const organization = await getCurrentOrganization();

  if (!organization) {
    return {
      metadataBase: new URL("https://www.delunivo.com"),
      applicationName: PLATFORM_NAME,
      title: PLATFORM_NAME,
      description: PLATFORM_DESCRIPTION,
      icons: platformIcons,
      openGraph: {
        type: "website",
        locale: "es_ES",
        siteName: PLATFORM_NAME,
        title: PLATFORM_NAME,
        description: PLATFORM_DESCRIPTION,
        images: [
          {
            url: "/branding/delunivo-social-1200x627.jpg",
            width: 1200,
            height: 627,
            alt: "Delunivo — Tu academia. Tu marca.",
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: PLATFORM_NAME,
        description: PLATFORM_DESCRIPTION,
        images: ["/branding/delunivo-social-1200x627.jpg"],
      },
    };
  }

  return {
    metadataBase: new URL("https://www.delunivo.com"),
    applicationName: PLATFORM_NAME,
    title: `${organization.name} — ${PLATFORM_NAME}`,
    description: `Cursos online de ${organization.name}.`,
    icons: platformIcons,
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
