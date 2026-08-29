import { TituloPantalla } from "@/components/shared/titulo-pantalla";
import { requireUser } from "@/modules/auth/session";
import { TaxStatusBanner } from "@/modules/professionals/components/tax-status-banner";

export const metadata = { title: "Tablero - Atlas" };

// Landing del shell. El cierre de sesion vive en el header (avatar). El
// contenido real del tablero llega en bloques posteriores.
//
// ES LA UNICA PANTALLA DONDE EL BLOQUE DE TITULO ES UN SALUDO, y por eso es la unica donde no repite la
// barra superior: alli dice "Tablero" (la seccion) y aqui el nombre de quien entra. Es exactamente el uso
// que le da la referencia del LMS, que era un saludo en el landing y no un rotulo de pantalla.
export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <div className="mx-auto flex w-full max-w-[80rem] flex-col gap-4">
      {/* Banner de retencion: solo aparece si es un integrante con comision pendiente y datos tributarios
          sin completar. Va en el landing para que lo vea desde su primera venta. */}
      <TaxStatusBanner />

      {/* SUBTITULO RECORTADO A LA MITAD UTIL. Decia "Este es tu tablero de Atlas. Las secciones
          disponibles dependen de tu rol": la primera frase repetia el titulo y el nombre de la aplicacion,
          que el usuario tiene delante. La segunda dice algo que la pantalla NO muestra (por que su barra
          lateral tiene unos items y no otros), asi que se queda. */}
      <TituloPantalla
        titulo={`Hola, ${user.fullName}`}
        descripcion="Las secciones disponibles dependen de tu rol."
      />
    </div>
  );
}
