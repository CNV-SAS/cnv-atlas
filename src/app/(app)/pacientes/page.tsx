import { ClipboardList, UserRoundX, Users } from "lucide-react";
import { redirect } from "next/navigation";

import { TarjetaMetrica } from "@/components/shared/tarjeta-metrica";
import { TituloPantalla } from "@/components/shared/titulo-pantalla";
import { requireUser } from "@/modules/auth/session";
import { listPatientsForProfessional } from "@/modules/patients/data/patients-list-reader";

import { ListaPacientes } from "@/modules/patients/components/lista-pacientes";
import { canViewPatients } from "@/modules/patients/policies/can-view-patients";

export const metadata = { title: "Pacientes - Atlas" };

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

  // LAS TRES METRICAS SALEN DEL MISMO ARREGLO QUE YA SE TRAE: CERO CONSULTAS NUEVAS. El reader ya devuelve
  // el conteo de evaluaciones y el estado de autorizaciones por paciente, asi que esto es aritmetica sobre
  // datos que la pagina ya tenia en memoria.
  const totalEvaluaciones = pacientes.reduce((n, p) => n + p.evaluationCount, 0);
  const sinEvaluaciones = pacientes.filter((p) => p.evaluationCount === 0).length;

  return (
    // ANCHO PROPIO DE ESTA PANTALLA, menor que el de la pagina. El techo global subio a 1600px por las
    // tablas anchas de Tratamiento, y ahi sigue; pero una lista de cinco columnas estirada a 1600 deja el
    // nombre y el documento en extremos lejanos, y el ojo pierde la fila al cruzarla. El ancho de lectura
    // es propiedad del CONTENIDO, igual que ya decidimos para el texto: aqui la pantalla elige el suyo.
    <div className="mx-auto flex w-full max-w-[80rem] flex-col gap-4">
      <TituloPantalla
        titulo="Pacientes"
        descripcion="Tus pacientes y el acceso a su historia clínica."
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* SIN TEXTO, y ahora con una razon mas fuerte que "no encontre nada util": "asignados a ti" seria
            FALSO para un admin. Esta pantalla la ven dos roles (`canViewPatients`: profesional y admin) y
            el alcance lo pone la RLS, que al profesional le da los suyos y al admin TODOS. Una nota fija
            diria una cosa cierta para uno y falsa para el otro.
            Lo demas que se podria poner ("total de pacientes") solo repite el rotulo. Va sola. */}
        <TarjetaMetrica icono={Users} rotulo="Pacientes" valor={pacientes.length} />
        {/* AQUI SI HAY ALGO QUE EL NUMERO NO DICE: el PERIODO. Una cifra en una tarjeta de cabecera se lee
            por defecto como "este mes", y esta es acumulada desde siempre. Sustituye a la nota anterior
            ("sin contar las reemplazadas"), que hablaba de un concepto interno del flujo de correccion:
            quien no lo conozca quedaba peor que sin la nota. */}
        <TarjetaMetrica
          icono={ClipboardList}
          rotulo="Evaluaciones"
          valor={totalEvaluaciones}
          detalle="Acumuladas desde el inicio"
        />
        {/* LA TERCERA ES ACCIONABLE, que era el criterio: nombra una lista de personas a las que hay que
            hacerles algo. Un paciente registrado sin ninguna evaluacion es un hueco operativo real, y no
            necesita ningun umbral clinico para definirse. Se apaga sola cuando esta en 0. */}
        <TarjetaMetrica
          icono={UserRoundX}
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
