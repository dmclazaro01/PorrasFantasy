# Diseño: La Porra en modo taberna

Documento de dirección visual. Gobierna el rediseño de la web de porras "La Porra" y el mockup
`docs/superpowers/mockups/lpo-redesign/index.html`. Los tokens son los reales del tema taberna que ya
vive en `src/index.css` (bloque `:root[data-theme='taberna']`); aquí se documenta por qué son esos y no
otros, y se fijan las reglas de forma que el mockup aplica.

## 1. Identidad

Un **cartel impreso de taberna**. Papel cálido de imprenta barata, tinta negra, un rojo de cartel, titulares
de palo pesado, cantos rectos, filetes gruesos y sombra dura desplazada. Es la web de una porra privada
entre amigos que se conocen: el tono es de aviso pegado en la pared de un bar, no de panel de producto.

**Design Read:** "Reading this as: app privada de porra entre amigos, en un lenguaje visual de cartel
impreso de taberna, dial ENERGY 2 / RHYTHM 2 / MOTION 1."

## 2. Personalidad

- **Directa.** Frases cortas, números grandes, sin adornos. "La porra de siempre. Que no se cae."
- **De bar, no de oficina.** Papel, tinta y rojo. Nada de superficies flotantes ni brillos.
- **Con carácter impreso.** Los elementos no se difuminan: se recortan. Borde grueso y sombra sólida.
- **Honesta.** Cuando el dato no está, no se rellena. El prototipo lo declara en su propia barra.

## 3. Dials

| Dial | Valor | Qué significa aquí |
|---|---|---|
| ENERGY | 2 | Habla claro con titulares grandes y rojo de cartel, pero sin gritar: una sola acción principal por pantalla. |
| RHYTHM | 2 | Ritmo consistente con roturas deliberadas: la baraja de cartas en rejilla, los partidos en lista de boleto, las tablas en filas. |
| MOTION | 1 | Solo estados de interacción (hover, active, focus) y la subida de las hojas. La tinta impresa no se mueve. |

MOTION 1 es una decisión, no una ausencia: la app se mira mientras se rellena un boleto, y cualquier
animación de entrada competiría con los campos de marcador.

## 4. Paleta

Tres colores base (papel, tinta, rojo) más un dorado de sello. El verde, el granate de directo y el cobre
son semánticos (victoria, en juego, bronce) y no compiten como identidad.

| Token | Hex | Uso | Motivo |
|---|---|---|---|
| `--color-bg` | `#f2e7cb` | Fondo de la app | Papel de estraza: el color de la pared donde se pega el cartel, no blanco de laboratorio. |
| `--color-bg-2` | `#e9d9b8` | Franjas y cabeceras | Un tono más de papel para separar sin introducir otro color. |
| `--color-surface` | `#f7efdc` | Tarjetas y boletos | Papel más claro: los elementos que se leen de cerca suben un escalón de luz. |
| `--color-surface-2` | `#efe0c2` | Campos, segmentos, filas | Papel hundido: lo que se rellena o se alterna pierde luz. |
| `--color-surface-3` | `#e4d0a8` | Chips y cajas de escudo | Tercer escalón, el más apagado, para piezas pequeñas que no deben pesar. |
| `--color-ink` | `#221410` | Texto y filetes | Tinta de imprenta: marrón casi negro, nunca negro puro, para que el papel no parezca pantalla. |
| `--color-ink-soft` | `#5c4c3c` | Texto secundario | Tinta rebajada que sigue pasando AA sobre papel (6.31:1 sobre `surface-2`). |
| `--color-ink-faint` | `#6e5f4c` | Terciario, metadatos | El mínimo que aguanta AA sobre papel y fondo (5.39:1 y 5.01:1); nunca sobre `surface-3` ni sobre `line`, donde baja a 4.08:1 y 3.61:1. |
| `--color-primary` | `#bf3b26` | Rellenos, bordes, display grande | Rojo de cartel: el color de aviso de la imprenta de barrio. Solo en display o relleno, porque sobre `bg` se queda en 4.41:1 y no vale para texto pequeño. |
| `--color-primary-2` | `#a32e1d` | Estado activo y texto rojo pequeño | Un paso más de tinta en el rojo: es el mismo rojo llevado a contraste AA para texto sobre papel o sobre `primary-dim`. |
| `--color-on-primary` | `#fbf3df` | Texto sobre tinta | Papel claro sobre bloque oscuro (14.74:1). |
| `--color-primary-dim` | `#f3d9cd` | Fondo de chips rojos | Papel teñido de rojo para piezas de acento sin gritar. |
| `--color-win` / `--win-dim` | `#1d7a3d` / `#dcebd8` | Acierto | Verde de sello de aprobado; el fondo rebajado permite que el texto vaya en verde oscuro (6.17:1). |
| `--color-live` / `--live-dim` | `#c22f4a` / `#f6d9de` | En juego y descanso | Granate de marca de directo, distinguible del rojo de cartel por contexto (punto, minuto). |
| `--color-gold` / `--gold-dim` | `#8a5f0c` / `#f0e2bd` | Exacto, Finalissima, MVP | Dorado de sello de lacre para lo excepcional; el brillo solo aparece en relleno. |
| `--grad-hero` | `150deg, #221410 0%, #57200f 90%` | Cabeceras de boleto y auth | Tinta que se calienta hacia el rojo quemado: la única mancha oscura grande y siempre como cabecera, nunca como fondo de página. |
| `--grad-gold` | `135deg, #e8bd55 0%, #c8921f 100%` | Sello de exacto | Lámina dorada del sello; lleva texto en tinta (6.45:1 en su punto más oscuro), nunca en papel claro (2.50:1). |

