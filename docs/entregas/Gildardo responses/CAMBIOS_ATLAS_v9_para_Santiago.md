# ATLAS v9 — Cambios respecto de v8

**Archivo:** `ATLAS_v9.html` · **Base:** `ATLAS_v8.html` (sin modificar) · **Fecha:** 21 de septiembre de 2026

Son **cuatro cambios y ninguno más**. No se tocó ningún cálculo, ninguna fórmula, ningún
umbral clínico, ningún flujo de guardado ni ningún otro módulo. El diff completo contra v8
cabe en las cuatro secciones de abajo.

---

## Resumen

| # | Módulo | Qué se pidió | Qué se hizo |
|---|---|---|---|
| 1 | Diagnóstico › Encuesta | Los resultados en colores, igual que D1 | D2–D8 muestran la respuesta en una pastilla de color |
| 2 | Antropometría & BIS · Diagnóstico › Composición corporal | Subtítulos por nivel en azul rey | Las cuatro bandas de nivel de Wang pasan a `#4169E1` |
| 3 | Antropometría & BIS | Garantizar que en línea aparezcan cintura y cadera | Se re-siembran al llegar el paciente y la tabla tiene respaldo de cuatro fuentes |
| 4 | Rutas de tratamiento | Que aparezcan los otros nutracéuticos | "Otros productos" pasa a ser sección propia, ya no depende del BIS |

---

## 1 · Encuesta D2–D8 en colores

**Antes.** D1 ya pintaba cada grupo de alimentos en verde / ámbar / rojo. De D2 a D8 las
respuestas salían todas en negro, así que había que leerlas una por una para encontrar lo
que merecía atención.

**Ahora.** Cada respuesta de D2 a D8 se muestra dentro de una pastilla de color, con los
mismos cuatro colores que ya usaba D1:

- verde `#059669` — adecuado
- ámbar `#d97706` — vigilar
- rojo `#dc2626` — atención
- gris pizarra `#64748b` — registrado, sin clasificar
- gris claro `#94a3b8` — sin dato

**Punto importante: no se inventó ningún punto de corte.** Cada regla sale de algo que el
archivo ya usaba:

- **LE8 (`calcLE8`)** — actividad física (minutos/semana: ≥150 · >0 · 0), horas de sueño
  (7–8 h · 6–7 h y 5–6 h · resto), tabaco (nunca y dejó ≥5 años · dejó <5 años y exposición
  pasiva · resto) e hipertensión declarada.
- **Los avisos del motor y la redacción automática del diagnóstico** — pérdida de control al
  comer (`Frecuentemente`/`Siempre` es la alerta; `A veces` ya entraba como episodios),
  estrés (≤3 bajo · 4–6 moderado · ≥7 elevado), orina oscura.
- **La propia encuesta** — las conductas de riesgo de la pregunta 21 (laxantes, vómito,
  ejercicio excesivo) son exactamente las que la encuesta ya marca con `warn` al responderla.
- **El orden que declaran las opciones** — escalas como `Muy mala … Muy buena` o
  `Nunca … Siempre`, donde la dirección la dice el propio texto de la respuesta.

**Lo que queda en gris pizarra** es deliberado: percepción corporal, satisfacción con el
peso, número de comidas al día, patrón alimentario, suplementos, medicamentos, lactancia,
quién prepara los alimentos y el bloque sociodemográfico. Gris **no** significa "normal":
significa que ATLAS registra el dato pero no emite juicio sobre él. Si la Dirección
Científica quiere que alguno de estos deje de ser informativo, hace falta primero el
criterio; no se puso uno por defecto.

**Dónde está en el código.** Un clasificador `_encClf(campo, valor)` y una fila `DimRowC`,
ambos dentro de `ModDiagnostico`, justo antes de la `DimRow` de siempre. `DimRow` sigue
existiendo y sigue usándose para el bloque sociodemográfico.

---

## 2 · Subtítulos por nivel en azul rey

Las bandas de nivel de Wang tenían **un color distinto en cada nivel y, además, colores
distintos entre los dos módulos**. Ahora las cuatro van en el mismo azul rey:

| Banda | Antes | Ahora |
|---|---|---|
| NIVEL V — CUERPO ENTERO | `#374151` gris | `#4169E1` |
| NIVEL IV — TEJIDOS Y SISTEMAS | `#1e3a5f` azul marino | `#4169E1` |
| NIVEL III — CELULAR | `#14532d` verde oscuro | `#4169E1` |
| NIVEL II — MOLECULAR | `#0f3460` azul petróleo | `#4169E1` |

