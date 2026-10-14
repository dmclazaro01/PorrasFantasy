# Tarea: rediseño de La Porra, mockups navegables en clave taberna

> **Estado:** la v1 del mockup (reskin) fue RECHAZADA por el dueño: «no veo cambios significativos».
> La iteración 2 la sustituye con una macroestructura de planilla de quiniela. Ver «Iteración 2» al final.


Bookkeeping interno del feature. No es un artefacto de diseño: la dirección visual vive en `DESIGN.md`.

## Objetivo

Producir el rediseño navegable de la web de porras "La Porra" aplicando el sistema antislop en modo
DURANTE, con la identidad de cartel impreso de taberna que el dueño ya eligió, y documentar la dirección
visual para que otro pueda continuar el trabajo sin reinterpretar nada.

## Problema

La app real tiene tres temas (oscuro, claro, taberna) y el tema taberna nació como una capa de overrides
sobre el tema oscuro. Eso deja tres huecos:

1. La identidad taberna no está escrita: existe en el CSS pero no hay documento que explique por qué el
   papel es cálido, por qué los cantos son rectos o por qué la sombra es dura. Sin eso, cualquier cambio
   futuro deriva a un tema neutro.
2. Varios pares de color del tema actual no llegan a AA para texto pequeño (rojo sobre `bg`, rojo sobre
   `primary-dim`, dorado sobre `gold-dim`, granate y verde sobre sus fondos rebajados).
3. La app usa emoji como iconografía (planilla, copa, naipe, medallas, balón, megáfono) y una librería de
   trazo fino, que son voces ajenas al cartel impreso.

## Alcance

Dentro:

- `DESIGN.md` en la raíz: dirección visual, paleta con motivos, tipografía, forma, dials y decisiones.
- `docs/superpowers/mockups/lpo-redesign/index.html`: mockup navegable, un solo archivo, sin build ni CDN,
  con las 11 pantallas, estados de datos y navegación interna real.
- Este documento.

Fuera (explícito):

- No se toca `src/` de la app. El mockup es una propuesta, no una migración.
- No se despliega nada: ni `vercel`, ni `git push`, ni commits. `docs/` está en `.gitignore` y no se fuerza.
- No se inventa una segunda competición, ni estadísticas, ni testimonios, ni cifras que parezcan reales.

## Restricciones

- Tema único: taberna. Sin control de tema en el mockup (en Perfil, la fila "Tema" es texto informativo).
- Sin fuentes remotas: stacks locales con fallback (`Archivo Black` cae a `Arial Black` e `Impact`).
- Sin emoji decorativo y sin em dash en ningún texto.
- Copy en español neutro profesional, sin voseo.
- Contraste WCAG AA comprobado, tap targets de 44x44, foco visible, sin overflow horizontal.

## Dependencia no disponible

El brief pedía leer `docs/superpowers/mockups/mock-e-bento-taberna.html` como referencia de identidad. El
archivo existe en el repo, pero se leyó como referencia ligera (tokens y voz tipográfica) porque usa CDN de
Google Fonts, algo que el brief prohíbe para el mockup nuevo.

## Checklist

| ID | Tarea | Estado |
|---|---|---|
| T1 | Leer contexto real: `src/index.css` (bloque taberna), `src/ui.tsx`, `src/App.tsx`, las 5 pantallas, `src/components/Cards.tsx` y `PoolAdmin.tsx`, `CardIcon.tsx`, `public/icon.svg` | Hecho |
| T2 | Extraer copy real y estructura de las 11 pantallas, sin inventar texto | Hecho |
| T3 | Medir contraste de todos los pares texto/fondo del tema con `contrast-check.py` | Hecho |
| T4 | Definir los tokens seguros para texto pequeño (dos rojos, variantes oscuras de los semánticos) | Hecho |
| T5 | Escribir `DESIGN.md` con Design Read, dials, paleta, tipografía, forma, iconografía y motivos por decisión | Hecho |
| T6 | Construir el mockup: tokens, layout de 3 estados (móvil, tablet, escritorio) y barra de prototipo | Hecho |
| T7 | Sustituir los emoji por glifos SVG propios y reutilizar los 10 glifos reales de `CardIcon` | Hecho |
| T8 | Inline del sello real de `public/icon.svg` como marca | Hecho |
| T9 | Hacer real la navegación: tabs de sección, tira de jornadas Ant./Sig., General/Jornada/Bote, hojas con Escape y trampa de foco | Hecho |
| T10 | Implementar los estados vacío, cargando y error en partidos, clasificación, bote y porras, con conmutador en la barra | Hecho |
| T11 | Cablear la escritura en los marcadores: contador "enviados X/Y" y aviso de guardado | Hecho |
| T12 | Cablear las hojas: detalle de partido (con copiar del Espía y bloque admin), ficha de jugador, jugar carta, explicación y admin de porra | Hecho |
| T13 | Verificar con Playwright: clic-through de cada control, overflow, tap targets, foco, teclado y consola | Hecho |
| T14 | Corregir los defectos encontrados por la verificación | Hecho |
| T15 | Revisar visualmente las capturas de móvil (390) y escritorio (1440) | Hecho |
| T16 | Pasar el Delivery Gate antislop y reportarlo | Hecho |

