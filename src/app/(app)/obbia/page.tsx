import { theadTr, th } from "@/components/shared/tabla";

/** El rotulo de cada eje de consolidado. Una sola fuente: lo usan el titulo y el encabezado de columna. */
const ROTULO_DEL_EJE: Record<"pais" | "ciudad" | "sexo" | "profesional", string> = {
  pais: "Por país",
  ciudad: "Por ciudad",
  sexo: "Por sexo",
  profesional: "Por profesional",
};
import { TituloPantalla } from "@/components/shared/titulo-pantalla";
import { redirect } from "next/navigation";

import { formatDate } from "@/lib/format/date";

import {
  BarraDeProporcion,
  BarrasDeLaCohorte,
} from "@/modules/obbia/components/barras-de-la-cohorte";
import { leerCohorteDeInvestigacion } from "@/modules/obbia/data/cohorte-reader";
import { getResearchDatasets } from "@/modules/obbia/data/research-reader";
import { canViewObbia } from "@/modules/obbia/policies/can-view-obbia";
import {
  CIFRAS_DEL_PANEL,
  EXPORT_FILA_A_FILA_DE_LA_VISTA,
  nivelDeAnonimizacion,
  type NivelDeAnonimizacion,
  sigueSiendoDatoPersonal,
} from "@/modules/obbia/services/nivel-de-anonimizacion";
import { requireUser } from "@/modules/auth/session";
import {
  ROTULO_DE_LA_VISTA,
  VISTAS_DEL_PANEL,
  type VistaDelPanel,
  vistaPedida,
} from "@/modules/obbia/services/vistas-del-panel";

// ═══ EL NIVEL SE DICE EN ESPAÑOL, Y EL CRUDO AL LADO ═══
//
// El crudo (`pseudonymized`) es el valor que la base guarda y el que hay que poder citar al hablar con
// alguien que lea la tabla; el rótulo es para quien mira la pantalla. Decir solo uno de los dos deja a
// alguien sin la palabra que necesita.
const ROTULO_DEL_NIVEL: Record<NivelDeAnonimizacion, string> = {
  aggregate: "Agregado",
  pseudonymized: "Seudonimizado",
  anonymized: "Anonimizado",
};

export const metadata = { title: "ObBIA - Atlas" };

function fmt(iso: string): string {
  return formatDate(iso);
}

// Una cifra con su rotulo y su nota. La nota NO es decoracion: dice de que es la cifra, para que el numero
// no quede mudo (mismo criterio que la lectura del delta en la comparacion de seguimiento).
function Cifra({ rotulo, valor, nota }: { rotulo: string; valor: number; nota: string }) {
  // COMA DECIMAL (Santiago, 2026-11-03): la edad media salia "43.5" con punto, en una pantalla que
  // escribe la coma en todas las demas cifras. Media correccion deja el sistema leyendose como mal hecho,
  // que es la regla de ortografia por superficie de CLAUDE.md. Los enteros no cambian.
  const texto = Number.isInteger(valor) ? String(valor) : String(valor).replace(".", ",");
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-border bg-background p-3">
      <span className="text-xs text-muted-foreground">{rotulo}</span>
      <span className="text-2xl font-semibold tabular-nums text-foreground">{texto}</span>
      <span className="text-xs text-muted-foreground">{nota}</span>
    </div>
  );
}

