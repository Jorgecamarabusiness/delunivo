import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ResetPasswordForm } from "./ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <div className="flex flex-1 flex-col bg-background text-foreground">
      <Header />

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
        <div className="w-full max-w-sm">
          <h1 className="text-center text-2xl font-bold tracking-tight">
            Elige una nueva contraseña
          </h1>

          <ResetPasswordForm />
        </div>
      </main>

      <Footer />
    </div>
  );
}
