---
name: delunivo-ui-system
description: Implementa o revisa interfaces, componentes, estilos y responsive de Delunivo. Usar para cambios visibles en TSX o CSS; no usar para tareas solo de datos o integraciones sin UI.
---

# UI de Delunivo

Construye la interfaz mas pequena que resuelva el caso actual y mantenla coherente con el producto existente.

1. Inspecciona primero `src/components/ui`, `src/components/layout`, componentes de dominio cercanos y `src/app/globals.css`.
2. Reutiliza primitivas y variantes existentes. Crea una nueva solo si el patron ya se repite o la tarea introduce un bloque claramente reutilizable.
3. Usa variables y clases semanticas basadas en los tokens globales. Respeta `--accent` y `--accent-foreground`, que cambian por organizacion.
4. Evita colores, radios, anchos de pagina y espaciados globales hardcodeados dentro de una pantalla. Los emails HTML y requisitos de terceros son excepciones justificables.
5. Disena mobile-first. Verifica como minimo 375 px, una tablet y escritorio; comprueba overflow, tablas, formularios, navegacion, modales, drawers y targets tactiles.
6. Mantiene semantica, labels, teclado, foco visible, contraste y estados loading, disabled, empty y error.
7. No refactorices componentes grandes fuera del area tocada. Extrae solo la pieza necesaria cuando reduzca duplicacion real o complejidad de la tarea.
8. Renderiza las rutas afectadas, revisa consola y red, y corrige regresiones antes de terminar.
