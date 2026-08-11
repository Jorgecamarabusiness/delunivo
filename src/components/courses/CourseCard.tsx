import Link from "next/link";
import { formatPrice } from "@/lib/format";
import type { PublicCourse } from "@/lib/courses/publicCourses";

/**
 * Tarjeta de curso del sitio público. Antes este marcado estaba escrito a mano
 * y distinto en cada página (listado, landing), así que ni el aspecto ni la
 * información coincidían entre unas y otras.
 */
export function CourseCard({
  course,
  href,
}: {
  course: PublicCourse;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-lg border border-border transition-colors hover:border-foreground/30"
    >
      <CourseThumbnail
        title={course.title}
        thumbnailUrl={course.thumbnailUrl}
        className="aspect-video"
      />

      <div className="flex flex-1 flex-col gap-2 p-5">
        <h3 className="font-semibold leading-snug">{course.title}</h3>

        {course.shortDescription && (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {course.shortDescription}
          </p>
        )}

        <p className="mt-auto pt-2 text-sm font-semibold">
          {formatPrice(course.price)}
        </p>
      </div>
    </Link>
  );
}

/**
 * Imagen del curso, con un marcador de posición cuando todavía no se ha subido
 * ninguna. `courses.thumbnail_url` existía en la base de datos desde el
 * principio pero no se leía en ninguna pantalla.
 */
export function CourseThumbnail({
  title,
  thumbnailUrl,
  className = "",
}: {
  title: string;
  thumbnailUrl: string | null;
  className?: string;
}) {
  if (!thumbnailUrl) {
    return (
      <div
        className={`flex items-center justify-center bg-muted ${className}`.trim()}
      >
        <span className="px-4 text-center text-sm font-medium text-muted-foreground">
          {title}
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={thumbnailUrl}
      alt={title}
      className={`w-full bg-muted object-cover ${className}`.trim()}
      loading="lazy"
    />
  );
}