### Reglas de color que el mockup respeta

- **Dos rojos, cada uno para lo suyo.** `#bf3b26` para display grande, bordes y rellenos; `#a32e1d` para
  texto pequeño sobre papel o sobre `primary-dim`. Motivo: el rojo brillante sobre `bg` da 4.41:1 y sobre
  `primary-dim` 4.04:1, ambos por debajo de AA para texto normal.
- **Los estados semánticos usan su versión oscura para texto** (`#14602f`, `#9c2038`, `#6b4a06`) sobre su
  fondo rebajado. Motivo: el color vivo sobre su propio dim se queda entre 4.18 y 4.38:1.
- **`ink-faint` no se usa sobre `surface-3` ni sobre `line`.** Motivo: 4.08:1 y 3.61:1, por debajo de AA.
- **Ningún texto claro sobre el dorado.** Motivo: `on-primary` sobre el extremo oscuro del dorado da 2.50:1.

## 5. Tipografía

- **Display: Archivo Black** (`'Archivo Black','Arial Black',Impact,sans-serif`). Motivo: es el palo pesado
  de rótulo de imprenta que la app ya carga para taberna, y sus contraformas cerradas sobreviven a mayúsculas
  pequeñas donde una grotesca fina se deshilacha.
- **Cuerpo: Inter**. Motivo: ya es el cuerpo real de la app y aguanta números tabulares en tablas de
  clasificación sin meter personalidad donde no toca.
- **Números tabulares en display.** Motivo: puntos, minutos y marcadores se comparan en columna; sin ancho
  fijo los dígitos bailan al actualizarse en vivo.
- **Versalitas con tracking amplio en etiquetas de cabecera.** Motivo: es el rótulo pequeño impreso
  ("TU TABERNA", "CIERRA 21:00") y hace de voz secundaria del display sin competir con el titular.
- **Sin monoespaciada.** Motivo: nada en el producto es una terminal; usarla sería disfraz tecnicista.

## 6. Forma

- **Cantos rectos.** Tarjetas con radio 10, boletos con 12, chips con 8, botones con 6. Motivo: en un cartel
  impreso el papel se corta con guillotina; la pastilla redondeada es justo lo contrario.
- **Borde de 2.5px de tinta.** Motivo: es el filete de la imprenta; sin él, el papel claro se confunde con
  el fondo claro.
- **Filete doble en cabeceras.** Motivo: la raya doble separa cabecera y cuerpo en el cartel impreso, y a 3px
  hace de frontera sin recurrir a la sombra.
