import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Container } from "@/components/ui/Container";
import { AccountDeletionRequestForm } from "@/components/account/AccountDeletionRequestForm";
import { getAccountDeletionPreview } from "@/lib/account-deletion/preview";

export default async function AccountDeletionPage({
  searchParams,
}: {
  searchParams: Promise<{ target?: string }>;
}) {
  const { target } = await searchParams;
  const preview = await getAccountDeletionPreview(target);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />
      <main className="flex-1">
        <Container width="md" className="py-10 sm:py-14">
          <h1 className="text-3xl font-bold tracking-tight">
            {preview.isSelf ? "Eliminar mi cuenta" : "Eliminar cuenta"}
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            {preview.isSelf
              ? "Revisa el alcance y confirma la solicitud. No se eliminan las escuelas ni sus cursos."
              : `Vas a solicitar la eliminación de la cuenta de ${preview.name || preview.email}.`}
          </p>
          <AccountDeletionRequestForm preview={preview} />
        </Container>
      </main>
      <Footer />
    </div>
  );
}