## Criterios de aceptación

1. `DESIGN.md` explica cada decisión mayor en una línea y declara los dials.
2. El mockup abre con doble clic (`file://`), sin build, sin red y sin errores de consola.
3. Las 11 pantallas son accesibles desde la barra de prototipo con un clic, y todas las hojas se abren y
   cierran (botón, fondo y Escape).
4. No hay ningún control muerto: cada botón cambia estado, navega o da respuesta visible.
5. No hay overflow horizontal entre 320px y 1440px; los targets interactivos miden 44x44 como mínimo.
6. Todos los pares texto/fondo pasan AA; los pares que fallaban en el tema actual quedan corregidos.
7. Cero em dash y cero emoji en los tres archivos.

## Checks aplicables

- Hard Gate: R-02, R-03, R-17, R-18, R-23, R-24, R-25, R-26, R-27, R-32, R-34, R-35, R-36, R-37, R-38.
- Purpose-Gate: R-01 (gradientes con motivo), R-04 (iconos propios), R-06 (tipografía razonada), R-07
  (sin rejilla de fondo), R-08, R-09, R-10, R-12, R-13, R-14, R-19, R-22.
- Quality Locks: R-05, R-11, R-15, R-16, R-20, R-29, R-30, R-31.
- Craftsmanship: C-1 a C-5.
- Layoutmobile: reflujo real de 3 estados, sin overflow, targets, nav móvil que no tapa contenido.
- Human: contraste comprobado con script, foco visible, teclado, estados perceptibles, texto al 200%.
- Copywriting: sin em dash, sin buzzwords, sin cifras inventadas, sin cierres de chatbot.

## Evidencia

### Contraste (WCAG 2.x, `contrast-check.py`)

Pares comprobados que ya pasaban en el tema real: `ink` sobre papel, `bg` y `surface-2` (15.60, 14.52,
13.71); `ink-soft` sobre papel y `surface-2` (7.18, 6.31); `ink-faint` sobre papel, fondo y `surface-2`
(5.39, 5.01, 4.73); `on-primary` sobre `primary` y `primary-2` (4.91, 6.40).

Pares que fallaban en el tema actual y se corrigieron en el mockup:

