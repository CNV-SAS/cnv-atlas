import { Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { TarjetaMetrica } from "@/components/shared/tarjeta-metrica";
import { TituloPantalla } from "@/components/shared/titulo-pantalla";
import { hasAnyRole } from "@/modules/auth/roles";
import { requireUser } from "@/modules/auth/session";
import { QrConsultorioBoton } from "@/modules/evaluations/components/qr-consultorio-boton";
import { listPatientsForProfessional } from "@/modules/patients/data/patients-list-reader";

import { ListaPacientes } from "@/modules/patients/components/lista-pacientes";
import { canCreatePatientPresencial } from "@/modules/patients/policies/can-create-patient";
import { canViewPatients } from "@/modules/patients/policies/can-view-patients";

export const metadata = { title: "Lista de pacientes - Atlas" };

// Roster de pacientes del profesional. Autorizacion de ruta por policy (regla 3); el
// alcance de datos (solo los propios, o todos para admin) lo impone RLS.
//
// SIN TITULO EN EL CONTENIDO: lo pinta la barra superior del shell, que lo saca del item activo de la
// navegacion. La cabecera dice DONDE ESTAS y el contenido QUE MIRAS; en una pantalla de seccion, el
// contenido no tiene que repetir el nombre de la seccion.
export default async function PacientesPage() {
  const user = await requireUser();
  if (!canViewPatients(user)) {
    redirect("/no-autorizado");
  }

  const pacientes = await listPatientsForProfessional();
  // El alcance real de la lista lo pone la RLS por rol; la pantalla solo necesita saber cual de las dos
  // lecturas esta mostrando para no rotular mal la cifra.
  const esAdmin = hasAnyRole(user, ["admin"]);

  // LAS TRES METRICAS SALEN DEL MISMO ARREGLO QUE YA SE TRAE: CERO CONSULTAS NUEVAS. El reader ya devuelve
  // el conteo de evaluaciones y el estado de autorizaciones por paciente, asi que esto es aritmetica sobre
  // datos que la pagina ya tenia en memoria.

  return (
    // ANCHO PROPIO DE ESTA PANTALLA, menor que el de la pagina. El techo global subio a 1600px por las
    // tablas anchas de Tratamiento, y ahi sigue; pero una lista de cinco columnas estirada a 1600 deja el
    // nombre y el documento en extremos lejanos, y el ojo pierde la fila al cruzarla. El ancho de lectura
    // es propiedad del CONTENIDO, igual que ya decidimos para el texto: aqui la pantalla elige el suyo.
    <div className="mx-auto flex w-full max-w-[80rem] flex-col gap-4">
      {/* "LISTA DE PACIENTES" y no "Pacientes" a secas (Santiago, 2026-09-09): "Pacientes" solo se
          confunde con "Atlas Pacientes", que es la superficie del PACIENTE (la encuesta). El titulo dice
          ademas lo que la pantalla ES, que es una lista, y no una seccion generica. */}
      <TituloPantalla
        titulo="Lista de pacientes"
        descripcion="Tus pacientes y el acceso a su historia clínica."
        acciones={
          // EL BOTON SOLO PARA QUIEN PUEDE CREAR (misma policy que gatea la ruta y la accion): un boton
          // que lleva a /no-autorizado es peor que no tenerlo.
          canCreatePatientPresencial(user) ? (
            // ═══ LAS DOS FORMAS DE EMPEZAR, JUNTAS (Santiago, 2026-09-10) ═══
            //
            // El QR y "nuevo paciente en consulta" son las dos maneras de que entre alguien, y estaban en
            // pantallas distintas: quien buscaba una no encontraba la otra. El QR va PRIMERO en el orden
            // de lectura pero como boton secundario, porque es el camino de todos los dias y el otro es
            // el excepcional (el paciente sin correo).
            <div className="flex flex-wrap items-center gap-2">
              <QrConsultorioBoton />
              <Button asChild>
                <Link href="/pacientes/nuevo">Nuevo paciente en consulta</Link>
              </Button>
            </div>
          ) : null
        }
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* EL TEXTO DEPENDE DEL ROL, porque el DATO depende del rol y la pantalla ya sabe quien mira.
            Descartamos una frase fija porque cualquiera era mentira para alguien: "asignados a ti" es
            falso para un admin y "totales en el sistema" es falso para un profesional. El alcance lo pone
            la RLS (`patients_select`: el profesional ve los suyos, el admin todos), asi que la nota dice
            lo que ese usuario esta viendo de verdad. La simetria no vale mas que la verdad, pero aqui no
            hace falta elegir entre las dos. */}
        <TarjetaMetrica
          icono={Users}
          rotulo="Pacientes"
          valor={pacientes.length}
          detalle={esAdmin ? "Todos los del sistema" : "Asignados a ti"}
        />
        {/* ═══ SE RETIRAN DOS DE LAS TRES, POR EL MISMO CORTE DEL TABLERO (2026-09-10) ═══

            · "EVALUACIONES ACUMULADAS DESDE EL INICIO": un contador que solo sube. Nadie actua sobre el, y
              gasta un tercio de la cabecera de la pantalla que mas se usa.
            · "SIN EVALUACIONES": era la accionable de las tres, y por eso se retira AHORA y no antes: la
              columna de pendientes ya lo dice paciente por paciente, con su nombre delante y con el
              destino a un clic. Una cifra que nombra una lista es peor que la lista, cuando la lista ya
              esta ahi abajo.

            SE QUEDA "Pacientes" porque no es lo mismo: no nombra un trabajo, dice el TAMAÑO de lo que
            estas mirando, y eso es contexto de la lista que tiene debajo. */}
      </section>

      {/* Filas de dos lineas con buscador, no tabla: esta lista se BUSCA (BRAND, "si busca, densidad; si
          compara, columnas"). El buscador necesita estado, asi que la lista es un componente cliente; la
          pagina sigue siendo servidor y trae el roster bajo RLS. */}
      <ListaPacientes pacientes={pacientes} />
    </div>
  );
}
