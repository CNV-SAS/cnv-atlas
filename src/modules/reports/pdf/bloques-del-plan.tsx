import { Text, View } from "@react-pdf/renderer";

import type { PlanPaciente } from "../data/reports-view-types";
import { styles } from "./estilos-del-pdf";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LOS BLOQUES DEL PLAN DEL PACIENTE  ·  UNA SOLA COPIA DEL JSX, TRES SUPERFICIES
//
// ═══ POR QUE EXISTE ESTE ARCHIVO (2026-10-28) ═══
//
// Los siete bloques de la §7.1 de Gildardo salian por DOS canales (la hoja que se imprime desde pantalla y
// el informe en PDF), y `plan-paciente.test.ts` existe porque esos dos YA HABIAN DIVERGIDO en seis cosas,
// todas invisibles a los tests porque ninguno miraba las dos superficies a la vez.
//
// Ahora son TRES: el informe perdio cuatro bloques (pedido de una nutricionista) y el plan gano su propio
// PDF, que se adjunta al correo (pedido de Santiago, el mismo dia). Tres copias del mismo JSX es pedir la
// septima divergencia, asi que el JSX vive UNA vez y cada documento compone los bloques que le toquen.
//
// ═══ EL ORDEN NO LO DECIDE ESTE ARCHIVO ═══
//
// Cada documento compone en el orden de SU canal, y el candado compara los ordenes entre canales. Aqui solo
// esta el contenido de cada bloque, para que no pueda decir dos cosas distintas en dos papeles que el mismo
// paciente recibe el mismo dia.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

type ConPlan = { plan: PlanPaciente };

/** BLOQUE 1 · la meta y los objetivos. Fuera del informe desde el 2026-10-28; va en el plan. */
export function BloqueMeta({ plan }: ConPlan) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Tu meta</Text>
      {plan.objetivoTexto ? <Text style={styles.para}>{plan.objetivoTexto}</Text> : null}
      {plan.pesoMeta != null ? (
        <Text style={styles.para}>Peso que acordaste con tu profesional: {plan.pesoMeta} kg.</Text>
      ) : null}
      {plan.kcalObjetivo != null ? (
        <Text style={styles.para}>Tu plan es de {plan.kcalObjetivo} calorías al día.</Text>
      ) : null}
    </View>
  );
}

/** BLOQUE 2 · el plan dietetico: el tipo de dieta, la prescripcion por macro y las notas del modelo. */
export function BloqueAlimentacion({ plan }: ConPlan) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Tu plan de alimentación</Text>
      {plan.tipoDieta ? (
        <Text style={styles.para}>
          <Text style={styles.bold}>Dieta {plan.tipoDieta.toLowerCase()}</Text>
          {plan.kcalObjetivo != null ? ` de ${plan.kcalObjetivo} kcal al día.` : "."}
        </Text>
      ) : null}
      {plan.prescripcion.map((f) => (
        <Text key={f.nombre} style={styles.para}>
          {f.nombre}: {f.valor}
        </Text>
      ))}
      {plan.atributos.length ? <Text style={styles.para}>{plan.atributos.join(" · ")}</Text> : null}
      {plan.notasDelModelo.map((n) => (
        <Text key={n} style={styles.para}>
          {n}
        </Text>
      ))}
    </View>
  );
}

/**
 * LO QUE NO PUEDE COMER. Su §7.1 no nombra este bloque; va declarado, con su razon: un plan sin las
 * restricciones es un plan que el paciente no puede seguir, porque el menu que recibe puede contradecirlas.
 *
 * VA ANTES DEL MENU en los dos canales, y el orden importa: el paciente lee el menu para saber que comer, y
 * tiene que llegar sabiendo que evitar.
 */
export function BloqueEvitar({ plan }: ConPlan) {
  if (!plan.restricciones.length) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Lo que debes evitar</Text>
      {plan.restricciones.map((r) => (
        <Text key={r} style={styles.para}>
          {r}
        </Text>
      ))}
    </View>
  );
}

