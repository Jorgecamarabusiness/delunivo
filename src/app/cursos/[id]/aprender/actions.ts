"use server";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types";

/**
 * Marca o desmarca una lección como completada.
 *
 * Modelo: una fila en `video_views` = esa lección está completada por ese
 * alumno (ver docs/sql/2026-08-11-progreso-alumno.sql). Antes el progreso vivía
 * solo en un useState del navegador y se perdía al cerrar la pestaña.
 *
 * Se usa el cliente de SESIÓN, no el admin: la RLS de `video_views` ya limita
 * cada alumno a sus propias filas (`user_id = auth.uid()` en insert y delete),
 * así que no hay que comprobarlo a mano ni hay forma de tocar el progreso de
 * otro. Y para leer las lecciones del curso hace falta seguir teniendo acceso,
 * que es lo que ya valida la página.
 */
export async function setLessonCompletedAction(
  lessonId: string,
  completed: boolean
): Promise<ActionResult> {
  if (!lessonId) return { error: "Falta la lección." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Debes iniciar sesión para hacer esto." };

  if (completed) {
    // `ignoreDuplicates` para que volver a marcar algo ya marcado no falle
    // contra el índice único ni mueva la fecha original.
    const { error } = await supabase
      .from("video_views")
      .upsert(
        { user_id: user.id, lesson_id: lessonId },
        { onConflict: "user_id,lesson_id", ignoreDuplicates: true }
      );

    if (error) return { error: error.message };
    return { error: null };
  }

  const { error } = await supabase
    .from("video_views")
    .delete()
    .eq("user_id", user.id)
    .eq("lesson_id", lessonId);

  if (error) return { error: error.message };
  return { error: null };
}
