# Empezar con las cifras limpias: propuesta

**Para Santiago, 2026-09-30. Aprobada, y la pieza 1 ya está construida.**

## Estado

| Pieza | Estado |
| --- | --- |
| 1. La fecha de arranque | **Hecha** (migración 0198). Falta correrla el día real: `docs/entregas/sql/FECHA_DE_ARRANQUE_2026-09-30.sql` |
| 2. `professional_profiles.is_test` con su barrido | Pendiente |

**El estado de la pieza 1 no se afirma, se comprueba:** `pnpm vitest run src/tests/fecha-de-arranque.test.ts`
(que el corte llegue a todos los lectores) y el caso "con fecha de arranque, lo anterior no cuenta en ningún
eje" de `src/tests/insights-de-la-compra-db.test.ts` (que sirva). Una afirmación "HECHO" envejece; un puntero
a un test que pasa, no.

---

## Las tres que pediste verificar

### a) No, marcarlo como de prueba NO basta. Hoy ni siquiera se puede.

`is_test` existe en **dos** tablas: `nutraceuticals` y `patients`. **No existe en `professional_profiles`.**
Así que hoy no hay forma de marcar a Profesional Demo, y las tarjetas no tienen por dónde excluirlo.

Eso también significa que lo que hicimos ayer (excluir productos de prueba de las cifras) **no alcanza a las
suyas**: sus ventas, sus comisiones y su inventario de productos reales cuentan como si fueran operación.

### b) Lo que arrastra

Medido en local, donde mis corridas de prueba lo inflaron mucho. **Lo que importa no son las cifras, es la
lista:**

| | Se puede borrar |
| --- | --- |
| Ventas y sus líneas | Sí, pero arrastran su contabilidad sellada |
| Filas de comisión (`professional_revenue`) | Sí |
| Liquidaciones | **Hoy tiene cero.** Si llega a tener una girada, no |
| Inventario y sus movimientos | **No.** Los movimientos son append-only por trigger: es el registro de custodia |
| Evaluaciones, diagnósticos, tratamientos | **No.** FK `restrict` y triggers de inmutabilidad |
| Pacientes asignados | La relación sí; los pacientes con diagnóstico confirmado, no |

### c) No se borra, y no es una opinión mía

**`CLAUDE.md`, regla 14: "Ninguna cuenta clínica se recicla. Offboarding = desactivar y reasignar."** Borrar un
profesional con historial clínico va contra la arquitectura, y además la base lo impide por tres caminos
distintos (los de arriba). **Excluir es el camino, y es el que la arquitectura ya eligió.**

---

## Lo que propongo: dos piezas, y la primera sola no alcanza

### 1. Una fecha de arranque, y las cifras cuentan desde ahí (construida)

Un valor en configuración (`fecha_de_arranque`) y **todo lo anterior queda fuera de las cifras**. En una línea
limpia **todo el pasado a la vez**: las ventas de los smokes, las de María Camila, las de Demo y las mías.

- **Cuesta poco:** una columna de configuración y el filtro en los lectores de agregados.
- **Es honesto:** la pantalla dice "cuenta desde el (fecha)", igual que la de insights dice su ventana.
- **No borra nada:** el historial queda entero y auditable; lo que cambia es qué se cuenta.

**Pero no alcanza sola**, y esta es la razón: **Profesional Demo va a seguir generando datos DESPUÉS del
arranque**, porque para eso existe. Una fecha limpia el pasado y no el futuro.

**Dos cosas que aparecieron al construirla y que no estaban en la propuesta:**

- **El corte no puede tocar lo que se le DEBE a alguien.** Una comisión anterior al arranque sigue siendo
  plata que hay que pagarle al Integrante, y la liquidación la tiene que seguir viendo entera. Así que la
  tarjeta de comisiones de Dirección y la liquidación **van a discrepar a propósito**, y la tarjeta lo dice
  ("lo anterior se sigue liquidando, no se pierde"). Sin esa línea, la diferencia se leería como un error de
  una de las dos pantallas.
- **El inventario no lleva corte.** Un saldo no es un flujo: las unidades están hoy en la bodega, las haya
  puesto ahí quien sea. Recortarlo por fecha daría un número que no es el de ninguna bodega. También se dice
  en la tarjeta.

### 2. Marcar al profesional, y que las cifras lo excluyan

`professional_profiles.is_test`, con el mismo trato que ya tienen los productos y los pacientes: **la lista lo
muestra marcado, la cifra no lo cuenta.**

- **Cuesta:** una migración de una columna, el filtro en los lectores de agregados (bruto, ingreso CNV,
  comisiones, inventario, insights) y un candado que compruebe que **todos** lo aplican. Ese candado no es
  opcional: es exactamente el barrido que faltó con la RLS y con `z.uuid()`, y aquí serían cinco lectores.
- **Y una decisión chica que viene con él:** si una venta de Demo no cuenta en el bruto, **tampoco debería
  facturarse en Alegra**. Hoy eso lo decide `patients.is_test`. Con el profesional marcado conviene que valga
  lo mismo: lo suyo no genera documento fiscal real.

### Lo que NO propongo

**Borrar sus datos.** Además de la regla 14, el intento fallaría a medias: las ventas se irían y los
movimientos de inventario no, así que su vitrina quedaría con saldo sin ventas que lo expliquen. **Un borrado
a medias es peor que no borrar**, porque deja el inventario mintiendo.

---

## Lo que haría yo, en orden

1. **La fecha de arranque primero**, el día que pongas las llaves reales. Es lo que da el corte limpio y no
   depende de marcar a nadie.
2. **La marca del profesional después**, con su candado de barrido. Se puede hacer con calma: mientras Demo
   sea el único que opera, la fecha ya lo cubre.

**Y una advertencia de la que ya nos mordió dos veces esta semana:** si se hace solo la marca y no el barrido,
va a quedar aplicada en tres lectores de cinco, y la diferencia va a aparecer como la de 1.903 contra 1.820.
El barrido es la mitad del trabajo, no un extra.

---

## Y tu lectura sobre Tratamiento: coincido, con una razón más

Verifiqué qué ofrece esa pantalla: **exactamente lo prescrito y `en_consultorio`**, y es un guard deliberado
("sin prescripción no hay nada que cobrar"). Tu lectura es la correcta: **si quiere venderle algo más, lo
prescribe primero y entonces ya está prescrito.** El desplegable de "prescribir un nutracéutico que el modelo
no recomendó" ya ofrece el catálogo entero, así que no hay nada fuera de alcance.

**Y una razón más para no tocarla:** ofrecer ahí el catálogo entero crearía **una segunda vía** para vender lo
no prescrito, que es justo el caso que la confirmación de /pagos acaba de cubrir. Dos caminos para la misma
excepción se separan con el tiempo, y entonces el dato depende de por dónde entró. **No la toco.**