/** BLOQUE 5 · la distribucion por porciones. Fuera del informe desde el 2026-10-28; va en el plan. */
export function BloqueDistribucion({ plan }: ConPlan) {
  if (!plan.distribucion.length) return null;
  return (
    <View style={styles.section} break>
      <Text style={styles.sectionTitle}>Cómo repartir tus porciones en el día</Text>
      <Text style={styles.para}>Comidas de tu día: {plan.tiemposActivos.join(", ")}.</Text>
      {plan.distribucion.map((f) => (
        <View key={f.alimento} style={styles.tableRow}>
          <Text style={styles.cellLabel}>{f.alimento}</Text>
          <Text style={styles.cellValue}>
            {f.porTiempo.map((t) => `${t.tiempo} ${t.porciones}`).join(" · ")}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * BLOQUE 6 · las recomendaciones que aplican a su caso, bajo UN encabezado que las agrupa.
 *
 * El encabezado es la unica alineacion en esta direccion (2026-09-04): cada recomendacion era su propia
 * seccion de primer nivel, asi que "Alimentacion saludable general" quedaba al mismo rango que "Tu meta" y
 * sin decir de que es. La hoja impresa si las agrupaba, y esa es la mejor de las dos.
 */
export function BloqueRecomendaciones({ plan }: ConPlan) {
  if (!plan.recomendaciones.length) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Recomendaciones para tu caso</Text>
      {plan.recomendaciones.map((r) => (
        <View key={r.titulo}>
          <Text style={styles.bold}>{r.titulo}</Text>
          {r.lineas.map((l) => (
            <Text key={l} style={styles.para}>
              {l}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

/**
 * BLOQUE 7 · la lista de intercambio recortada por region.
 *
 * `break`: su archivo la imprime en su propia pagina, y aqui importa mas, porque es la hoja que el paciente
 * lleva al mercado.
 */
export function BloqueIntercambio({ plan }: ConPlan) {
  return (
    <View style={styles.section} break>
      <Text style={styles.sectionTitle}>Tu lista de intercambio</Text>
      <Text style={styles.para}>
        Los alimentos de un mismo grupo aportan aproximadamente lo mismo por porción, así que puedes
        intercambiarlos libremente. Sigue las porciones que te indicó tu nutricionista para cada grupo y
        elige entre los alimentos de la lista, variando cada día para lograr una alimentación completa y
        diversa. La cantidad entre paréntesis es el tamaño de una porción de intercambio.
      </Text>
      <Text style={styles.para}>
        {plan.listaIntercambio.region
          ? `Preparada para ${plan.listaIntercambio.ciudad}, región ${plan.listaIntercambio.region}: ${plan.listaIntercambio.total} alimentos de los ${plan.listaIntercambio.deTotal}.`
          : `Lista completa: ${plan.listaIntercambio.deTotal} alimentos.`}
      </Text>
      {plan.listaIntercambio.grupos.map((g) => (
        <View key={g.nombre} style={styles.diaMenu}>
          <Text style={styles.bold}>{g.nombre}</Text>
          {g.subgrupos.map((s) => (
            <Text key={s.sub} style={styles.para}>
              {s.sub}: {s.alimentos.join(", ")}
              {s.hayMas ? ", entre otros" : ""}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

/** BLOQUE 4 · el ejemplo de menu para una semana, con su advertencia de que es un ejemplo. */
export function BloqueMenu({ plan }: ConPlan) {
  if (!plan.menu.length) return null;
  return (
    <View style={styles.section} break>
      <Text style={styles.sectionTitle}>Ejemplo de menú para una semana</Text>
      <Text style={styles.para}>
        Es un ejemplo, no una obligación: puedes cambiar preparaciones por otras equivalentes.
      </Text>
      {plan.menu.map((d) => (
        <View key={d.dia} style={styles.diaMenu}>
          <Text style={styles.bold}>{d.dia}</Text>
          {d.comidas.map((c) => (
            <Text key={c.tiempo} style={styles.para}>
              {c.tiempo}: {c.texto}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}
