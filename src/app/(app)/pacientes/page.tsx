import { redirect } from "next/navigation";

import { TarjetaMetrica } from "@/components/shared/tarjeta-metrica";
import { requireUser } from "@/modules/auth/session";
import { listPatientsForProfessional } from "@/modules/patients/data/patients-list-reader";

import { ListaPacientes } from "@/modules/patients/components/lista-pacientes";
import { canViewPatients } from "@/modules/patients/policies/can-view-patients";

export const metadata = { title: "Pacientes - Atlas" };

// Roster de pacientes del profesional. Autorizacion de ruta por policy (regla 3); el
// alcance de datos (solo los propios, o todos para admin) lo impone RLS.
export default async function PacientesPage() {
  const user = await requireUser();
  if (!canViewPatients(user)) {
    redirect("/no-autorizado");
  }

  const pacientes = await listPatientsForProfessional();

  // LAS TRES METRICAS SALEN DEL MISMO ARREGLO QUE YA SE TRAE: CERO CONSULTAS NUEVAS. El reader ya devuelve
  // el conteo de evaluaciones y el estado de autorizaciones por paciente, asi que esto es aritmetica sobre
  // datos que la pagina ya tenia en memoria. Si algun dia una metrica pidiera una consulta propia, se
  // decide entonces si vale su coste; hoy no lo pide ninguna.
  const totalEvaluaciones = pacientes.reduce((n, p) => n + p.evaluationCount, 0);
  const sinEvaluaciones = pacientes.filter((p) => p.evaluationCount === 0).length;

  return (
    <div className="flex flex-col gap-4">
      {/*
        EXPLORACION (b): el titulo dentro de un bloque del color de marca, como el LMS. Montado para que
        Santiago lo vea con la pantalla delante; mi lectura va en el reporte, y NO es que lo defienda.
      */}
      <header className="rounded-2xl bg-primary px-6 py-5 text-primary-foreground">
        <h1 className="text-titulo font-bold tracking-tight">Pacientes</h1>
        {/* El subtitulo NO se quita aqui: dice algo que el profesional no puede deducir de la pantalla
            (que la lista esta recortada a los suyos). En otras pantallas puede que solo repita el titulo,
            y ahi si sobra: es caso por caso, no una regla. */}
        <p className="max-w-2xl text-sm text-primary-foreground/80">
          Tus pacientes y el acceso a su historia clínica. Solo ves los pacientes asignados a ti.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <TarjetaMetrica
          rotulo="Pacientes"
          valor={pacientes.length}
          detalle="Asignados a ti"
        />
        <TarjetaMetrica
          rotulo="Evaluaciones"
          valor={totalEvaluaciones}
          detalle="Vigentes, sin contar las reemplazadas"
        />
        {/* LA TERCERA ES ACCIONABLE, que era el criterio: nombra una lista de personas a las que hay que
            hacerles algo. Un paciente registrado sin ninguna evaluacion es un hueco operativo real (entro
            al sistema y nunca se le midio), y no necesita ningun umbral clinico para definirse. */}
        <TarjetaMetrica
          rotulo="Sin evaluaciones"
          valor={sinEvaluaciones}
          detalle="Registrados pero nunca evaluados"
          acento
        />
      </section>

      {/* Filas de dos lineas con buscador, no tabla: esta lista se BUSCA (BRAND, "si busca, densidad; si
          compara, columnas"). El buscador necesita estado, asi que la lista es un componente cliente; la
          pagina sigue siendo servidor y trae el roster bajo RLS. */}
      <ListaPacientes pacientes={pacientes} />
    </div>
  );
}