// ═══ LAS TRES VISTAS, COMO SU CNVResearch (cotejo del 2026-11-03) ═══
//
// Su modulo abre en Resumen · Datos · Exportar, y las tres pestanas son TRES PERMISOS: dicen que se puede
// hacer antes de ensenar nada. /obbia era un rollo que habia que recorrer entero para enterarse de que el
// fila a fila no se puede.
//
// SON ENLACES, no botones: la vista viaja en la URL, asi que el panel sigue sin una linea de JavaScript de
// cliente y una pestana concreta se puede compartir por enlace. Y la cerrada EXISTE (ver
// `vistas-del-panel`): una ausencia no explica nada, una puerta cerrada con su razon si.
function NavDeVistas({ vista }: { vista: VistaDelPanel }) {
  return (
    <nav aria-label="Vistas del panel" className="flex flex-wrap gap-1 border-b border-border">
      {VISTAS_DEL_PANEL.map((v) => {
        const activa = v === vista;
        return (
          <a
            key={v}
            href={`/obbia?vista=${v}`}
            aria-current={activa ? "page" : undefined}
            className={
              "-mb-px rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium transition-colors " +
              (activa
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground")
            }
          >
            {ROTULO_DE_LA_VISTA[v]}
            {/* EL CANDADO SE VE EN LA PESTANA, no solo al entrar: asi se sabe que no se puede antes de
                pulsarla, que es la mitad del valor de que la pestana exista. */}
            {v === "datos" ? <span className="ml-1 text-xs">(cerrada)</span> : null}
          </a>
        );
      })}
    </nav>
  );
}

// Panel de obbia (B14): datasets de investigacion gobernados, data agregada sin PII. La
// autorizacion va por policy (regla 3); la lectura, por RLS (obbia solo lee research_datasets).
export default async function ObbiaPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string }>;
}) {
  const user = await requireUser();
  if (!canViewObbia(user)) {
    redirect("/no-autorizado");
  }

  const vista = vistaPedida((await searchParams).vista);

  const [datasets, cohorte] = await Promise.all([
    getResearchDatasets(),
    leerCohorteDeInvestigacion(),
  ]);
  const nivelDelExport = nivelDeAnonimizacion(EXPORT_FILA_A_FILA_DE_LA_VISTA);
  const nivelDeLaPantalla = nivelDeAnonimizacion(CIFRAS_DEL_PANEL);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        {/* ═══ EL ENCABEZADO SE DERIVA, Y ANTES SE CONTRADECIA CON SU PROPIA PANTALLA ═══

            Decía "Solo data agregada o anonimizada; nunca datos personales del paciente" mientras el
            bloque de abajo decía que un dataset fila a fila de esta cohorte sería SEUDONIMIZADO y que eso
            sigue siendo dato personal (Gildardo, 2026-10-25). Las dos frases hablan de lo mismo y una de
            las dos sobra: la de abajo está calculada, la de arriba estaba escrita a mano.

            Y la diferencia importa, porque no son la misma pregunta: lo que ESTA PANTALLA muestra sí es
            agregado (ni una fila cruza), y lo que un DATASET llevaría no lo es. El encabezado nuevo dice
            las dos cosas, y las dos salen de `nivelDeAnonimizacion`: si mañana la vista deja de llevar
            `patient_id`, esta frase cambia sola. */}
        <TituloPantalla
          titulo="Investigación"
          descripcion={
            `Esta pantalla es ${ROTULO_DEL_NIVEL[nivelDeLaPantalla.nivel].toLowerCase()}: ni una fila de paciente la cruza. ` +
            `Un dataset fila a fila de esta cohorte sería ${ROTULO_DEL_NIVEL[nivelDelExport.nivel].toLowerCase()}` +
            (sigueSiendoDatoPersonal(nivelDelExport.nivel)
              ? ", y eso sigue siendo dato personal."
              : ", y eso ya no es dato personal.")
          }
        />
      </div>

      <NavDeVistas vista={vista} />

      {vista === "resumen" ? (
       <>
      {/* ═══ LA COHORTE, EN CIFRAS ═══

          La vista `evaluaciones_para_investigacion` existia desde la 0224 sin ninguna pantalla, así que
          quien entraba aquí veía "no hay datasets" y concluía que no había datos. Lo que no había era la
          consulta. Y se dice lo que queda FUERA, no solo lo que queda dentro: la autorización de
          investigación es opcional, y un número que solo cuenta lo incluido deja creer que son todos. */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">
          Cohorte disponible para investigación
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Cifra
            rotulo="Consultas autorizadas"
            valor={cohorte.conAutorizacion}
            nota={`${cohorte.pacientesAutorizados} pacientes distintos`}
          />
          <Cifra
            rotulo="Con diagnóstico sellado"
            valor={cohorte.conDiagnostico}
            nota="las únicas con indicadores"
          />
          {/* ESTA CIFRA SE CUENTA DIRECTO, NO POR RESTA. Con la 0230 la resta habría metido las 13 de
              huella repetida en este cubo, y el rótulo diría que no autorizaron quienes sí autorizaron. */}
          <Cifra
            rotulo="Fuera, sin autorización"
            valor={cohorte.sinAutorizacion}
            nota={`de ${cohorte.vigentes} consultas vigentes`}
          />
          {/* EL TOTAL VA EN LA NOTA, y sin él el 8 parecía un defecto del import. Son dos hechos
              distintos: cuántas se importaron, y cuántas de esas se pueden usar. */}
          <Cifra
            rotulo="Importadas del HTML"
            valor={cohorte.importadas}
            nota={`de ${cohorte.importadasVigentes} importadas en total`}
          />
        </div>

        {/* ═══ LAS CUATRO CIFRAS DE SU CNVResearch QUE AQUÍ NO ESTABAN (cotejo 2026-11-03) ═══

            Su panel tiene siete tarjetas y /obbia tenía cuatro. Las que faltaban no son adorno: son las
            que dicen QUÉ SE PUEDE ANALIZAR con esta cohorte.

              · CON ESPECTRO (Z5-Z500 crudos): es la variable que su propia v11 §5.1 rescató porque *"se
                botaba al guardar"*. Sin saber cuántas la traen, no se puede plantear un análisis que la
                use.
              · CON ENCUESTA: lo que el paciente contó. Sin ella no hay DFI ni EB-BIS completa.
              · CON PLAN NUTRICIONAL: las que llegaron hasta la prescripción, que es el desenlace.
              · EDAD MEDIA CON SU RANGO: el rango va al lado a propósito, igual que en su archivo. Una
                media de 41 años sobre un rango de 18 a 79 y una sobre uno de 39 a 43 son dos cohortes
                completamente distintas, y la media sola no las distingue.

            VAN EN UNA SEGUNDA FILA, debajo y en gris: las cuatro de arriba responden *"cuántas puedo
            usar"*, que es la pregunta de gobierno; estas responden *"qué traen"*, que es la de análisis.
            Mezclarlas en una sola rejilla de ocho borraría esa diferencia. */}
        <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2 lg:grid-cols-4">
          <Cifra
            rotulo="Con espectro"
            valor={cohorte.cifrasDeLaCohorte.conEspectro}
            nota="Z5–Z500 crudos"
          />
          <Cifra
            rotulo="Con encuesta"
            valor={cohorte.cifrasDeLaCohorte.conEncuestaCompleta}
            nota="lo que el paciente contó"
          />
          <Cifra
            rotulo="Con plan nutricional"
            valor={cohorte.cifrasDeLaCohorte.conPlanNutricional}
            nota="llegaron a la prescripción"
          />
          {/* ═══ COMA DECIMAL, Y SIN EL CERO DE UNA FECHA IMPOSIBLE (Santiago, 2026-11-03) ═══

              Decía "43.5" con punto, en una pantalla que escribe "43,5" en todas las demás cifras, y
              "rango 0–78". Ese 0 no es un paciente: es una fecha de nacimiento con el año 2026 en una
              consulta medida en 2026. Un recién nacido no se puede medir en un Biody.

              LO EXCLUIDO SE DICE, en la propia nota: un rango que empieza en 1 sin explicar por qué
              invita a preguntarse si falta alguien. Es la misma regla que gobierna la cifra de excluidos
              del panel y la de celdas suprimidas del archivo. */}
          <Cifra
            rotulo="Edad media"
            valor={cohorte.cifrasDeLaCohorte.edadMedia ?? 0}
            nota={
              cohorte.cifrasDeLaCohorte.edadMinima == null
                ? "sin fechas de nacimiento"
                : `rango ${cohorte.cifrasDeLaCohorte.edadMinima}–${cohorte.cifrasDeLaCohorte.edadMaxima}, a la fecha de la medición` +
                  (cohorte.cifrasDeLaCohorte.edadImposible > 0
                    ? ` · ${cohorte.cifrasDeLaCohorte.edadImposible} fuera por fecha de nacimiento imposible`
                    : "")
            }
          />
        </div>

        {/* ═══ LOS PACIENTES DEL HTML: QUE SE PUEDE HACER CON ELLOS (Santiago, 2026-10-30) ═══

            LA CIFRA SOLA NO LO DICE, y la diferencia es jurídica, no de conteo: el consentimiento que
            esos pacientes firmaron (el del HTML) NO TENÍA CASILLA DE INVESTIGACIÓN, así que no hay nada
            que autorice usar sus datos fila a fila. No es que hayan dicho que no: es que nadie les
            preguntó.

            EL LIMITE ES LO SEUDONIMIZADO, NO LO ANONIMIZADO, y la distincion la fijo la consulta legal
            del 2026-11-03. Las cuentas agregadas de esta pantalla no necesitan su autorizacion (nadie es
            identificable en un conteo por cohorte, que es la regla 3 del uso agregado de
            `DATA_GOVERNANCE.md`), y TAMPOCO la necesita un conjunto ANONIMIZADO comercializable: su
            propia finalidad (c) cubre el acto de anonimizar, y lo anonimizado deja de ser dato personal.
            Lo que su consentimiento NO cubre es nada SEUDONIMIZADO (investigacion ObBIA-Latam y control
            de calidad), que es justo lo que seria un dataset fila a fila con la llave del paciente.

            Y LA CONDICION ES UNICA PARA TODOS, sin filtro por origen: k-anonimato con k >= 5 y supresion
            de celdas pequenas, aplicados TECNICAMENTE en toda salida comercializable, antes de la primera
            venta. O sea que no hay una regla para los del HTML y otra para los de Atlas: hay una, y es
            tecnica.

            Y LA SALIDA EXISTE, que es lo que hay que decir en vez de dejarlo como una pérdida: si firman
            el consentimiento de Atlas (la regularización que ya ofrece la ficha), entran. Por eso la
            cifra de arriba cuenta "importadas Y autorizadas": las que ya lo hicieron. */}
        {cohorte.importadasVigentes > 0 ? (
          <p className="max-w-prose rounded border border-border bg-muted/30 p-2 text-xs text-foreground">
            <strong>
              De las {cohorte.importadasVigentes} consultas importadas del HTML, {cohorte.importadas}{" "}
              {cohorte.importadas === 1 ? "entra" : "entran"} a un dataset fila a fila
            </strong>
            . Las demás sí entran en lo <strong>agregado y en lo anonimizado</strong>, como las
            cifras de esta pantalla: lo que su consentimiento no cubre es el uso{" "}
            <strong>seudonimizado</strong>, que es el del dataset con la llave del paciente. No dijeron
            que no, nadie les preguntó: el consentimiento del HTML no tenía casilla de investigación. Si
            firman el de Atlas, entran solas.
          </p>
        ) : null}

        {/* ═══ LA EXCLUSIÓN POR CALIDAD DE DATO (0230) ═══

            Va ARRIBA del desglose por consentimiento y separada de él, porque no es lo mismo: el paciente
            SÍ autorizó, lo que falla es el dato. La misma toma física está en dos historias clínicas, y en
            5 de los 11 grupos son pacientes distintos, así que el diagnóstico de una de las dos salió de
            la bioimpedancia de otra persona. Vuelven solas cuando la corrección deje una sola vigente. */}
        {cohorte.fueraPorHuellaRepetida.consultas > 0 ? (
          <p className="max-w-prose rounded border border-attention bg-attention-bg p-2 text-xs text-foreground">
            <strong>
              {cohorte.fueraPorHuellaRepetida.consultas} consultas autorizadas quedan fuera por calidad de
              dato
            </strong>
            : su medición tiene la misma huella que otra consulta vigente (
            {cohorte.fueraPorHuellaRepetida.grupos}{" "}
            {cohorte.fueraPorHuellaRepetida.grupos === 1 ? "grupo" : "grupos"},{" "}
            {cohorte.fueraPorHuellaRepetida.pacientes} pacientes). Es la misma toma física en dos historias
            clínicas, así que no se puede saber de quién es el cuerpo que describe. Vuelven a entrar solas
            cuando la corrección deje una sola de las dos vigente.
          </p>
        ) : null}

        {/* ═══ POR QUÉ QUEDAN FUERA LAS QUE QUEDAN FUERA (Gildardo, 2026-10-25) ═══

            "197 de 513 es el 38 %, pero dijiste que 53 de 402 pacientes no autorizaron (13 %)". Las dos
            cifras son ciertas y miden cosas distintas: un paciente sin autorización que tuvo tres
            consultas pone TRES en el conteo de consultas. Por eso cada razón trae las dos columnas, y por
            eso la mayor parte de los excluidos no "dijo que no": nunca firmó en Atlas, porque el
            consentimiento del HTML no tenía casilla de investigación. */}
        {cohorte.sinAutorizacionPorRazon.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead>
                <tr className={theadTr}>
                  <th className={th}>Por qué queda fuera</th>
                  <th className={th}>Consultas</th>
                  <th className={th}>Pacientes</th>
                  {/* LA PROPORCIÓN, que es la pregunta que la tabla no contestaba: con tres razones y
                      cifras de tres dígitos, cuál pesa más se calculaba a mano. */}
                  <th className={th}>Peso</th>
                </tr>
              </thead>
              <tbody>
                {cohorte.sinAutorizacionPorRazon.map((r) => (
                  <tr key={r.razon} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2 text-foreground">{r.razon}</td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">{r.consultas}</td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">{r.pacientes}</td>
                    <td className="px-3 py-2 text-xs">
                      {/* SOBRE EL TOTAL DE EXCLUIDAS, no sobre las vigentes: lo que esta columna compara
                          son las razones entre sí, y con el total de la cohorte los tres porcentajes
                          saldrían pequeños y no se compararían. El rótulo "Peso" lo dice. */}
                      <BarraDeProporcion valor={r.consultas} total={cohorte.sinAutorizacion} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <p className="max-w-prose text-xs text-muted-foreground">
          Consulta vigente es la de un paciente real, no reemplazada por una corrección y no retirada
          (migración 0224). La autorización de investigación es{" "}
          <strong className="text-foreground">opcional</strong>: quien no la dio sigue siendo paciente de
          CNV y queda fuera de cualquier dataset. Estas cifras no salen de una copia: son la vista.
        </p>
        {/* ═══ EL AVISO DE VERSIONES DECIA ALGO FALSO (Gildardo, 2026-10-25) ═══

            Avisaba "la cohorte mezcla 2 versiones del motor" sobre `1.0.0` y `anibise-1.4.0`, y son la
            MISMA ciencia: el 2026-09-09 el motor se renombró de `anibise-1.4.0` a `1.0.0` sin mover una
            sola cifra, y los diagnósticos ya emitidos conservan la grafía vieja a propósito, porque el
            sello dice con qué se calculó. La banda de trayectoria ya las leía igual; esta pantalla no.

            Un aviso que dice "no son comparables" sobre cifras que sí lo son hace desconfiar de la cohorte
            entera, y es peor que no avisar. Ahora la alarma solo salta si hay dos familias MAYORES
            distintas, que es lo único que de verdad hace incomparables dos cifras, y en el caso normal se
            dice en voz baja cuántas grafías hay, que es un dato de calidad y no una alarma. */}
        {/* ═══ EL MISMO HECHO, DOS VOCES (2026-11-04) ═══

            En ámbar cuando la mezcla pesa; en voz baja, con la cifra, cuando la minoría es marginal (ver
            `mezclaMarginal` en el lector). El hecho no cambia y las dos familias se nombran igual: lo que
            cambia es el color, porque un aviso que exagera se aprende a ignorar. */}
        {cohorte.mezclaFamilias ? (
          <p
            className={
              "max-w-prose text-xs " +
              (cohorte.mezclaMarginal
                ? "text-muted-foreground"
                : "font-medium text-clinical-warning")
            }
          >
            La cohorte mezcla {cohorte.porFamiliaDelMotor.length} familias mayores del motor (
            {cohorte.porFamiliaDelMotor.map((f) => `${f.mayor}.x: ${f.evaluaciones}`).join(" · ")}).{" "}
            {cohorte.mezclaMarginal
              ? "Son menos del 5 % de la cohorte con diagnóstico: lo decimos porque un dataset tiene que decirlo, no porque las cifras dejen de servir."
              : "Las cifras de una familia no son comparables con las de otra y el dataset tiene que decirlo."}
          </p>
        ) : cohorte.porVersionDelMotor.length > 1 ? (
          <p className="max-w-prose text-xs text-muted-foreground">
            Toda la cohorte con diagnóstico está en una sola familia del motor
            {cohorte.porFamiliaDelMotor[0] ? ` (${cohorte.porFamiliaDelMotor[0].mayor}.x)` : ""}, así que
            sus cifras son comparables entre sí. Lo sellado trae{" "}
            {cohorte.porVersionDelMotor.length} grafías distintas (
            {cohorte.porVersionDelMotor.map((v) => `${v.version}: ${v.evaluaciones}`).join(" · ")}) porque
            el nombre de la versión cambió el 9 de septiembre y un diagnóstico emitido antes conserva el
            nombre con el que se calculó.
          </p>
        ) : null}
        {/* ═══ LA SERIE, EN BARRAS ANTES QUE EN TABLA (Santiago, 2026-10-30) ═══

            La tabla contesta bien "cuántas hubo en junio" y muy mal la pregunta por la que alguien mira
            una serie: cómo va. El escalón del mes en que entró el lote del HTML, o dos meses flojos
            seguidos, se ven de un golpe. La tabla se queda debajo porque en un panel de investigación la
            cifra exacta es lo que se cita. */}
        {cohorte.porMes.length > 0 ? (
          // ═══ UN TOPE DE ANCHO, Y NO ES COSMETICA (Santiago, 2026-11-03) ═══
          //
          // *"esas graficas tan inmensas se ven muy extrañas."* La causa de fondo estaba en el componente
          // (su `viewBox` dependia del numero de barras, ver alli), pero hay una segunda mitad que es de
          // la MAQUETA: un dibujo de proporcion 4:1 a todo el ancho de un panel de 1.400 px sigue midiendo
          // 350 px de alto, y una serie de doce meses no necesita tanto. El tope lo acota sin fijar
          // pixeles de alto, que es lo que volveria a atar el dibujo a una pantalla concreta.
          //
          // `overflow-x-auto` SE RETIRA: ya no hace falta (el dibujo cabe siempre, se reparte dentro de un
          // ancho logico fijo) y en una grafica que ya cabe, un contenedor con scroll solo puede estorbar.
          <div className="max-w-3xl">
            <BarrasDeLaCohorte
              barras={cohorte.porMes.map((m) => ({ etiqueta: m.mes, valor: m.evaluaciones }))}
              ariaLabel={
                `Consultas autorizadas por mes de la medición: ` +
                cohorte.porMes.map((m) => `${m.mes}, ${m.evaluaciones}`).join("; ") +
                "."
              }
            />
          </div>
        ) : null}
        {cohorte.porMes.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-left text-sm">
              <thead>
                <tr className={theadTr}>
                  <th className={th}>Mes de la medición</th>
                  <th className={th}>Consultas autorizadas</th>
                </tr>
              </thead>
              <tbody>
                {cohorte.porMes.map((m) => (
                  <tr key={m.mes} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2 font-medium text-foreground">{m.mes}</td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">{m.evaluaciones}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════════════════════
          LOS CONSOLIDADOS: CÓMO SE REPARTE LA COHORTE  ·  el cotejo con su CNVResearch (2026-11-03)

          ═══ POR QUÉ ESTABA ESTO Y NO LO TENÍAMOS ═══

          Su módulo estratifica la cohorte por PAÍS, CIUDAD, SEXO y PROFESIONAL, cada eje con las mismas
          cinco columnas. Era lo más grande que /obbia no tenía, y es lo que separa un panel de conteos
          de uno de investigación: *"cuántas consultas hay"* es una cifra; *"cómo se reparten"* es lo que
          decide si una cohorte sirve para un análisis, y lo primero que mira un revisor.

          ═══ SUS CINCO COLUMNAS, TAL CUAL ═══

          Consultas · Pacientes · Con BIS · Con espectro · Edad media. No se le añade ni se le quita
          ninguna: son las que su archivo muestra y las que una tabla de caracterización lleva.

          ═══ Y AQUÍ NO SALE NINGUNA FILA DE PACIENTE ═══

          Son conteos por grupo. El único eje que nombra a una persona es el del PROFESIONAL, que es
          quien atiende y no el sujeto de estudio; su propio módulo lo hace igual. La fila "Sin dato" se
          muestra a propósito: omitirla haría que las columnas no sumaran el total y nadie sabría por qué.
          ══════════════════════════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <h2 className="text-base font-semibold text-foreground">Cómo se reparte la cohorte</h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          Las mismas cinco columnas por cada eje, sobre las consultas autorizadas. Es la caracterización
          que un análisis necesita antes de mirar cualquier resultado.
        </p>
        {/* A ANCHO COMPLETO, UNA DEBAJO DE OTRA (cotejo del 2026-11-03). A dos columnas, cada tabla tiene
            seis columnas apretadas; las suyas van a ancho completo y se leen mejor. */}
        <div className="grid gap-4">
          {cohorte.estratos
            .filter((e) => e.filas.length > 0)
            .map((e) => (
              <div key={e.eje} className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-foreground">{ROTULO_DEL_EJE[e.eje]}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-left text-sm">
                    <thead>
                      <tr className={theadTr}>
                        <th className={th}>{ROTULO_DEL_EJE[e.eje]}</th>
                        <th className={th}>Consultas</th>
                        <th className={th}>Pacientes</th>
                        <th className={th}>Con BIS</th>
                        <th className={th}>Con espectro</th>
                        <th className={th}>Edad media</th>
                      </tr>
                    </thead>
                    <tbody>
                      {e.filas.map((f) => (
                        <tr key={f.grupo} className="border-b border-border/60 last:border-0">
                          <td className="px-3 py-2 font-medium text-foreground">{f.grupo}</td>
                          <td className="px-3 py-2 tabular-nums text-foreground">{f.consultas}</td>
                          <td className="px-3 py-2 tabular-nums text-muted-foreground">{f.pacientes}</td>
                          <td className="px-3 py-2 tabular-nums text-muted-foreground">{f.conBis}</td>
                          <td className="px-3 py-2 tabular-nums text-muted-foreground">
                            {f.conEspectro}
                          </td>
                          <td className="px-3 py-2 tabular-nums text-muted-foreground">
                            {/* SIN EDAD NO SE ESCRIBE UN CERO: un cero aquí sería un recién nacido, y
                                "sin fecha de nacimiento" no es una edad de cero. Es la misma regla que
                                cerró "una fecha ilegible que se vuelve edad cero". */}
                            {f.edadMedia == null ? "—" : f.edadMedia.toFixed(1).replace(".", ",")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
        </div>
      </div>

       </>
      ) : null}

      {vista === "datos" ? (
       <>
      {/* ═══ LA PESTANA CERRADA: POR QUE NO HAY FILAS (2026-11-04) ═══

          Es la *Datos* de su CNVResearch, y esta cerrada. Lo que se muestra es exactamente la razon, que
          ya estaba calculada por `nivelDeAnonimizacion`: la vista lleva `patient_id` a proposito (es lo
          que permite el analisis longitudinal), asi que un export fila a fila seria SEUDONIMIZADO. */}
      <div className="rounded-xl border border-clinical-warning/40 bg-clinical-warning-bg p-4 text-sm">
        <p className="font-semibold text-foreground">Esta vista no se puede abrir todavía</p>
        <p className="mt-1 max-w-prose text-foreground">
          Las filas de esta cohorte no son anónimas: llevan la llave del paciente, que es lo que permite
          seguir a una misma persona a lo largo del tiempo. Mientras eso sea así, mostrarlas o entregarlas
          es tratar datos personales, y para eso hacen falta dos cosas que todavía no están: la
          verificación del k-anonimato <strong>fila a fila</strong> y la <strong>custodia de la llave</strong>{" "}
          fuera del entorno de análisis. Las dos son condición antes de la primera venta.
        </p>
        <p className="mt-2 max-w-prose text-xs text-muted-foreground">
          Lo que sí se puede llevar hoy está en <strong>Exportar</strong>: el resumen agregado, con las
          categorías de menos de cinco pacientes ya suprimidas.
        </p>
      </div>

      {/* ═══ QUE NIVEL SALDRIA SI HOY SE GENERARA UN DATASET DE ESTA COHORTE ═══

          Lo CALCULA la misma función que rotularía el dataset (`nivelDeAnonimizacion`), no un texto
          escrito a mano: si mañana la vista deja de llevar `patient_id`, esta frase cambia sola. Y la
          respuesta de hoy es la que hay que saber antes de prometer un dataset: la vista lleva
          `patient_id` a propósito (es lo que permite el análisis longitudinal), así que un export fila a
          fila es SEUDONIMIZADO, no anónimo. */}
      <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
        <p className="font-semibold text-foreground">
          Un dataset fila a fila de esta cohorte saldría{" "}
          {ROTULO_DEL_NIVEL[nivelDelExport.nivel].toLowerCase()} ({nivelDelExport.nivel})
        </p>
        <p className="mt-1 max-w-prose text-muted-foreground">{nivelDelExport.porQue}</p>
        <p className="mt-1 max-w-prose text-xs text-muted-foreground">
          El nivel no se escribe: se deriva de lo que el archivo lleva. Para producir uno anonimizado hay
          que quitar la llave del paciente, generalizar los cuasi-identificadores y verificar el
          k-anonimato. <strong>El resumen de abajo ya lo cumple</strong> (sus categorías con menos de cinco
          pacientes se reúnen en una fila y el archivo dice cuántas suprimió); lo que falta, y es condición
          antes de la primera venta, es esa verificación <strong>fila a fila</strong> y la custodia de la
          llave de seudonimización.
        </p>
      </div>
       </>
      ) : null}

      {vista === "exportar" ? (
       <>
      {/* ═══ LA VISTA DE EXPORTAR ═══

          EL NIVEL SE REPITE AQUI, EN UNA LINEA, y no es redundancia: el principio que ya regia este
          bloque era *"ofrecer la descarga antes de decir que nivel tiene seria ofrecerla sin su
          etiqueta"*. Al partir la pagina en tres, la etiqueta se habria quedado en la otra pestana. Sale
          de la MISMA funcion, asi que no puede divergir de la de Datos. */}
      <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
        <p className="font-semibold text-foreground">
          Lo que se descarga es el resumen agregado de esta cohorte
        </p>
        <p className="mt-1 max-w-prose text-muted-foreground">
          No lleva filas de paciente. El dataset fila a fila sería{" "}
          {ROTULO_DEL_NIVEL[nivelDelExport.nivel].toLowerCase()} y por eso{" "}
          <a href="/obbia?vista=datos" className="underline underline-offset-4">
            esa vista está cerrada
          </a>
          .
        </p>
        {/* ═══ LO QUE SÍ SE PUEDE LLEVAR HOY, Y QUEDA REGISTRADO (Santiago, 2026-10-30) ═══

            VA AQUÍ, debajo del párrafo que explica por qué el dataset fila a fila no se puede, y no
            arriba junto a las cifras: el orden de lectura es "esto es lo que hay, esto es lo que no se
            puede, y esto es lo que sí". Ofrecer la descarga antes de decir qué nivel tiene sería
            ofrecerla sin su etiqueta.

            ES UN ENLACE NORMAL, no un botón con JavaScript: la descarga la resuelve el navegador, así
            que funciona igual en un teléfono y esta pantalla sigue siendo un Server Component sin una
            sola línea de cliente. Y la descarga QUEDA REGISTRADA (`research_datasets` más el asiento de
            auditoría), que es la mitad por la que esa tabla existía vacía. */}
        <a
          href="/obbia/cohorte/csv"
          className="mt-3 inline-flex items-center rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/40"
        >
          Descargar el resumen (CSV)
        </a>
        <p className="mt-1 max-w-prose text-xs text-muted-foreground">
          Lleva las cifras de esta pantalla y sus desgloses, no filas de paciente. Cada descarga queda
          registrada abajo con su alcance y su nivel: un archivo de investigación que sale sin rastro es
          lo que ese registro existe para impedir.
        </p>
      </div>

      <h2 className="text-sm font-semibold text-foreground">Datasets entregados</h2>
      {datasets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Todavía no se ha entregado ningún dataset. Las cifras de arriba son la cohorte disponible; un
          dataset es una entrega concreta, con su alcance y su nivel de anonimización registrados.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className={theadTr}>
                <th className={th}>Alcance</th>
                <th className={th}>Anonimización</th>
                <th className={th}>Estado</th>
                <th className={th}>Fecha de creación</th>
              </tr>
            </thead>
            <tbody>
              {datasets.map((d) => (
                <tr key={d.id} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2 font-medium text-foreground">{d.scope}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {ROTULO_DEL_NIVEL[d.anonymizationLevel as NivelDeAnonimizacion] ??
                      d.anonymizationLevel}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{d.status}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {fmt(d.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
       </>
      ) : null}
    </div>
  );
}
