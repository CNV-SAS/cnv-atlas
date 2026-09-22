import promptV10 from "./criterion.system.v10.json";

// Texto CANONICO de las instrucciones de sistema del borrador de criterio (criterio.generate v1). La
// fuente unica es el JSON committeado: lo importa el builder (via este modulo) y el seed lo lee por fs
// (el seed no puede importar TS con alias @/). El admin lo edita creando versiones nuevas en BD desde
// /admin/ia; desde la v1 sembrada, la BD manda.
//
// Diseño (aprobado 2026-08-14): el texto NO diagnostica (el motor ya lo hizo, es inmutable); INTERPRETA
// la evidencia en prosa para que el profesional PARTA de ahi y escriba SU criterio. Abre en "los
// indicadores son compatibles con...", NO en "el paciente presenta...", que se leeria como re-diagnostico.
//
// BARRERA PII (regla dura 15): esto es SOLO el bloque de instrucciones. El mensaje de usuario con las
// variables clinicas se arma en codigo (criterion.v1.ts) y NO es editable, para que sea imposible por
// construccion inyectar PII al LLM desde la edicion del prompt.
// V2 (2026-09-01): se le anade un BLOQUE DE FORMATO, por su §8. El modelo que usamos (gpt-oss) escribe
// en markdown por defecto, y el criterio se pinta como texto PLANO: los asteriscos se ven crudos.
//
// LA V1 SE CONSERVA en su JSON y no se toca: los borradores ya generados se hicieron con ella, y un
// prompt versionado que se edita en su sitio borra con que se genero cada texto. Es la misma disciplina
// que las versiones de motor.
//
// V3 (2026-09-08): PORTE DE SU SYSPROMPT (punto 8 de su cotejo). Su instruccion gobierna el alcance:
// "todo lo del prompt completo que tiene el html... pero NO enviar el nombre". Entra la estructura
// obligatoria de los cinco dominios del DFI, sus reglas de los parametros propios (cortes por sexo,
// direccion de la PABU frente a phi, el IFC prevalece sobre el angulo de fase) y su bloque de formato.
//
// Y ENTRA UNA REGLA QUE SU PROMPT NO LLEVA: la prohibicion explicita de nombrar un resultado de
// laboratorio. No es ciencia nuestra: es la IMPLEMENTACION DE SU PUNTO 9 ("eso no se puede poner porque
// nos pone en riesgo, sin haber hecho pruebas de laboratorio"). Su prompt no la necesita porque el suyo
// no manda el campo `bio`; el nuestro manda diagnosticos y medicamentos en texto, asi que si. Va
// declarada en PENDIENTES_CIENTIFICOS.
//
// LA v2 NO SE RETIRA: los borradores generados entre el 2026-09-01 y hoy se hicieron con ella y su
// registro de procedencia apunta a esa version. Misma disciplina que las versiones de motor.
//
// V4 (2026-09-10): LAS ALERTAS CLINICAS ENTRAN AL RESUMEN. Instruccion de Gildardo: que el resumen de IA
// las mencione en el parrafo INMEDIATO despues de la presentacion del paciente. Entra un paso 2 en la
// estructura obligatoria (los dominios pasan a 3 y el cierre a 4) y dos reglas que lo acotan.
//
// LO QUE VIAJA SON NIVEL, TITULO Y DOMINIO, NO EL TEXTO DE LA ALERTA, y esa parte es decision nuestra: los
// textos de sus reglas llevan la CONDUCTA dentro ("Derivacion urgente a psicologia/psiquiatria"), y este
// mismo prompt le prohibe prescribir. Mandarle la instruccion e impedirle repetirla es pedir dos cosas
// contrarias; mandarle el hallazgo y prohibirle la conducta, no. Por eso ademas se le dice explicitamente
// que no indique que hacer con una alerta.
//
// Y SE LE PROHIBE INVENTARLAS. Los datos crudos que ya viajaban (item 21, diagnosticos, azucares, agua,
// estres) son los MISMOS insumos de sus reglas, asi que el modelo podria "deducir" una alerta que la regla
// no emitio. Las alertas son un hallazgo del motor, no una conclusion suya.
//
// LA V3 NO SE RETIRA: los borradores generados con ella apuntan a esa version en su procedencia.
//
// Y ESTE ES SOLO UNO DE LOS DOS LADOS. El otro es el filtro de salida (`limpiarMarcadores`), y hacen
// falta los dos: un prompt baja la frecuencia con la que el modelo mete markdown, no la lleva a cero.
// Textual suyo: "por si el modelo desobedece, que es lo que hacen".
// V5 (2026-09-21): LAS RESPUESTAS EN ROJO ENTRAN AL PARRAFO DE ALERTAS (observacion g). Su ATLAS_v9
// clasifico cada respuesta de D2-D8 en colores; Gildardo pidio que las ROJAS vayan en el segundo parrafo,
// junto a las alertas de sus reglas. Dos reglas nuevas las acotan: solo las que se le dan (el modelo no
// marca en rojo por su cuenta) y sin nivel (una respuesta en rojo no es una alerta critica). El ambar y la
// composicion NO entran (decidido con Santiago): la fuente es `clinical-engine/alertas-de-la-consulta`,
// la misma que usa el SOAP.
//
// LA V4 NO SE RETIRA: los resumenes generados con ella apuntan a esa version en su procedencia.
// V6 (2026-09-21, la prueba de Santiago con un paciente cargado de alertas). Tres defectos de la v5:
//   1. INVENTABA CAUSAS ("falta de nutrientes esenciales", "deterioro celular"). Su estructura pide
//      conectar causas entre dominios, y eso se conserva; lo que faltaba es que cada causa y cada efecto
//      esten en los datos. La regla es nuestra, como la del laboratorio, y va declarada a Gildardo.
//   2. METIA EN ROJO LO QUE NO LO ESTABA ("medicamentos antihipertensivos", ambar en su clasificador, que
//      el modelo tomo de los datos crudos). Se le prohibe presentar como rojo lo que no esta en el bloque.
//   3. OMITIA respuestas en rojo (los siete sintomas digestivos). Ahora debe mencionarlas TODAS, y le
//      llegan agrupadas por dominio para que pueda nombrarlas asi.
// Y dos precisiones: la PABU por debajo de phi (la leyo como "sobrecarga estructural") y la concordancia.
//
// LA V5 NO SE RETIRA: los resumenes generados con ella apuntan a esa version.
//
// V7 (2026-09-21, segunda prueba de Santiago con el mismo paciente). La v6 arreglo lo grande (salieron los
// siete digestivos y no invento causas) y quedaron tres detalles: metio como rojo el consumo de D1 ("sal
// extra", "carnes rojas"), el cierre recomendo ("reducción de la exposición a la sal") y abrevio mal el
// IEHH. La lista roja pasa a ser CERRADA y sin D1; el cierre nombra rutas y prioridad, sin conductas; y los
// indices se nombran como vienen en el bloque de indicadores.
//
// LA V6 NO SE RETIRA, por la misma razon.
//
// V8 (2026-09-21, tercera prueba): EL PARRAFO DE ALERTAS LO ESCRIBE ATLAS. En las tres pruebas el modelo
// fallo algo en esa lista, y en las dos ultimas omitio la alerta critica de TCA: un prompt no garantiza
// "todas y solo esas". Se compone en `services/parrafo-de-alertas` y se inserta tras la apertura. El
// modelo sigue viendo las alertas para leerlas en su dominio. Y dos cosas mas: cita los datos de cada
// dominio (le llegaban y no los usaba; el HTML de Gildardo si) y recibe la direccion de la PABU resuelta.
//
// V9 (2026-09-22, prueba con Gemini y Groq): el cierre va en un parrafo de prosa (el suyo cierra asi, y el
// nuestro salia como lista suelta de rutas); se le prohibe anticipar consecuencias ("susceptibilidad futura")
// y se le pide releer antes de entregar; y la PABU le llega con su lectura resuelta, porque Gemini escribio
// "por exceso" y "deficit estructural" en la misma frase. LA V8 NO SE RETIRA.
//
// V10 (2026-09-22, cuarta prueba): EL CIERRE LO ESCRIBE ATLAS, como el parrafo de alertas (Gemini puso
// codigos y "para abordar" en las rutas), desde la narrativa del DFI. Y tres lecturas que ahora le llegan
// hechas: la composicion con su clasificacion (dijo que un IMC de 25,7 "roza el sobrepeso"), el ICEC con su
// escala (Groq leyo LE8 bajo como carga baja) y la PABU como frase (Gemini pego la cadena entre comillas).
// Se le prohibe recomendar ("requieren atencion"). LA V9 NO SE RETIRA.
export const CRITERION_SYSTEM_PROMPT: string = promptV10.system;
