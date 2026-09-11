import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { TituloPantalla } from "@/components/shared/titulo-pantalla";
import { hasAnyRole } from "@/modules/auth/roles";
import { requireUser } from "@/modules/auth/session";
import { canArchivePatient } from "@/modules/patients/policies/can-archive-patient";
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

  // LAS DOS CIFRAS SALEN DEL MISMO ARREGLO QUE YA SE TRAE: cero consultas nuevas, aritmetica sobre datos
  // que la pagina ya tenia en memoria.
  //
  // ARCHIVADO SE DERIVA DE `status`, la MISMA fuente que usa el conmutador de la lista. Contarlo aparte
  // (con una consulta propia o con otro criterio) seria la forma de que la cabecera y el conmutador
  // acabaran diciendo cifras distintas de lo mismo.
  const archivados = pacientes.filter((p) => p.status === "inactive").length;
  const activos = pacientes.length - archivados;

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
        // ═══ LAS CIFRAS BAJAN AL SUBTITULO (Santiago, 2026-09-11) ═══
        //
        // La tarjeta "Pacientes · 11 · Asignados a ti" sale de aqui para que la TABLA sea lo que manda en
        // esta pantalla. Y NO se muda al tablero: de ahi ya se retiro con el corte, porque no cambia
        // ninguna decision ni lleva a ningun sitio.
        //
        // Su propuesta es mejor que las dos: como texto pequeño junto al titulo dice lo mismo, no gasta
        // un tercio de la cabecera, y ademas cabe una segunda cifra que la tarjeta no tenia.
        //
        // LA DESCRIPCION VIEJA SE VA CON ELLA. Decia "Tus pacientes y el acceso a su historia clinica",
        // que es lo que el titulo ya dice: describia la pantalla en vez de decir algo de lo que hay
        // dentro. Es el mismo corte que se le hizo al subtitulo de /pagos.
        //
        // EL ALCANCE DEPENDE DEL ROL porque el DATO depende del rol, y la pantalla ya sabe quien mira:
        // "asignados a ti" es falso para un admin y "en el sistema" es falso para un profesional. Lo pone
        // la RLS (`patients_select`), asi que la frase dice lo que ESE usuario esta viendo de verdad.
        //
        // Y LOS ARCHIVADOS SOLO SI HAY: misma regla que el conmutador de la lista, que tampoco aparece
        // con cero. Un "0 archivados" ocupa sitio para decir que no hay nada que decir.
        descripcion={
          <>
            {activos} {activos === 1 ? "paciente" : "pacientes"}{" "}
            {esAdmin ? "en el sistema" : "asignados a ti"}
            {archivados > 0 ? ` · ${archivados} ${archivados === 1 ? "archivado" : "archivados"}` : ""}
          </>
        }
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

      {/* Filas de dos lineas con buscador, no tabla: esta lista se BUSCA (BRAND, "si busca, densidad; si
          compara, columnas"). El buscador necesita estado, asi que la lista es un componente cliente; la
          pagina sigue siendo servidor y trae el roster bajo RLS. */}
      <ListaPacientes pacientes={pacientes} puedeArchivar={canArchivePatient(user)} />
    </div>
  );
}
