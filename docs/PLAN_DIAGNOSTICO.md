# PLAN_DIAGNOSTICO.md — orden de cierre de la etapa Diagnóstico

Work-order de la etapa Diagnóstico (ciclo "cerrar etapa por etapa" de Santiago: clínico -> estructura -> cotejo con HTML al día -> comparación de cálculos -> diseño -> cerrada). Empezamos por Diagnóstico. El estado de gates lo sigue `LANZAMIENTO.md`; esto es la lista de trabajo de la etapa, no estado de gate.

Capturas de los dos lados: `docs/entregas/cotejo-visual/{html,atlas-web}/diagnostico/`.

## Orden (2026-08-13)

### a) Los dos ajustes del cotejo visual
1. **Radar: recuperar la paleta con ancla óptima.** Hoy `dfi-radar.tsx` usa `BAND_FILL=[optimal,optimal,warning,critical]` -> sev0 y sev1 comparten verde; sin azul, lo mejor ya es verde y de ahí solo empeora ("todo se lee como advertencia"). Los colores son NUESTROS (tokens BRAND `--clinical-*` en `globals.css`), no de Gildardo: él decidió las 4 bandas y sus nombres (Bajo/Leve/Moderado/Alto), no los colores. **Propuesta:** mapa 1:1 Bajo->azul (ancla "estás bien"), Leve->verde, Moderado->ámbar, Alto->rojo; se retira el blanco "Excepcional" (ya era inalcanzable y está eliminado del vocabulario). Requiere AGREGAR un token BRAND azul (`--clinical-excellent` + `-bg`); es decisión de diseño (confirmar con Santiago) pero nada clínico la impide. Efecto colateral aceptado: las bandas del radar dejan de espejar el agrupamiento de 3 colores del modelo de riesgo integrado (son ejes distintos; el polígono de datos sigue coloreado por riesgo integrado).
2. **D2-D8: solo lo respondido, en texto plano.** El de Gildardo muestra pregunta (izquierda) + respuesta (derecha, negrita), limpio. El nuestro reusa `SurveyAnswerReadonly`, que pinta TODAS las opciones del catálogo (las no elegidas en `opacity-50`): mucho espacio, poca info, en una pantalla ya larga. **Propuesta sin duplicar presentación:** agregar `variant?: "chips" | "plain"` a `SurveyAnswerReadonly` (default "chips"). La lógica que importa (interpretar la respuesta, el texto libre de "Otra" via `parseMulti`/`splitOther`) queda en UN solo lugar; solo se bifurca el render final. `variant="plain"` imprime solo los valores elegidos como texto (multi unido por comas, "Otra: texto" incluido). `DomainReadout` (Diagnóstico) pasa `variant="plain"` y usa fila pregunta-izquierda/respuesta-derecha como el suyo. Evaluación sigue con chips (ahí el profesional REVISA y ver las no marcadas ayuda). Cotejar de paso el rótulo D2 (suyo "Imagen Corporal y Conducta Alimentaria" vs nuestro "Percepción Corporal").

### b) Subpestañas de Diagnóstico
Con D2-D8 dentro, la pantalla es larga; las subpestañas pasan de conveniente a necesaria. Portar la navegación por subpestañas del v8 (Diagnóstico Encuesta D1-D8 / Composición Corporal / Diagnóstico Funcional / Resumen del Diagnóstico). Hoy son colapsables (divergencia deliberada previa, `DIVERGENCIAS.md`); se revisa esa decisión aquí.

### c) Las cuatro de categoría 2
(Decisiones ya tomadas; construir.)
1. **Índices en tabla aparte** + nota de anclaje (no mezclados con los indicadores primarios).
2. **Cortes de referencia inline** para el indicador representativo de cada dominio.
3. **Ruta prioritaria como puntero:** "Ruta N prioritaria: ver en Tratamiento" (no se duplica la ruta en Diagnóstico).
4. **Diagnóstico integrado por IA en el Reporte** con enlace desde Diagnóstico.

### d) Botón de IA en "Criterio del profesional"
APROBADO, NO construido (registrado aquí 2026-08-13, a petición de Santiago). "Recomendación con IA" reusa el mismo pipeline de IA que el menú (`resolveAiConfig` + `generateText`); no agrega un segundo punto de integración con Groq. Barrera PII estructural igual que el menú: solo variables clínicas seudonimizadas al prompt. Prompt nuevo -> versionado en `modules/*/ai/prompts/` (regla dura 9), su propia `promptKey`.

### e) Cotejo de números (PRIORITARIO)
El que nunca se pudo hacer: mismo paciente, mismo archivo, los dos lados (HTML de Gildardo vs Atlas). Santiago preparó el caso (export Biody_BIS masculino; edad 22, masculino, peso 80,4, estatura 177, cintura 84, cadera 106). **Si el motor diverge del suyo en algo, es lo más importante que puede salir de toda la etapa.** Se hace en cuanto Santiago genere y capture los dos lados; no espera a a-d.
