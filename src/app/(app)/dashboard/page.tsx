import { Banda } from "@/components/shared/banda";
import { requireUser } from "@/modules/auth/session";
import { TaxStatusBanner } from "@/modules/professionals/components/tax-status-banner";

export const metadata = { title: "Tablero - Atlas" };

// Landing del shell. El cierre de sesion vive en el header (avatar). El
// contenido real del tablero llega en bloques posteriores.
//
// ES LA UNICA PANTALLA DONDE LA CABECERA ES UN SALUDO, y no un rotulo: aqui no se dice donde estas (eso
// lo dice la barra lateral), se dice quien entro.
//
// ── LLEVA BANDA, Y VA CON LO MINIMO DENTRO (2026-09-03) ─────────────────────────────────────────────
//
// El Tablero es una de las dos pantallas donde la banda con degradado se gana el sitio: es lo primero que
// se ve al abrir la aplicacion. Se adelanta la FORMA aunque el contenido llegue despues, por decision de
// Santiago.
//
// PERO SOLO EL SALUDO. Nada de cifras ni de accesos inventados mientras no decidamos que va: elegir el
// bloque antes que el contenido es como se llega a un tablero bonito que nadie mira. Lo que va dentro se
// decide listando primero QUE DATOS le ahorran un clic al profesional al entrar (pacientes sin evaluar,
// reportes sin enviar, tratamientos en borrador sin aprobar, la proxima cita de la semana), y despues
// eligiendo la forma. La proxima cita ya esta lista para consultarse: `treatments.proxima_cita` tiene
// escritor (el bloque de Seguimiento) y pantalla.
export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <div className="mx-auto flex w-full max-w-[80rem] flex-col gap-4">
      {/* Banner de retencion: solo aparece si es un integrante con comision pendiente y datos tributarios
          sin completar. Va en el landing para que lo vea desde su primera venta. Y va ANTES de la banda a
          proposito: es una condicion que bloquea el cobro, asi que no puede quedar debajo del saludo. */}
      <TaxStatusBanner />

      {/* SUBTITULO RECORTADO A LA MITAD UTIL. Decia "Este es tu tablero de Atlas. Las secciones
          disponibles dependen de tu rol": la primera frase repetia el titulo y el nombre de la aplicacion,
          que el usuario tiene delante. La segunda dice algo que la pantalla NO muestra (por que su barra
          lateral tiene unos items y no otros), asi que se queda. */}
      <Banda
        titulo={`Hola, ${user.fullName}`}
        bajada="Las secciones disponibles dependen de tu rol."
      />
    </div>
  );
}