- **Sombra dura `5px 5px 0` de tinta, solo en tarjetas y boletos.** Motivo: separa el papel del fondo igual
  que un cartel despegado de la pared; si todo flota, nada destaca. El resto de piezas queda plano.
- **Sin glow, sin glass, sin degradados fuera de `--grad-hero` y `--grad-gold`.** Motivo: el neón contradice
  el papel y borra la jerarquía que hace el filete.
- **Avatares y punto de directo redondos.** Motivo: son las dos únicas piezas que representan a una persona
  o un estado vivo; la redondez las separa del papel troquelado.
- **Línea de corte discontinua entre filas.** Motivo: imita la perforación del boleto para separar partidos y
  filas sin añadir un segundo borde grueso.

## 7. Iconografía y sello

- **El sello LP (`public/icon.svg`) se reutiliza inlineado como marca.** Motivo: es el icono real de la app y
  el único activo con autoridad de marca; redibujarlo sería inventar identidad.
- **Los glifos de las 10 cartas son los reales de `src/components/CardIcon.tsx`.** Motivo: ya están dibujados
  a mano sobre rejilla de 24px y trazo de 2, y son el vocabulario visual propio del juego.
- **Los emoji de la app se sustituyen por glifos SVG propios**: planilla de boleto (Predicciones), copa
  (Ranking), naipe (Cartas), roseta con número para el podio, balón para los goleadores, megáfono para la
  rueda de prensa, candado para el pronóstico fijado y llave para el bloque de admin. Motivo: el emoji mete
  color y tipografía ajenos al cartel, y su dibujo no tiene relación con lo que etiqueta.
- **Todos los glifos comparten rejilla, trazo y remates** con `CardIcon`. Motivo: un juego de iconos se lee
  como propio cuando comparte voz, no cuando comparte librería.
- **Nada de Lucide ni de iconos de librería.** Motivo: el trazo fino redondeado de esas librerías es la voz
  por defecto de la IA y no la de una imprenta de barrio.

## 8. Motivo de identidad

El gesto repetido es **el boleto con filete**: borde de tinta, cabecera oscura con versalitas, cuerpo de
papel y sombra dura. Aparece en la porra de la lista, en el boleto de predicciones, en el bote, en la ficha
de jugador y en el bloque de admin. Es lo que hace que la pantalla se reconozca como La Porra aunque se
cambie el logo.

## 9. Movimiento

MOTION 1: solo `hover`, `active` y `focus-visible` en controles, más la subida de las hojas (200ms). Motivo:
el foco y el pulsado son información, no adorno, y cualquier animación de entrada se comería la atención del
campo de marcador que el usuario está rellenando.

- **El punto de directo es estático.** Motivo: marca un estado real (en juego, descanso) y no necesita
  latido; un bucle infinito compite con el contenido y contradice MOTION 1.
- **El conmutador de sección activo lleva borde de tinta, no solo color.** Motivo: el relleno claro del
  segmento activo no se distingue del fondo por contraste no textual, así que el estado se marca con forma.

El foco visible es **un anillo de tinta de 3px con separación de 2px** (14.52:1 sobre papel); sobre las
cabeceras oscuras el anillo pasa a dorado (10.07:1). Motivo: el foco tiene que verse tanto en el papel como
en la tinta.

## 10. Decisiones y su motivo en una línea (R-31)