Aplica en los dos sitios que se pidieron: **Antropometría & BIS** (tabla "Composición
Corporal — Niveles de Wang") y **Diagnóstico › Composición corporal**.

Dos notas:

- `#4169E1` es el azul rey (*royal blue*) estándar. Sobre texto blanco en negrita da un
  contraste de 4,8:1, por encima del mínimo AA (4,5:1), así que la banda se sigue leyendo
  bien en pantalla e impresa.
- La banda **"ÍNDICES BIOELÉCTRICOS INTEGRADOS · ANI BIS-E" no cambia**: conserva su morado
  `#5b21b6`. No es un nivel de Wang sino un bloque de índices compuestos, y el color
  distinto es justamente lo que lo separa de los cuatro niveles. Si se quiere que también
  pase a azul rey, es un cambio de una línea.

El color está en una sola constante, `AZUL_REY_NIVEL`, cerca de las constantes de la
encuesta. Cambiarla mueve las ocho bandas a la vez.

---

## 3 · Cintura y cadera en Antropometría (versión en línea)

**El problema.** Los dos campos funcionaban en el equipo local y no en línea. La causa:
`useState(inicializador)` corre **una sola vez, al montar el módulo**. En local el paciente
ya está en memoria cuando se abre Antropometría, pero **en línea el registro llega desde
Supabase después del montaje**: el estado inicial se calculaba con el paciente todavía
vacío, y cintura y cadera se quedaban en blanco aunque el registro las trajera.

**La corrección.** Dos piezas:

1. **Re-siembra al llegar el paciente.** Un efecto que se dispara cuando cambia el documento
   del paciente y vuelve a leer peso, estatura, cintura, cadera y fuerza prensil. **Solo
   rellena lo que esté vacío**: nunca pisa lo que el profesional acabe de teclear, y nunca
   arrastra el valor de otro paciente.
2. **Respaldo de cuatro fuentes en la tabla.** Las filas de Cintura y Cadera de la tabla de
   Wang ahora consultan, en este orden: lo tecleado en el módulo → el Excel del Biodymanager
   → el registro del paciente → lo guardado a mano en ese equipo. Es la misma cadena que ya
   usaban Diagnóstico y el Reporte, así que los tres módulos muestran por fin el mismo
   número. Se aplica `atlasCirc`, que descarta un ratio colado en el campo (cualquier valor
   de 20 cm o menos), y si ninguna fuente la trae se pinta el guion, no un cero.

Los campos de captura no se movieron ni se renombraron: siguen siendo los mismos de v8.

---

## 4 · Otros nutracéuticos en Rutas de tratamiento

**Por qué no aparecían.** Hasta v8, "OTROS PRODUCTOS" era un bloque **dentro** de la
SECCIÓN 2 (VITACELLEBIS). Esa sección entera se dibuja con la condición
`tabTrat === "tratamiento" && hasBis`, y `hasBis` exige un IFC mayor que cero. Con la
consulta abierta antes de cargar el BIS, la sección no se dibujaba **y se llevaba consigo
los productos externos** — que son precisamente los que **no** dependen del diagnóstico: no
salen de un sector EFyR ni de un índice alterado, los ofrece el profesional por criterio
clínico.

**Ahora.** "OTROS PRODUCTOS" es una **sección propia**, visible siempre que se esté en
"Rutas de atención derivadas del DFI", con BIS o sin él. Queda justo debajo de la SECCIÓN 2
y antes de la SECCIÓN 3 — REMISIONES, en el mismo sitio donde estaba, pero ya sin depender
de ella.

**No cambia nada del despacho.** Sigue compartiendo estado (`nutrSelecTrat`,
`nutrCantidades`) y el mismo `registrarEnvio` que los VITACELLEBIS, así que el registro, el
inventario, las comisiones y la historia clínica se comportan exactamente igual. El único
ajuste: el botón propio de la sección aparece cuando **no hay BIS** o cuando no hay
VITACELLEBIS indicados (antes solo en el segundo caso), porque en el primero el botón de la
SECCIÓN 2 ni siquiera está en pantalla.

Para añadir un producto nuevo se sigue haciendo lo mismo de siempre: agregarlo a la lista
`OTROS_PRODUCTOS`. Con `disponible: false` se retira de la pantalla sin perder la ficha.
Hoy la lista tiene un solo producto, LUVIA.

---

## Verificación hecha

- Los dos bloques de script de `ATLAS_v9.html` compilan sin errores de sintaxis.
- El diff contra `ATLAS_v8.html` se revisó línea por línea: solo contiene los cuatro
  cambios de arriba. No hay renombres, ni reordenamientos, ni limpiezas de paso.
- `ATLAS_v8.html` queda intacto como respaldo.

## Lo que falta probar en el navegador

Esto no se puede comprobar leyendo el código; conviene verlo con un paciente real antes de
publicar:

1. **Encuesta D2–D8** — abrir un paciente con la encuesta completa y recorrer las ocho
   pestañas: que cada respuesta salga en su pastilla y que ninguna quede en blanco.
2. **Cintura y cadera en línea** — abrir una consulta **desde la versión publicada** (no el
   archivo local), entrar directo a Antropometría y confirmar que los dos valores ya están
   ahí sin teclearlos. Este es el punto que motivó el cambio 3 y es el único que solo se
   puede validar en línea.
3. **Otros productos** — entrar a Rutas de tratamiento **antes** de cargar el BIS y
   confirmar que la sección aparece; luego cargar el BIS y confirmar que sigue apareciendo y
   que el despacho registra igual.
4. **Azul rey** — mirar la tabla de Wang en los dos módulos y confirmar que las cuatro
   bandas se ven iguales entre sí y entre módulos.
