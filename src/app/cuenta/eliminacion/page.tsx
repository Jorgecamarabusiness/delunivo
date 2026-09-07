import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Container } from "@/components/ui/Container";
import { AccountDeletionProgress } from "@/components/account/AccountDeletionProgress";
import { getAccountDeletionStatus } from "@/lib/account-deletion/preview";

export default async function AccountDeletionProgressPage() {
  const status = await getAccountDeletionStatus();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />
      <main className="flex-1">
        <Container width="sm" className="py-16 sm:py-24">
          <h1 className="text-3xl font-bold tracking-tight">Estado de eliminación</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Conserva esta página abierta mientras termina la solicitud. No inicies una
            segunda solicitud para la misma cuenta.
          </p>
          <div className="mt-8">
            <AccountDeletionProgress initialStatus={status} />
          </div>
        </Container>
      </main>
      <Footer />
    </div>
  );
}
