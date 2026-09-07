import Link from "next/link";
import { orgPath } from "@/lib/organizations/orgPath";

export default async function AdminHomePage() {
  const links = await Promise.all([
    { path: "/admin/cursos", title: "Cursos", description: "Crea cursos y organiza sus lecciones y contenidos." },
    { path: "/admin/usuarios", title: "Alumnos y equipo", description: "Gestiona invitaciones, accesos y administradores de tu escuela." },
    { path: "/admin/marca", title: "Marca y vendedor", description: "Revisa el enlace público, la identidad de la escuela y sus datos de venta." },
  ].map(async item => ({ ...item, href: await orgPath(item.path) })));
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="text-2xl font-bold tracking-tight">Panel de administración</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Gestiona el contenido, las personas y la información pública de tu escuela.
      </p>
      <div className="mt-6 grid gap-4 text-left md:grid-cols-3">
        {links.map(link => <Link key={link.href} href={link.href} className="rounded-lg border border-border p-5 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
          <h2 className="font-semibold">{link.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{link.description}</p>
        </Link>)}
      </div>
    </div>
  );
}
