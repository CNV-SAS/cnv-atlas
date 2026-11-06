# PDF de informes de paciente en el historial de git (y en GitHub)

**Connected Nutrition Ventures · Atlas · 5 de noviembre de 2026**
**Estado:** ABIERTO. La limpieza del historial está preparada y no se ha ejecutado: la decide Santiago.
**Responsable de respuesta:** Santiago (SECURITY.md, "Respuesta a incidentes").

---

## 1 · Qué pasó

El 5 de noviembre metí `docs/entregas/cotejo-visual/SUGERENCIA_INFORME_ANBISE.pdf` en el commit `b893efe3`
con un `git add -A` de una tanda de trabajo. Ese archivo **es un informe de paciente**: lleva nombre
completo, número de documento, fecha de medición y cifras clínicas. La carpeta `docs/entregas/` tenía regla
de `.gitignore` para `.xlsx`, `.csv` y `.docx`, pero **no para `.pdf`**.

Reporté que no había llegado a GitHub porque el push lo hace Santiago al final. **Ya había hecho push**, así
que el archivo está en el repositorio remoto (privado).

**Y al preparar la limpieza salió lo que de verdad importa: ese PDF no es el único ni el primero.**

---

## 2 · El alcance real, verificado

Once blobs `.pdf` distintos en el historial completo, en cinco commits, **desde el 1 de septiembre**:

| Commit | Fecha | Archivos |
|---|---|---|
| `e406a1c0` | 2026-09-01 | 4 (`(local)`/`(web) Resultados - Atlas`, dos `reporte-<uuid>`) |
| `02f0036a` | 2026-09-02 | 2 (`HC descargar-imprimir`, `HC enviada al correo`) |
| `80e9b64e` | 2026-09-02 | 2 (los dos anteriores, versión 2) |
| `1d49aa9c` | 2026-09-03 | 2 (`Reporte de la subpestaña nutricionista`, `Reporte ver preview de pestaña Reporte-HC`) |
| `b893efe3` | 2026-11-05 | 1 (`SUGERENCIA_INFORME_ANBISE`) |

Todos salvo el último están bajo `docs/entregas/cotejo-visual/reportes/`.

**Los once son documentos de paciente, y eso no es una suposición:** son las salidas de impresión del
informe y de la historia clínica de Atlas, y las dos plantillas imprimen el rótulo `Documento` en su caja
de identidad (`src/modules/reports/pdf/report-document.tsx:182`,
`src/modules/reports/pdf/plan-document.tsx:73`, más el encabezado de `hc-document.tsx`). Cuatro llevan
además capturas JPEG de la pantalla, que muestran lo mismo.

**Lo que sí hay que decir con precisión:** el repositorio es **privado** y, por los refs del remoto, no hay
forks, ni ramas abiertas, ni tags, ni más colaboradores con push que Santiago. Es una exposición a quien
tenga acceso al repositorio, no una publicación abierta.

**La decisión que no es nuestra:** si esto activa el deber de notificación a la Superintendencia de
Industria y Comercio (SECURITY.md, paso 3: quince días hábiles desde la detección). Son dos meses de datos
de paciente en un remoto, aunque privado y con acceso restringido. Lo decide Santiago con el asesor
jurídico, no el equipo técnico, y la fecha de detección es hoy, 5 de noviembre de 2026.

---

## 3 · Lo que ya está hecho

- `docs/entregas/**/*.pdf` en `.gitignore` (línea 96), con su razón escrita al lado. **Verificado que
  cubre toda la carpeta a cualquier profundidad**, con `git check-ignore -v` sobre cuatro rutas:
  `docs/entregas/suelto.pdf`, `cotejo-visual/x.pdf`, `cotejo-visual/reportes/y.pdf` y `a/b/c/z.pdf`. Las
  cuatro caen en la regla.
- El archivo de hoy fuera del índice (`git rm --cached`); sigue en el disco para poder trabajarlo.
- Los tres PDF que hoy están en el disco (el de la sugerencia y dos en `docs/entregas/dudas/`) quedan
  ignorados por esa regla, y los de `dudas/` además por `docs/entregas/dudas/**`.

---

## 4 · La limpieza del historial, paso a paso

### 4.1 · Antes de tocar nada: lo que hay que verificar

1. **Que nadie más tenga un clon o una rama abierta.** Es lo único que puede deshacer el trabajo: un
   `push --force` no llega a los clones de otros, y si alguien empuja después desde un clon viejo, **los
   PDF vuelven**. Verificado hoy desde aquí: el remoto tiene un solo ref (`refs/heads/main`), sin tags.
   Falta lo que solo se ve en GitHub, y es Santiago quien tiene que mirarlo:
   - `Settings > Collaborators`: quién tiene acceso con push.
   - `Insights > Forks`: un fork conserva los objetos y **no se reescribe** con el force push.
   - `Pull requests` (incluidas las cerradas): los refs de merge de una PR mantienen vivos los objetos
     viejos y tampoco se reescriben.
   - Que nadie tenga un Codespace o un clon en otra máquina con trabajo sin empujar.
