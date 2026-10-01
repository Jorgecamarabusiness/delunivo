import type { EmailContent } from "@/lib/email/layout";

export function capacityNoticeContent(resource: string, threshold: string, payload: Record<string, unknown>): EmailContent {
  const retention = resource === "retention";
  return {
    heading: retention ? "Conservación de tu contenido" : resource === "library_excess" ? "Tu biblioteca supera la capacidad" : `Aviso de ${resource === "library" ? "biblioteca" : "reproducción"}: ${threshold}%`,
    paragraphs: retention ? [
      "El acceso de tu escuela ha finalizado. Conservamos el contenido durante 30 días desde su finalización efectiva.",
      `Fecha prevista de eliminación: ${String(payload.deleteAfter ?? "pendiente")}. Antes puedes restaurar el acceso o exportar el contenido disponible desde Facturación.`,
      "La exportación identifica los originales disponibles y las limitaciones de cada proveedor. Las compras y la documentación de cobros tienen conservación independiente.",
    ] : resource === "library_excess" ? [
      "Tu biblioteca supera el techo contratado. Las nuevas subidas que excedan la capacidad están bloqueadas.",
      "Dispones de siete días desde el inicio del exceso para ampliar o reducir contenido. Después se pausarán nuevas sesiones de vídeo si continúa el exceso. No eliminamos vídeos por este motivo.",
    ] : [
      `Tu escuela ha alcanzado el umbral del ${threshold}% de ${resource === "library" ? "biblioteca" : "reproducción incluida"}.`,
      "Consulta el consumo, las bolsas, sus vencimientos y la última actualización en Facturación. Puedes ampliar capacidad de forma explícita; no cobramos excesos automáticamente.",
      "Los datos confirmados de Mux llegan con retraso. La estimación reciente se muestra aparte y no es la fuente de facturación.",
    ],
  };
}
