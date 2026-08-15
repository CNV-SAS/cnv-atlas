# Smoke de contenido: Diagnóstico completo (antes del rediseño)

**Para:** Santiago. **Fecha:** 2026-08-15.
**Objetivo:** verificar el CONTENIDO de Diagnóstico contra las capturas del HTML de Gildardo, ANTES de que el diseño gráfico cambie la forma. Si algo está mal y se descubre después del rediseño, no se podrá saber si fue el contenido o la forma.

**Qué mirar:** si FALTA algo o SOBRA algo respecto al HTML. NO la forma (colores, espaciado, tamaños): eso cambia a propósito en el diseño. Ten las capturas del HTML al lado.

**Requisito:** una evaluación con diagnóstico emitido (medición BIS + encuesta completa). Usa una de las demo o haz un intake completo.

---

## 1. Subpestaña "Diagnóstico Funcional" (la que abre por defecto)

- [ ] La **franja de veredicto** arriba: estado EFR, riesgo integrado, ruta prioritaria. ¿Coinciden con el HTML?
- [ ] **Los 5 dominios del DFI** (Celular-Eléctrico, Metabólico-Estructural, Envejecimiento, Conductual-Perceptual, Epigenético-Contextual): cada uno con su severidad (Bajo/Leve/Moderado/Alto), su lectura y sus items. ¿Están los cinco, en ese orden, con los mismos datos que el HTML?
- [ ] **Riesgo integrado** (BAJO/MEDIO/ALTO/CRÍTICO + descripción + score 0-100).
- [ ] **Radar** de 5 dominios (4 niveles). El color y el sombreado/sólido cambian en el diseño; aquí solo mira que los cinco ejes y sus niveles sean los del HTML.
- [ ] **Diana de 81 estados** + botón "Explorar otros estados": el estado del paciente y, al explorar, el detalle del estado seleccionado (mecanismo, biomarcadores, riesgos, nutracéuticos). ¿Faltan campos respecto al HTML?
- [ ] **Read-out D2-D8** (las respuestas de la encuesta por dominio, en texto).
- [ ] **Criterio del profesional** con el botón "Generar borrador con IA" y el campo grande.
- [ ] **Confirmar diagnóstico** (y corregir, si aplica).

## 2. Subpestaña "Composición Corporal"

- [ ] **Clasificación antropométrica** (IMC, cintura, índice cintura-talla) con su clasificación OMS.
- [ ] **Tabla de Wang** con TODAS las filas nuevas. Revisa nivel por nivel contra el HTML:
  - Nivel V: Peso, Estatura, IMC, Cintura, **Cadera** (nueva), GEB, GET.
  - Nivel IV: Masa grasa (kg y %), **MG hidratación constante** (nueva), MLG, MME-SMM, MMEM, FFMI.
  - Nivel III: MCA, sólidos EC, masa seca, AEC/MCA, AEC/AIC con grasa (L). Y el desplegable **"Ver desglose de agua (con/sin grasa, L y %)"**: ábrelo y verifica las seis variantes.
  - Nivel II: ACT, **FFW** (nueva), hidratación sin grasa, proteínas, minerales.
  - Bioeléctrico: ángulo de fase, y el desplegable **"Ver parámetros bioeléctricos crudos"**: ábrelo y verifica Re, Ri, R∞, C, Fo + impedancias (R50, reactancia, Z5, Z50, Z200).
- [ ] Los **desplegables** abren y cierran, y **siguen abiertos si vas a Funcional y vuelves** (viven en la URL).
- [ ] **Dos decimales** en los valores; los enteros NO muestran ".00".
- [ ] Columna **Δ** y columna **Diagnóstico** (badges).

## 3. Subpestaña "Diagnóstico Encuesta"

- [ ] Read-out D1-D8 completo (todas las respuestas de la encuesta).

## 4. El veto conductual (si hay un caso que lo active)

El veto se activa cuando el paciente reporta un **método de control de peso de riesgo** (purgas, laxantes, diuréticos, ayuno prolongado) en la sección de conducta alimentaria (D2). No pude confirmar que las demo actuales lo disparen; **si ninguna lo muestra, no es un bug.** Para verlo, haz un intake donde en esa pregunta se marque un método de riesgo. Entonces debe aparecer:
- [ ] En el header del DFI, el banner: *"Alerta conductual activa: la prioridad es el abordaje psicológico. Queda excluida toda intervención nutricional restrictiva."*
- [ ] En la tarjeta del dominio Conductual-Perceptual, el mensaje: *"Veto conductual: no iniciar intervención nutricional restrictiva."*

---

## Cómo reportar

Por cada pantalla, una de tres: "coincide", "FALTA X" (algo del HTML que no está), "SOBRA X" (algo que está y no debería). No reportes la forma. Con eso ajustamos el contenido antes de entrar al diseño.