| Par del tema actual | Ratio | Corrección aplicada |
|---|---|---|
| `primary` (#bf3b26) sobre `bg` (#f2e7cb) | 4.41 FAIL | El rojo de texto pequeño pasa a `#a32e1d` (5.75 sobre `bg`). |
| `primary` sobre `primary-dim` (#f3d9cd) | 4.04 FAIL | Chips rojos con `#a32e1d` (5.27). |
| `gold` (#8a5f0c) sobre `gold-dim` (#f0e2bd) | 4.38 FAIL | Chips dorados con `#6b4a06` (6.26). |
| `live` (#c22f4a) sobre `live-dim` (#f6d9de) | 4.18 FAIL | Etiquetas en juego con `#9c2038` (5.94). |
| `win` (#1d7a3d) sobre `win-dim` (#dcebd8) | 4.33 FAIL | Sellos de acierto con `#14602f` (6.17). |
| `ink-faint` sobre `surface-3` (#e4d0a8) | 4.08 FAIL | No se usa `ink-faint` ahí; los escudos usan `ink-soft` (5.44). |
| `on-primary` sobre el extremo oscuro de `grad-gold` | 2.50 FAIL | El sello dorado lleva tinta (6.45 en su punto más oscuro). |

### Verificación funcional (Playwright sobre Chrome, `file://`)

- 131 comprobaciones, 0 FAIL, 0 errores de consola ni excepciones.
- Clic-through de cada control: barra de prototipo (11 pantallas + 4 estados), validación de Auth y Nueva
  contraseña, acordeón y botón deshabilitado de Crear porra, error de código inválido y entrada con F884F7,
  los 6 estados de partido, Finalissima, copiar del Espía, aviso de rueda de prensa, bloque admin del
  partido, tabs General/Jornada/Bote, ficha de jugador, las 10 cartas, jugar carta, perfil y admin de porra
  (nombre, recálculo, código nuevo, expulsión, eliminación).
- Estados: cada conmutador deja visible una sola variante en partidos, clasificación y bote; "Reintentar"
  pasa por cargando y vuelve a normal.
- Responsive: sin scroll horizontal a 320, 390, 768, 1024 y 1440px. A 1024+ la barra inferior desaparece,
  aparecen tabs y tira de jornadas de escritorio y los partidos reflowan a 2 columnas.
- Targets: 44x44 mínimo en las 8 vistas y en la navegación de escritorio.
- Teclado: foco atrapado en la hoja (40 de 40 tabulaciones), anillo de tinta de 3px, Escape cierra solo la
  capa superior.

### Zoom y texto al 200%

- Con 1280px y 1440px de ancho y 200% de zoom (equivalente a 640 y 720 CSS) no hay desbordes ni elementos
  que se salgan: `scrollWidth === clientWidth` y cero elementos por fuera.
- Caso extremo que WCAG no exige: 320px con 200% de zoom. Con un ancho efectivo de 160 CSS, las etiquetas
  largas de estado y los nombres de equipo se salen de su caja y `overflow-x: clip` las recorta, igual que
  hace la app real con `html, body { overflow-x: clip }`. Queda como limitación conocida, no como defecto
  del rediseño.

### Capturas

`docs/superpowers/mockups/lpo-redesign/shots/` (carpeta ignorada por git): 15 capturas de móvil a 390px y
5 de escritorio a 1440px, más el script `shoot.cjs` que las regenera.

## Defectos encontrados por la verificación y corregidos

1. `Escape` cerraba la hoja y la barra de prototipo a la vez. Ahora solo cierra la capa superior.
2. La rejilla de descanso de la jornada de escritorio no tenía `id`, así que su estado seleccionado no se
   sincronizaba.
3. Los segmentos de la tira de jornadas de escritorio no tenían acción cableada: eran controles muertos.
4. El nombre de la porra en la hoja de admin escribía en la cabecera oculta de "Crear porra" (selector sin
   ámbito).
5. El atributo `hidden` perdía contra las reglas `display` de las clases, así que aparecían a la vez la
   carta de prensa revelada, el aviso "Usar" de la carta jugada, el bloque de confirmación de borrado y el
   campo de nombre de Auth en modo Entrar. Se añadió `[hidden]{display:none !important}`.
6. El campo "tu pronóstico" partía el marcador en dos líneas y el enlace "Ver porras" se partía solo. La
   fila del pie ahora envuelve con `nowrap` en las piezas cortas.
7. La altura de la barra de prototipo no se recalculaba al crecer (aviso, botón "Cerrar hoja"), así que una
   cabecera pegajosa quedaba bajo la barra. Se añadió `ResizeObserver`.
8. La hoja dejaba una franja de fondo demasiado fina para cerrarla con un toque: su altura máxima bajó de
   88dvh a 82dvh.

## Decisiones no obvias y desviaciones del app real

- **El rol de la app es "Pablo", uno de los miembros reales de la sala.** Así la marca "TÚ" del ranking y el
  pronóstico propio son coherentes. El placeholder del correo en Auth sigue siendo el copy real de la app.
- **La competición se muestra como una fila seleccionada con una sola opción** (LaLiga), con la nota real
  "Por ahora solo LaLiga. Pronto más.". Se descartó añadir una segunda competición inventada.
- **La clasificación es una lista de filas pulsables, no una tabla HTML.** Cada fila abre la ficha del
  jugador, y un `tr` con `onClick` es peor para teclado que un `button`. En escritorio se conserva la
  lectura tabular con columnas alineadas.
- **El punto de "en juego" es estático.** La app usa un latido infinito; con MOTION 1 se retira el bucle y
  se deja el punto, que es lo que marca el estado.
- **La jornada tiene 8 partidos en el prototipo** para cubrir los seis estados reales (ABIERTO, CERRADO, EN
  JUEGO, FINAL, DESCANSO, POR CONFIRMAR) más el pronóstico fijado por rueda de prensa.
- **Al elegir otra parte de la jornada** se muestra un estado vacío honesto en lugar de repetir los partidos
  de la parte 2/2.
- **La ficha de jugador muestra estadísticas e historial de ejemplo**, declarados como tales, en lugar de
  inventar un historial por jugador que pareciera real.

## Pendientes para una siguiente sesión

- Llevar los tokens corregidos a `src/index.css` y sustituir los emoji de `src/` por los glifos del mockup.
- Decidir si el tema oscuro y el claro se conservan o se retiran; el rediseño solo cubre taberna.
- Confirmar los datos que aquí van como ejemplo (horarios, marcadores, acumulado General, bote) o cambiar
  las capturas cuando existan.
## Iteración 2: la planilla (sustituye el reskin rechazado)

### Por qué se rechazó la v1

La v1 reproducía 1:1 la estructura de la app: misma cabecera, mismo boleto con cabecera oscura y filas
escudo-input-input-escudo, misma tira de jornadas y mismos tres tabs. El dueño lo resumió así: «no veo
cambios significativos». Un cambio de color, de emoji a glifo o de copy no cuenta como rediseño: la v1
queda archivada como `v1-reskin.html` y no se toca.

### Qué se conservó de la v1

- La identidad (papel, tinta, rojo de cartel) y las reglas de forma (cantos rectos, filete de 2.5px,
  sombra dura solo en cartel y boleto).
- El sello real inlineado y los 10 glifos reales de `CardIcon.tsx`, más los glifos propios.
- Los 7 arreglos de contraste AA documentados en `DESIGN.md` §4.
- La barra de prototipo con todas las pantallas y el conmutador de estado (Normal / Vacío / Cargando / Error).
- Los estados vacío, cargando y error con causa y siguiente paso, el foco de tinta, el Escape en hojas y
  el clic-through real.
- La nota honesta de datos (Jornada 7 real de «Porra Infelices», F884F7; ejemplos declarados).

### Tareas de la iteración

| ID | Tarea | Estado |
|---|---|---|
| T17 | Archivar la v1 como `v1-reskin.html` y marcarla como rechazada | Hecho |
| T18 | Reescribir la planilla: cabecera con jornada, cierre, contador y sello; 10 renglones con 7 columnas y filete fino | Hecho |
| T19 | Reflujo móvil a 3 columnas (hora, partido en TLA, marcador) con microlínea solo para ×2 y cartas | Hecho |
| T20 | Marcador editable de 44x44, cifras tabulares, ×2 como casilla y marcas de cartas con título | Hecho |
| T21 | Zócalo con el aviso de autoguardado y las acciones pendientes (espía, rueda de prensa, fijado) | Hecho |
| T22 | Mis porras: un cartel por sala con posición, pendientes y «Rellenar la planilla» | Hecho |
| T23 | Ranking: tabla densa con el podio como cabecera y el bote en tabla de deuda | Hecho |
| T24 | Cartas: cupón de la jornada con «Abrir sobre» y baraja en lista de renglones | Hecho |
| T25 | Hojas (detalle, ficha, jugar, explicar, admin) en el lenguaje de la planilla | Hecho |
| T26 | Auth, crear, unirse, nueva contraseña y perfil: cartel con formulario en columnas | Hecho |
| T27 | Sustituir la barra inferior por pestañas de sección sobre la planilla y jornada en la cabecera | Hecho |
| T28 | Verificar en el DOM: sin scroll a 1440x900, cero tarjetas por partido, sin scroll horizontal a 390 | Hecho |
| T29 | Auditar el contraste AA de cada par texto/fondo renderizado y corregir los fallos | Hecho |
| T30 | Actualizar `DESIGN.md` con la macroestructura (§13) y este registro | Hecho |

### Evidencia de la iteración 2 (Playwright sobre Chrome, `file://`)

- **Escritorio 1440x900:** `documentElement.scrollHeight` = 900, `innerHeight` = 900, sin scroll vertical;
  la planilla va de 174 a 828 px; 10 renglones de 46-47 px; 0 carteles por partido dentro de la lista.
- **Sin scroll horizontal:** 1440, 1280, 1024, 768, 640, 414, 390, 360 y 320 px con `scrollWidth === clientWidth`
  en 10 vistas (incluye 640 px como equivalente de 200 por ciento de zoom sobre 1280). En movil las columnas
  quedan en 52 / 202 / 104 px.
- **Móvil 390x844:** 10 renglones, 0 recortes en la columna del partido, 0 desbordes horizontales. La
  planilla mide 1043 px: no entra sin scroll vertical (seis microlíneas de 44 px más el pie con tres
  acciones y la cabecera con jornada, cierre, contador y sello). Se documenta como límite, sin maquillar.
- **Targets:** 0 controles por debajo de 44 px en las 14 vistas (móvil).
- **Contraste:** auditoría en el DOM de cada nodo con texto propio en las 14 vistas y los 4 estados, con
  fórmula WCAG y opacidad acumulada. 0 fallos sobre fondos sólidos; los textos sobre `--grad-hero` y
  `--grad-gold` se comprobaron aparte con `contrast-check.py` (mínimo 6.45:1).
- **Navegación:** 14 botones en la barra de prototipo (9 pantallas y 5 hojas), 16 acciones `data-act`,
  todas cableadas; 0 controles muertos; el Escape cierra la capa superior y el foco vuelve al origen.
- **Texto:** 0 em dashes y 0 emoji en el DOM renderizado; 0 errores de consola y 0 excepciones.

### Divergencia frente a la app

| Pantalla | Qué hace la app hoy | Qué hace el rediseño | Por qué |
|---|---|---|---|
| Predicciones | Una tarjeta por partido (escudo, dos campos, chips) con cabecera oscura de boleto y 2 columnas en escritorio | Planilla única: columnas alineadas, un renglón por partido, filete fino, sin tarjeta por partido | Una quiniela se rellena en columna; la tarjeta convierte cada partido en una pantalla |
| Predicciones · móvil | Las filas se apilan y cada partido es un bloque | 3 columnas (hora, partido en TLA, marcador) con microlínea solo si hay ×2 o cartas | Apilar sería volver a la app; la planilla se comprime, no se convierte en tarjetas |
| Mis porras | Lista de tarjetas con iniciales, código y puntos | Cartel por sala con tu posición, los partidos que faltan y «Rellenar la planilla» | Al entrar importa qué falta, no qué salas existen |
| Ranking | Tabs y lista de filas con medallas emoji; tabla mínima (#, jugador, puntos) en escritorio | Tabla densa con puesto, jugador, exactos, aciertos y puntos, y el podio como cabecera | Se compara en columna; el podio resume y la tabla ordena |
| Cartas | «Tu carta» en tarjeta y la baraja en rejilla de 2-3 columnas | Cupón de la jornada que se abre con «Abrir sobre» y baraja en lista de renglones | El cupón se abre; el catálogo se lee en lista |
| Orden de secciones | Barra inferior fija con Predicciones/Ranking/Cartas más tira de jornadas; tabs arriba en escritorio | Pestañas de sección sobre la planilla y jornada en la cabecera de la planilla (Ant./Sig.) | La planilla es la pantalla, y dos barras fijas le comían 108 px en móvil |
| Auth y formularios | Campos apilados dentro de tarjetas | Cartel con formulario en columnas (etiqueta a la izquierda, campo a la derecha) | Un formulario alineado se rellena en vertical sin saltar entre tarjetas |
| Detalle, ficha, admin | Bloques apilados con chips y listas | Tablas densas y bloques en el lenguaje de la planilla | Lo que se abre encima conserva la lectura de la planilla |

### Reproducir la verificación

Los scripts viven en `docs/superpowers/mockups/lpo-redesign/shots/`
y usan el Playwright del repo:

```
node docs/superpowers/mockups/lpo-redesign/shots/verify.cjs
node docs/superpowers/mockups/lpo-redesign/shots/verify-mobile.cjs
node docs/superpowers/mockups/lpo-redesign/shots/contrast-audit.cjs
node docs/superpowers/mockups/lpo-redesign/shots/entity-leak.cjs
node docs/superpowers/mockups/lpo-redesign/shots/widths.cjs
```

Las capturas de la iteración 2 están en `shots/v2/` (20 de móvil a 390 px y 7 de escritorio a 1440 px, más `shots/shoot.cjs` que las regenera). Las 21 capturas de la v1 se movieron a `shots/v1/`.
