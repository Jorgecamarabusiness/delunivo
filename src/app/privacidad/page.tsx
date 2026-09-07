import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { getLegalIdentity } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacidad — Delunivo" };

export default function PrivacidadPage() {
  const legal = getLegalIdentity();
  return (
    <LegalPage title="Política de privacidad" identityComplete={legal.complete}>
      <LegalSection title="Responsable y datos tratados">
        <p>
          Responsable: {legal.name}, NIF/CIF {legal.taxId}, con domicilio en
          {` ${legal.address}`}. Contacto para privacidad: {legal.email}.
        </p>
        <p>
          Tratamos los datos de cuenta, contacto, pertenencia a escuelas,
          compras, progreso, soporte y registros técnicos necesarios para
          prestar y proteger el servicio.
        </p>
      </LegalSection>
      <LegalSection title="Finalidades y bases jurídicas">
        <p>
          Usamos los datos para crear y mantener la cuenta, ejecutar contratos y
          pagos, entregar cursos, atender soporte, cumplir obligaciones legales y
          prevenir fraude o accesos indebidos. Las bases son el contrato, el
          cumplimiento legal, el interés legítimo de seguridad y, cuando proceda,
          el consentimiento.
        </p>
      </LegalSection>
      <LegalSection title="Proveedores y transferencias">
        <p>
          Para operar el servicio intervienen proveedores de alojamiento, base
          de datos, autenticación, pagos, vídeo y correo, entre ellos Vercel,
          Supabase, Stripe, Mux y Resend. Se aplican los contratos y garantías de
          transferencia internacional que correspondan.
        </p>
      </LegalSection>
      <LegalSection title="Conservación y derechos">
        <p>
          Los datos de perfil, progreso y pertenencia se mantienen mientras exista
          la cuenta. Puedes iniciar su eliminación desde el perfil; afecta a todas
          las escuelas. Las escuelas conservan sus cursos y archivos para dar
          continuidad al acceso de sus demás alumnos.
        </p>
        <p>
          Al eliminar la cuenta se separa su identidad de los recibos. La auditoría
          de la solicitud se reduce al año y su identificador histórico se conserva
          como máximo seis años para conciliación de pagos y reclamaciones. Las
          facturas y obligaciones contables de cada vendedor siguen sus propios
          plazos legales; eliminarlas no forma parte del borrado de la cuenta.
          Los códigos caducados se eliminan tras un día; las credenciales y datos
          técnicos de una sesión de soporte se limpian al caducar, y su registro
          se elimina al año. Los parámetros de pagos cerrados se minimizan a los
          noventa días.
        </p>
        <p>
          La limpieza se ejecuta mediante trabajos recuperables. Si queda un pago
          o archivo pendiente de resolver, se informa del estado y se impiden
          nuevos accesos. Los enlaces de vídeo ya emitidos pueden funcionar hasta
          su caducidad; cerrar la cuenta impide obtener otros nuevos. Las copias de
          seguridad no se modifican de inmediato y se someten a su ciclo de
          conservación y a controles para que una recuperación no reactive cuentas
          eliminadas.
        </p>
        <p>
          Puedes solicitar acceso, rectificación,
          supresión, oposición, limitación o portabilidad escribiendo a
          {` ${legal.email}`}, y reclamar ante la AEPD.
        </p>
      </LegalSection>
      <LegalSection title="Escuelas y creadores">
        <p>
          Cada escuela vende sus cursos y es responsable de los tratamientos
          que decide para esa relación. Delunivo presta el servicio SaaS a la
          escuela y trata los datos necesarios siguiendo las instrucciones
          contractuales aplicables, además de gestionar la cuenta global y la
          seguridad del servicio. La ficha de cada escuela permite publicar
          su identidad y contacto; conectar Stripe no rellena ni sustituye esa ficha.
        </p>
      </LegalSection>
      <LegalSection title="Cookies y contenidos de terceros">
        <p>
          Se utilizan cookies necesarias para la autenticación, la seguridad y
          el seguimiento de las solicitudes iniciadas por el usuario. Los enlaces
          de referido identifican la recomendación solicitada al abrirlos. No se
          instala publicidad propia ni se solicitan permisos de marketing en el
          registro. Los vídeos incrustados de YouTube o Vimeo permanecen sin cargar
          hasta que el usuario elige abrirlos; entonces el proveedor recibe datos
          del navegador conforme a su política. Mux entrega el vídeo privado y
          procesa información técnica de reproducción para operar ese servicio.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