| Decisión | Motivo |
|---|---|
| Rojo de cartel en vez de azul de producto | El azul de panel técnico es el color por defecto de la IA; el rojo de aviso es el de la imprenta de barrio. |
| Dos rojos (relleno y texto) | Uno solo obliga a elegir entre identidad y contraste AA. |
| Papel cálido en vez de blanco | El blanco puro convierte el boleto en formulario administrativo. |
| Cantos rectos | Es papel troquelado; la pastilla redondeada es la forma por defecto de la IA. |
| Borde grueso de tinta | Sin filete, el papel claro se funde con el fondo claro. |
| Sombra dura solo en tarjetas y boleto | Marca la elevación de lo que se lee de cerca; el resto se mantiene plano. |
| Archivo Black en titulares | Palo pesado de rótulo, legible en mayúscula pequeña y ya cargado por la app. |
| Cifras tabulares | Puntos y minutos se comparan en columna. |
| El sello real LP como marca | Es el activo de marca que existe; no se inventa logo. |
| Glifos propios en vez de emoji | El emoji trae color y dibujo de otra familia; el glifo dice lo que etiqueta. |
| Lista de boleto para los partidos | Un partido se rellena como una casilla de quiniela, no como una tarjeta de dashboard. |
| Rejilla solo en la baraja | Las cartas son piezas homogéneas; los partidos tienen estado y marcador y piden fila. |
| Bloque oscuro solo en cabeceras | La mancha oscura identifica el boleto; cubrir la página entera con ella sería un dashboard. |

## 11. Qué no es

- No es neón ni "Stadium Night": ese es el tema oscuro por defecto de la app y aquí no se toca.
- No es glassmorphism, ni glow, ni rejilla de fondo decorativa, ni badges de cápsula.
- No es una copia de Biwenger ni de Comunio. Comparte el dominio (porra de fútbol), no el lenguaje visual.
- No usa voseo ni jerga: el texto de la interfaz va en español neutro profesional.

## 12. Alcance y honestidad del mockup

- El mockup cubre **solo el tema taberna**. No lleva control de tema: en Perfil, la fila "Tema" es texto
  informativo sin control, porque el dueño ya decidió taberna y un control muerto sería un defecto.
- **Datos:** la sala "Porra Infelices" (código `F884F7`), los nombres y los puntos de la Jornada 7 son
  reales de la sala. Los horarios, los marcadores, los goleadores, el acumulado General, los exactos y
  aciertos y el bote son **valores de ejemplo**, declarados como tales en la barra del prototipo y en las
  vistas afectadas.
- **Fuentes:** el mockup no usa CDN. Pide `Archivo Black` e `Inter` por nombre y cae a `Arial Black` e
  `Impact` cuando la máquina no las tiene; la app real las carga en su build. La forma del cartel no depende
  de tener la fuente exacta.
- **Verificación:** todos los pares texto/fondo se comprobaron con `contrast-check.py` (WCAG 2.x) y pasan
  AA. Los pares que fallaban en el tema actual se corrigieron en el mockup y quedan anotados en
  `odd/tasks/lpo-redesign-mockups.md`.
- **Registro:** la v1 del mockup, rechazada por reskin, se conserva en `v1-reskin.html`, con su barra de prototipo y sus capturas, como registro de lo descartado.

## 13. Macroestructura: la planilla de boleto

La v1 reproducía la estructura de la app: misma cabecera, un boleto con cabecera oscura cuyas filas eran
escudo-input-input-escudo, tira de jornadas y tres pestañas. El dueño la rechazó porque no veía cambios
significativos: cambiar el color no es rediseñar. La v2 cambia la **macroestructura**. La jornada deja de ser
una pila de tarjetas y pasa a ser **una planilla de quiniela**.

**La planilla es la superficie principal.** En Sala · Predicciones, los 10 partidos de la jornada viven en
un solo cartel, con un renglón por partido y columnas alineadas:

| Columna | Contenido |
|---|---|
| Hora | Día y hora del partido; el título de la celda lleva el cierre completo. |
| Local | Escudo y nombre alineados a la derecha, contra el marcador. |
| Marcador | Dos campos de 44x44 con cifras tabulares; en partidos ya jugados, el resultado con tu porra debajo. |
| Visitante | Escudo y nombre alineados a la izquierda. |
| ×2 | Casilla marcable de Finalissima. |
| Estado | ABIERTO, CERRADO, EN JUEGO, DESCANSO, FINAL o POR CONFIRMAR. |
| Marcas | Glifos de las cartas jugadas en ese partido, con título. |

**Motivo de cada decisión:**

