import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Next.js bufferiza en memoria el body de cualquier request que pase por
    // proxy.ts, con un límite por defecto de 10MB (lo trunca en silencio, sin
    // error). Subir vídeos a /api/admin/media/upload (hasta 500MB permitidos
    // en esa ruta) necesita un límite explícito mayor.
    proxyClientMaxBodySize: "512mb",
  },
};

export default nextConfig;
