import fs from "node:fs";
const P = "docs/entregas/RONDA_GILDARDO_2026-08-28.md";
let s = fs.readFileSync(P, "utf8");
const bloque = `---

# 2 · El "Meta kg" de tu tabla: no lo portamos, y queremos que lo sepas

Es una **divergencia visible**: tu archivo lo tiene y Atlas no va a tenerlo, así que preferimos
decírtelo antes de que lo notes.

## Qué es

En tu tabla de composición, la fila de **Peso** no tiene la referencia vacía: tiene un campo **"Meta
kg"** que el profesional escribe. En Atlas esa celda queda en blanco.

## Por qué no lo portamos

**Porque en Atlas el peso meta ya tiene una fuente, y sería una segunda.**

En tu archivo ese campo tiene todo el sentido: allí **todo el bloque de datos es editable y no hay
motor que lo calcule**, así que alguien tiene que escribirlo. En Atlas no es así:

- El peso meta lo **calcula tu propio `motorProtocolo`** a partir del peso, el IMC, el peso ideal y las
  comorbilidades (IRC y cáncer usan el peso actual; el resto, el ajustado).
- Y el nutricionista **puede sobrescribirlo** en el tratamiento, donde ese ajuste entra a toda la
  cadena calórica.

Si además lo dejáramos escribir en la pantalla de entrada, habría **dos pesos meta**: el que se escribió
antes del diagnóstico y el que el motor calcula después. **Es exactamente el problema de los dos
objetivos calóricos que tú mismo nos hiciste colapsar** en su momento ("el objetivo ya no es un input
manual: sale de la cadena"). No queremos repetirlo con el peso.

Y hay un obstáculo práctico encima: el ajuste del profesional vive en el tratamiento, que **no existe
todavía** cuando se está mirando esa pantalla.

> **Pregunta 2.** ¿Estás de acuerdo con dejarlo solo en el tratamiento, donde ya se puede ajustar? ¿O
> hay una razón clínica para que el profesional pueda fijar el peso meta **desde la entrada**, antes de
> generar el diagnóstico? Si es lo segundo, lo construimos, pero entonces ese campo tiene que SER el
> mismo ajuste del tratamiento y no otro dato.

---

# 3 · Y una pieza tuya que sí portamos, para que sepas que está

Tu bloque de **"Datos Personales"** con las medidas editables, y tu nota:

> *"Peso, estatura, cintura y cadera son editables (si faltan en el archivo o llegaron mal). Los índices
> IMC, ICC, ICT, ASMI y las clasificaciones de AF/FFMI/FMI se recalculan automáticamente al editar."*

**No lo teníamos**, y hacía falta: si el archivo del equipo traía la cintura mal, la única salida era
cerrar la evaluación y rehacerla entera. Para un dígito, desproporcionado.

Tres diferencias con el tuyo, todas deliberadas:

1. **Solo antes del diagnóstico.** Después, la medición queda sellada y el camino es corregir la
   evaluación, que genera una versión nueva. Cambiar una medida sobre la que ya se emitió un
   diagnóstico no es editar: es corregir, y tiene que quedar constancia de las dos versiones.
2. **La fuerza prensil no está ahí**, aunque tu bloque la tenga: en Atlas ya se captura en las
   condiciones del BIS, y dos sitios para el mismo dato es peor que uno.
3. **Se ve cuál valor es cuál.** Si se corrige la cintura, la pantalla dice "el equipo midió 84". El
   dato del aparato no se pierde ni se disimula.

No necesitamos nada tuyo aquí: te lo contamos porque es tu pieza y quedó distinta.

`;
s = s.replace("---\n\n© Connected Nutrition Ventures SAS, 2026.", bloque + "---\n\n© Connected Nutrition Ventures SAS, 2026.");
s = s.replace("Una sola pregunta, y es sobre una instrucción tuya que **no estamos cuestionando**: lo que cambió es la\npremisa sobre la que la diste.",
  "Dos preguntas y un aviso. La primera es sobre una instrucción tuya que **no estamos cuestionando**: lo\nque cambió es la premisa sobre la que la diste. La segunda es una divergencia con tu archivo que\npreferimos contarte antes de que la notes.");
fs.writeFileSync(P, s);
console.log("em-dash:", (s.match(/\u2014/g) || []).length, "· preguntas:", [...s.matchAll(/\*\*Pregunta (\d)\.\*\*/g)].map(m=>m[1]).join(" "));