| Decisión | Motivo |
|---|---|
| Un renglón por partido | Una quiniela se rellena leyendo en columna; una tarjeta por partido convierte cada partido en una pantalla. |
| Columnas alineadas y cifras tabulares | Los marcadores se comparan en vertical; sin ancho fijo los dígitos bailan al escribir. |
| Filete fino entre renglones | La línea de corte separa partidos sin crear diez cajas; diez bordes gruesos serían diez tarjetas. |
| Sin tarjeta por partido | El boleto es uno; el partido es una fila dentro del boleto. |
| El estado va en su columna, no en una barra a la izquierda | Una barra a la izquierda es adorno; la columna dice el estado con palabra y la fila se tiñe. |
| El tinte de fila distingue en juego y final | Marca el estado en toda la fila sin añadir un segundo borde. |
| La ×2 es una casilla de la planilla | En la app es un botón centrado bajo cada partido; en una quiniela la casilla va en su columna. |
| Las marcas de cartas van en su columna, con título | El glifo dice qué carta se jugó sin abrir el detalle del partido. |
| Las acciones pendientes (espía, rueda de prensa) bajan al zócalo | Son tareas de la jornada, no adornos de una fila; en el zócalo se ven y se pulsan. |
| Móvil: la planilla comprime en columnas, no se apila en tarjetas | Apilar sería volver a la app actual; con hora, partido y marcador se sigue leyendo como planilla. |
| En móvil el nombre va en TLA | A 390 px el nombre completo no cabe junto a la hora y el marcador; la sigla es la forma impresa de la quiniela. |
| En móvil la microlínea solo aparece con ×2 o cartas | Solo cuando hay algo más que un marcador; si no, el renglón se queda en una línea. |
| La planilla no hace scroll horizontal en ningún ancho | La jornada se lee de una pieza; el scroll horizontal rompería la lectura por columnas. |
| Cabecera de planilla con jornada, cierre, contador y sello | El estado de envío es lo primero que se consulta al abrir la jornada. |
| Zócalo con el aviso de autoguardado | El aviso es una nota al pie, no un titular: el autoguardado ya existe y no necesita protagonismo. |

**El resto se reordena alrededor de la planilla:**

| Pantalla | Macroestructura nueva | Motivo |
|---|---|---|
| Mis porras | Un cartel por sala con tu posición, lo que te queda por rellenar y la acción «Rellenar la planilla». | Al entrar se pregunta qué falta, no qué salas existen. |
| Sala · Ranking | Tabla densa (puesto, jugador, exactos, aciertos, puntos) con el podio como cabecera. | Se compara en columna; las medallas en tarjetas ocupan pantalla sin dar un dato más. |
| Sala · Cartas | Tu carta es el cupón de la jornada, con «Abrir sobre», y la baraja es una lista de renglones. | El cupón es un objeto que se abre; la baraja es un catálogo, y un catálogo se lee en lista. |
| Detalle, ficha y admin | Hojas con tablas y bloques en el lenguaje de la planilla. | Lo que se abre encima mantiene la misma lectura. |
| Auth, crear, unirse, nueva contraseña y perfil | Cartel con formulario en columnas: etiqueta a la izquierda, campo a la derecha. | Un formulario alineado se rellena en vertical sin saltar entre tarjetas. |

**Navegación.** La v1 llevaba la tira de jornadas y las tres pestañas en una barra inferior fija más una fila
superior. La v2 concentra la sección en una barra de pestañas sobre la planilla y deja la jornada en la
cabecera de la planilla, con anterior y siguiente. Motivo: la planilla es la pantalla, y dos barras fijas le
comían 108 px de alto en móvil.

**Propuesta nueva: abrir el sobre.** La app entrega la carta ya repartida. Aquí el cupón llega cerrado y
«Abrir sobre» descubre la carta antes de usarla, con «Cómo funciona» al lado. Es una propuesta, no una copia
de la app.

**Límite honesto del móvil.** A 390x844 la planilla mide 1043 px y no entra sin scroll vertical: seis
renglones llevan microlínea de 44 px, el pie acumula tres acciones reales y la cabecera lleva jornada,
cierre, contador y sello. Se prefirió eso a bajar los campos de marcador por debajo de 44 px, que es el
mínimo de pulsación. No hay scroll horizontal, las columnas siguen alineadas y ningún nombre se recorta.