2. **Un respaldo antes de reescribir.** Un espejo completo, fuera del repositorio:
   ```powershell
   git clone --mirror https://github.com/CNV-SAS/cnv-atlas.git "$env:USERPROFILE\Respaldos\cnv-atlas-antes-de-limpiar.git"
   ```
   Ese espejo **también contiene los PDF**, así que es un archivo sensible: va fuera de cualquier carpeta
   sincronizada, y se borra cuando la limpieza esté confirmada.
3. **Árbol de trabajo limpio** (`git status` sin nada pendiente) y todo comiteado.

### 4.2 · La reescritura

`git filter-repo` es la herramienta recomendada hoy, pero necesita Python, y en esta máquina **no hay
Python ni Java** (comprobado), así que BFG tampoco. `git filter-branch` viene con Git for Windows y está
disponible ahora mismo; con 1.995 commits y 20 MB de `.git` tarda unos minutos, no horas.

En PowerShell, desde la raíz del repositorio:

```powershell
$env:FILTER_BRANCH_SQUELCH_WARNING = "1"
git filter-branch --force --index-filter 'git rm -r --cached --ignore-unmatch "docs/entregas/*.pdf"' --prune-empty --tag-name-filter cat -- --all
```

Tres cosas de esa línea, porque no son evidentes:

- **`docs/entregas/*.pdf` alcanza las subcarpetas.** En un pathspec de git el `*` cruza las barras, así que
  esa única expresión toma los once, incluidos los de `cotejo-visual/reportes/`. Verificado contra dos
  commits del historial (`e406a1c0` y `b893efe3`): el pathspec los lista.
- **`-- --all`, no un rango.** El primer PDF entró el 1 de septiembre, 790 commits atrás, así que limpiar
  solo lo de hoy no sirve de nada.
- **`--prune-empty`** descarta los commits que se queden sin ningún cambio. Ninguno de los cinco lo hará
  (todos traían código además del PDF), pero es la red por si acaso.

### 4.3 · Borrar lo que queda apuntando a lo viejo

`filter-branch` deja los commits originales accesibles en `refs/original/`, y el reflog también:

```powershell
git for-each-ref --format="%(refname)" refs/original | ForEach-Object { git update-ref -d $_ }
git reflog expire --expire=now --all
git gc --prune=now
```

### 4.4 · Comprobar antes de empujar

Las dos tienen que salir vacías:

```powershell
git log --all --oneline -- "docs/entregas/*.pdf"
git rev-list --objects --all | Select-String "\.pdf$"
```

Y que el árbol de trabajo siga igual (la reescritura cambia el historial, no el contenido de hoy):

```powershell
git status
git log --oneline -3
```

Los identificadores de los commits cambian. El contenido, no.

### 4.5 · El push forzado

```powershell
git push --force-with-lease origin main
```

`--force-with-lease` en vez de `--force` porque falla, en vez de pisar, si alguien empujó algo desde el
último `fetch`. Es la diferencia entre reescribir el historial y borrar el trabajo de otra persona.

### 4.6 · Lo que el push forzado NO arregla, y hay que hacer aparte

1. **GitHub conserva los objetos viejos.** Quedan inalcanzables desde cualquier rama, pero siguen
   recuperables por su identificador hasta que GitHub recoja la basura, y eso no pasa por pedirlo con un
   comando. Hay que **abrir un ticket a GitHub Support** pidiendo la purga de los objetos inalcanzables
   del repositorio `CNV-SAS/cnv-atlas`, citando que contienen datos personales de salud.
2. **Los clones ajenos siguen teniéndolos.** Quien tenga un clon tiene que borrarlo y volver a clonar; un
   `git pull` sobre un clon viejo no limpia nada y puede reintroducirlo.
3. **El respaldo del punto 4.1.2 contiene los PDF.** Se borra cuando esto esté cerrado.

---

## 5 · Mitigación para que no se repita

- La regla de `.gitignore` ya cubre los PDF de `docs/entregas/`, que es por donde llegaron las dos veces
  (hay un commit anterior titulado *"drop the report PDFs of the previous round"*: la carpeta ya había
  dado el aviso y la regla seguía sin cubrirlos).
- Pendiente de decidir: un control que falle el commit cuando entre un binario bajo `docs/entregas/`,
  en vez de depender de que la lista de extensiones esté completa. Hoy la regla es por extensión, y la
  lección de las dos veces es que la extensión siguiente siempre es otra.

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
