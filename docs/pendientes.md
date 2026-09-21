# Pendientes

Lista corta de lo que falta hacer, para no depender de la memoria. El **porqué**
de cada decisión ya tomada está en [`AGENTS.md`](../AGENTS.md); acá va solo lo
que queda por hacer.

Escrito el **2026-09-20**. Si algo se hace, se tacha acá y se registra en `AGENTS.md`.

---

## Primero a hacer cuando leas pendientes. Poner un link en telegram a la tarea de ser posible
-- Cuando me llega el telegram, que pueda abrir el link para ir a la app. Ahí ya vería la tarea

## ~~Ver que pueda poner 2 alertas~~ ✅ Hecho el 2026-09-20

No era un bug: el selector existía, pero **escondido en los tres puntitos**.
*"Sí está. En los 3 puntitos. No lo había visto."* — tercera vez que pasaba lo
mismo.

Ahora el ícono de Telegram de **la tarjeta** abre un globo con **dos casillas
independientes**: "A la hora" y "Antes (X)". Se pueden tildar las dos, una, o
ninguna — y destildar las dos apaga el aviso.

Lo que antes no se podía y ahora sí: **solo el aviso anticipado**, sin el de la
hora. Ver punto 7m de `AGENTS.md`.

- [ ] **Falta probarlo de punta a punta**: que lleguen los dos mensajes de
      verdad. Se verificó la interfaz y que se guarda, no el envío.

## ~~Notificaciones en la misma app~~ ✅ Código hecho el 2026-09-20

Ver punto 7n de `AGENTS.md`. Se arreglaron cuatro cosas: faltaba la clave
pública en Vercel, el `sw.js` con el manejador de push nunca se había subido,
al celular le llegaba el HTML de Telegram a la vista, y `/api/push-token`
aceptaba cualquier `uid` sin verificar.

- [x] ~~Cargar `VITE_VAPID_PUBLIC_KEY` en Vercel~~ ✅ hecha y verificada en el
      JS publicado.
- [ ] ⚠️ **`VAPID_PRIVATE_KEY` está cargada pero `web-push` la rechaza.** El
      diagnóstico del Worker decía `las claves no sirven`. Las dos variables
      existen, así que es un problema de formato, y no es un espacio (ya se
      les hace `.trim()`).

      **Próximo paso, uno solo:** abrir la URL del Worker
      (`hoysi-despertador.imprenart.workers.dev`) y leer el campo `push`.
      Ahora dice cuál de las dos claves está mal, qué tiene de malo y cuánto
      mide cada una. La pública sana mide **87** y la privada **43**; un 44
      suele ser un `=` de más y un 45+ comillas al pegarla.

      Si hay que generar un par nuevo: **la privada no se pega en una
      conversación** (es el error por el que hubo que rotar el token del bot).
      Y ojo, cambia también la pública: hay que actualizar las dos variables.

- [ ] **Probar que llegue un aviso push de verdad**, con la app cerrada.
      Telegram ya está probado y llega bien, con los dos avisos (el anticipado
      y el de la hora).
- [ ] **Elegir el sonido** en Ajustes → Aplicaciones → Chrome → Notificaciones
      → Sitios → `tareas.ginialtech.com`. La app no puede elegirlo (ver 7n).
- [ ] Confirmar que `firestore.rules` con el camino `users/{uid}/config/push`
      esté desplegado (`bun run rules`). Sin eso el navegador no puede guardar
      la suscripción.

## ~~Toast para instalar~~ ✅ Hecho el 2026-09-20

No existía el código: los navegadores no muestran nada solos. Verificado en el
navegador (Chrome lo ofrece y el cartel aparece con botón **Instalar**).

- [ ] **Verlo en un celular de verdad**, y en iPhone que la instrucción de
      *Compartir → Agregar a inicio* se entienda.
- [ ] Hoy el cartel vuelve a aparecer en cada visita hasta que la instales:
      recordar que lo cerraste implicaría guardar algo en el navegador, y eso
      **se pregunta primero** (punto 7e de `AGENTS.md`).

## 1. Mobile first

> **El nombre correcto es "mobile first"** (móvil primero). No es "first mobile".
> Regla para acordarse: **primero el celular**, después la pantalla grande.

**Qué significa:** los estilos base —los que están sin ningún `@media`— son los
del celular. Las pantallas grandes se agregan después, con `@media (min-width: …)`.
Lo contrario (lo que hay hoy) es *desktop first*: se diseña para la compu y se
parchea el celular al final.

**Cómo está hoy:** `src/index.css` son 1037 líneas pensadas para pantalla
grande, con **un solo bloque** `@media (max-width: 620px)` al final (línea 1024)
que arregla lo que se rompe. Hay 7 `max-width` en total. O sea: hoy la app es
desktop first.

**Por qué importa acá:** esta app se usa parada en el pasillo con el celular en
la mano — que es justo el momento en que se anota lo que se viene pateando. Si
la pantalla chica es un parche, ese momento se pierde.

**Qué habría que hacer:**

- [x] ~~Dar vuelta `src/index.css`~~ ✅ **2026-09-20.** Ya no queda ningún
      `@media (max-width: …)`: los estilos base son los del celular y hay un
      solo bloque `@media (min-width: 620px)` con lo que cambia en pantalla
      grande.
- [x] ~~44 × 44 px en lo que se toca~~ ✅ El círculo de tachar llega a 44 (se ve
      de 26: el área grande se logra con padding y `background-clip`, así que
      no se agranda el dibujo). *Empecé*, los filtros y los íconos de aviso
      quedaron en 40. En pantalla grande vuelven todos a ser compactos.
- [x] ~~Formulario al alcance del pulgar~~ ✅ En el celular queda **fijo abajo**,
      con `env(safe-area-inset-bottom)` para no quedar debajo de la barra de
      gestos del iPhone. En pantalla grande vuelve arriba, al flujo normal.
- [ ] **Probar con el teclado del celular abierto**: que no tape el botón
      *Anotar*. ⚠️ Sin verificar — el teclado no se puede simular desde acá.
- [ ] **Verificarlo en un teléfono de verdad.** ⚠️ Sin verificar: la ventana del
      navegador no se dejó achicar (estaba maximizada), así que la comprobación
      fue leyendo las reglas CSS cargadas, no mirando el render.

> Ojo con no romper nada de lo que ya está decidido al tocar el CSS: el rojo
> sigue reservado para lo que de verdad se pasó (punto 7c de `AGENTS.md`) y el
> confeti sigue respetando `prefers-reduced-motion`.

---

## 2. Modo claro y oscuro (y el predeterminado)

Hoy la app es **solo oscura**. Los tokens de color están todos arriba de
`src/index.css`, así que medio trabajo ya está hecho: falta **inventar la paleta
clara**, no reacomodar el archivo.

**Son tres estados, no dos:**

1. **Claro**
2. **Oscuro**
3. **El del sistema** ← este es el **predeterminado**. Si nunca elegiste nada, la
   app usa lo que tenga puesto el teléfono o la compu (se lee con
   `prefers-color-scheme`). Si elegís a mano, se recuerda tu elección.

O sea que el control tiene tres opciones, no es un interruptor de dos. Y "volver
al predeterminado" tiene que ser una opción alcanzable, no algo que se consiga
borrando datos del navegador.

- [ ] Paleta clara.
- [ ] Control de tres estados + recordar la elección.
- [ ] Cambiar el `theme-color` de `index.html`, que hoy está clavado en
      `#0d0f14`. Si no, la barra del navegador queda oscura con la app clara.

> **Cuidado al armar la paleta clara:** no es "aclarar" los colores de ahora. El
> ámbar de los 7 días y el rojo de lo que se pasó tienen que seguir leyéndose
> como lo que son sobre fondo blanco, con contraste suficiente. Y sigue firme la
> regla del punto 7c de `AGENTS.md`: **el rojo es solo para lo que de verdad se
> pasó**, nunca para meter presión.

> Conviene hacerlo **en la misma pasada que el punto 1**: es el mismo archivo.
> Pero primero mobile first y después los colores — dos refactors del CSS al
> mismo tiempo es cómo se rompen las dos cosas.

---

## 2b. El header: está todo inline

Tres cosas que aparecieron juntas el **2026-09-20** y son la misma pasada, porque
las tres son el mismo pedazo de pantalla.

**a) Menú hamburguesa.** Hoy está todo inline, uno al lado del otro. Ahí adentro
van a vivir el selector de tema del punto 2, el nombre, salir y la configuración
de Telegram — así que **conviene hacerlo antes que el selector de tema**, o hay
que ubicarlo dos veces.

- [x] ~~Menú hamburguesa con lo que hoy está suelto en el header.~~
      ✅ **Hecho el 2026-09-20.** Adentro: nombre, Configuración, estado de
      Telegram y Salir. El botón mide 44 × 44 px.
- [ ] Cuando se haga el selector de tema (punto 2), va **adentro de este menú**.
- [ ] Decidir si en pantalla grande sigue así o cambia. Por ahora es igual en
      las dos medidas; la respuesta sale sola al hacer mobile first.

**b) Elegir qué nombre mostrar.** Hoy muestra el que trae Google. Poder poner el
que una quiera.

- [x] ~~Campo para el nombre propio, con el de Google como valor inicial.~~
      ✅ **Hecho el 2026-09-20**, en Configuración → Tu nombre. Vacío = el de
      Google, que aparece como sugerencia en gris.
- [x] ~~Decidir dónde se guarda:~~ **Firestore**, así te sigue al celular. Vive
      en `users/{uid}/config/perfil`, **en un documento aparte del de avisos**:
      las reglas no dejan que el navegador escriba el chat de Telegram, y como
      la regla mira el documento entero, tenerlos juntos haría que guardar el
      nombre arrastrara el chat y fuera rechazado. Ver punto 7k de `AGENTS.md`.

**Por qué igual hay que tocar `firestore.rules` para un campo más** (la pregunta
salió y la respuesta no es obvia):

No es por validar el campo. Es porque **Firestore niega por defecto todo camino
que no esté declarado**. Al final de `firestore.rules` hay un
`match /{document=**} { allow read, write: if false; }` que cierra todo lo demás.

Hoy están abiertos **tres** caminos y nada más: `users/{uid}/tasks/{taskId}`,
`users/{uid}/config/{doc}` y `vinculos/{codigo}`. Un nombre no es una tarea, así
que necesita su propio lugar declarado.

Y ojo con la salida fácil de meterlo en `config`, que ya existe: la función
`esConfigValida()` exige que `telegramChatId` sea `null` en lo que se escribe —
y en una escritura con *merge* lo que se valida es **el documento completo
resultante**, no solo el campo que tocaste. O sea que **apenas alguien vincula
Telegram, el navegador ya no puede volver a escribir ese documento**. Está bien
que sea así (el chat lo pone el servidor, no el cliente), pero significa que el
nombre no puede vivir ahí.

Es un toque chico igual: una regla nueva para el documento del perfil.

**c) Sacar el cartelito de "Guardado en la nube".** Confirmado el 2026-09-20: es
**el cartelito**, no el guardado en la nube en sí. Firestore se queda.

**Decidido:** el cartelito **aparece solo cuando hay un problema** y no se ve
cuando todo anda bien. Silencio quiere decir que está guardado.

Casos en los que sí tiene que aparecer:

- Error de conexión con la nube.
- El celular **sin datos móviles activados**.

**Cuando aparece, va en rojo y con un botón para reintentar.** Es la excepción a
la regla del rojo (punto 7c de `AGENTS.md`): acá el rojo está bien, porque algo
salió mal de verdad — no le está reclamando nada a la persona.

- [ ] Que el estado de guardado se muestre solo cuando falla.
- [ ] En rojo, diciendo que **no se guardó**, con botón de **Reintentar**.

> El botón es más trabajo de lo que parece: para reintentar hay que **acordarse
> de qué escritura falló**. Hoy las escrituras pasan por el helper `run()` de
> `useTasks`, que devuelve `true`/`false` y ahí termina — nadie se guarda la
> operación que no salió. Reintentar significa retenerla hasta que funcione.

- [ ] **Borrar `todo-list:tasks:v1` del navegador al cerrar sesión.** Hoy
      `signOut` solo cierra la sesión de Firebase y **las tareas quedan guardadas
      en esa computadora**, legibles para quien la use después. Sale directo de
      la regla de seguridad del punto 7e de `AGENTS.md`.
      ⚠️ Ojo con el orden: si todavía hay cosas que nunca subieron a la nube
      (punto 2c), **borrarlas al cerrar sesión las pierde para siempre**. Primero
      la migración, después el borrado.

> Ya quedó corregido el punto 7b de `AGENTS.md`, que decía que el badge tenía que
> estar siempre visible. Esa regla se había escrito sin consultarla.

---

## 2c. ⚠️ Averiguar dónde están guardadas las tareas hoy

**Pregunta abierta del 2026-09-20: en la consola de Firebase no se ve ninguna
colección.** Hay que resolverlo antes que lo demás, porque de la respuesta
depende si hay tareas en riesgo.

La app guarda en `users/{uid}/tasks` (`src/lib/store.firestore.ts`), y si la nube
falla **cae sola a guardar en el navegador** y sigue andando. Esa es la sospecha
principal: hasta ayer el dominio no estaba autorizado y las reglas rechazaban
escrituras (punto 4), así que **es probable que las tareas nunca hayan llegado a
la nube** y estén en la computadora, bajo la clave
`todo-list:tasks:v1` de localStorage.

Cómo confirmarlo, en orden y sin tocar código:

- [ ] Abrir la app y mirar **el cartelito** de arriba a la derecha: dice
      "Guardado en la nube" o "Solo en esta compu". Esa es la respuesta directa.
      *(Sí: es justo el cartelito del punto 2b. Cuando se haga ese cambio, que el
      estado siga estando disponible en algún lado — dentro del menú del punto
      2b-a, por ejemplo — aunque no esté siempre a la vista.)*
- [ ] En la consola de Firebase, confirmar que es el proyecto
      **`todo-list-846e2`** y la base **`(default)`**.
- [ ] Buscar la colección **`users`** en la raíz. El documento `users/{uid}` en sí
      **nunca se crea**: la app escribe directo en la subcolección `tasks`. La
      consola igual muestra el `uid` listado en gris o itálica, y las tareas están
      adentro. Que el id se vea apagado **no** quiere decir que no haya nada.
- [ ] Si efectivamente no hay nada en la nube: las tareas de la compu **no suben
      solas**. Es el pendiente viejo del punto 6 de `AGENTS.md`, que ahora deja de
      ser teórico. **No borrar los datos del navegador ni cerrar sesión hasta
      resolverlo.**

---

## 3. Convertirla en PWA

**Respuesta corta: sí se puede, y es de las cosas más baratas que quedan por hacer.**

Una PWA es una web que el celular deja **instalar como si fuera una app**: queda
con su ícono en la pantalla de inicio, abre sin la barra del navegador y puede
funcionar sin internet.

La app ya cumple casi todos los requisitos sin haber hecho nada a propósito:

| Requisito | Cómo está |
|---|---|
| HTTPS | ✅ ya, en `tareas.ginialtech.com` |
| Es una sola página, sin servidor de por medio | ✅ Vite + React, sale todo a `dist/` |
| `theme-color` y `apple-touch-icon` | ✅ ya están en `index.html` |
| Funciona sin conexión | ⚠️ a medias: si no hay nube cae a guardar en la compu (punto 6 de `AGENTS.md`), pero **el sitio no carga** sin internet |
| Archivo `manifest.webmanifest` | ❌ falta |
| Íconos de 192 y 512 px | ❌ falta (hoy hay uno de 180 × 180 y los SVG) |
| Service worker | ❌ falta |

**Qué habría que hacer:**

- [ ] Agregar `vite-plugin-pwa` (`bun add -d vite-plugin-pwa` — **bun, nunca npm**)
      y configurarlo en `vite.config.ts`. Genera el manifest y el service worker solo.
- [ ] Generar los íconos **192 × 512 px**, más una versión *maskable* (con margen,
      para que Android no le recorte las puntas). El `public/logo.svg` sirve de origen.
- [ ] Manifest: nombre "Hoy sí", `display: standalone`,
      `theme_color: #0d0f14`, `start_url: /`.
- [ ] Probar la instalación en Android y en iPhone (en iPhone se instala desde
      *Compartir → Agregar a inicio*; no aparece el cartelito solo).

**Tres cosas que van a morder si no se tienen en cuenta:**

1. **El login con Google.** `useAuth.ts` usa `signInWithPopup`. Una ventana
   emergente dentro de una app instalada (sin barra de direcciones) se comporta
   raro o directamente no vuelve. Hay que probarlo instalada y, si falla,
   cambiar a `signInWithRedirect`.
2. **El service worker no puede cachear `/__/auth/*` ni `/api/*`.** La primera
   es la ruta que `vercel.json` redirige a Firebase para el login; la segunda son
   los logs y Telegram. Si el service worker las intercepta, se rompen las dos.
   Van en la lista de exclusiones del plugin.
3. **Offline de verdad = dos mitades.** El service worker hace que *cargue* la
   pantalla sin internet. Para que además estén **las tareas**, hay que activar
   la persistencia de Firestore (`persistentLocalCache` en `getFirestore`, hoy
   `src/lib/firebase.ts` usa el default). Sin eso, la app instalada abre vacía
   en el subte.

> Y el pendiente viejo se agranda: si la app se puede usar sin conexión, lo que
> se guarda en modo local **tiene que poder subir a la nube después**. Eso hoy
> no existe (punto 6 de `AGENTS.md`). No prometer sincronización en pantalla
> hasta que esté escrita.

---

## 4. Lo que sigue trabado esperando a una persona

Viene de `AGENTS.md`, repetido acá porque es lo que frena todo lo demás.

- [x] ~~**Autorizar el dominio**~~ — hecho el 2026-09-20, verificado contra la
      API de Identity Toolkit.
- [x] ~~**Desplegar las reglas con `dueTime`**~~ — hecho. Además hubo que
      arreglarlas: leían `d.dueTime` directo y **eso rompía toda escritura sobre
      las tareas viejas**, que no tienen ese campo. Ahora todo campo opcional se
      lee con `d.get('campo', default)`.
- [ ] **Revocar la clave vieja de la cuenta de servicio** que se borró del disco
      pero sigue viva en Google Cloud: IAM → Cuentas de servicio →
      `firebase-adminsdk-fbsvc@todo-list-846e2` → Claves.
      ⚠️ Ojo: **no revocar la nueva**, que es la que usa `FIREBASE_SERVICE_ACCOUNT`
      en Vercel y hace andar el bot.
- [x] ~~**Rotar el token del bot de Telegram.**~~ ✅ Hecho el 2026-09-20:
      revocado en @BotFather y el nuevo ya cargado en Vercel. Los avisos
      siguen llegando.

---

## 5. Telegram: vinculado, pero todavía no avisa

Estado al cierre del **2026-09-20**. El punto 7h de `AGENTS.md` quedó viejo:
decía que Telegram estaba apagado y ya no lo está.

**Lo que anda y está probado en producción:**

- Bot `@hoysi_tareas_bot`, webhook registrado en `/api/telegram`.
- Vinculación **de un toque**: la app arma un código de un solo uso, lo mete en
  el link del bot y el servidor ata el chat a la cuenta. Sin copiar ni pegar.
- Pantalla de **Configuración** con el estado en vivo.
- `FIREBASE_SERVICE_ACCOUNT` cargada y conectando a Firestore.

**Lo que falta, y es lo único que importa ahora:**

- [ ] **Nadie despierta a la hora justa.** Falta la tarea programada (Vercel
      Cron) que mire qué tarea está por vencer y mande el mensaje.
- [ ] Marcar la tarea como "ya avisada" para no mandar el aviso en loop.
- [ ] Decidir si el aviso es por tarea (elegible) o para todas las que tengan
      hora. Hoy el botón de Telegram en la tarea **solo informa**, no elige.

---

## 5b. ⚠️ `tsc --noEmit` no sirve en este proyecto

**Hallazgo del 2026-09-20, verificado rompiendo el código a propósito.**

`tsconfig.json` tiene `"files": []` y solo referencias. Entonces:

| Comando | Con un error real en `api/` |
|---|---|
| `bunx tsc --noEmit` | **pasa, salida 0** ❌ |
| `bunx tsc -b` | falla correctamente ✅ |

O sea que el comando de la regla de oro de ginialym **acá miente siempre**, no
solo con ese bug. Por eso existe ahora **`bun run check`** (= `tsc -b`), que es
el que hay que correr, y el que ya corre `bun run build` por dentro.

- [ ] Ver si en ginialym pasa lo mismo. Si ese `tsconfig.json` también usa
      referencias con `files: []`, la regla de oro de ahí está apoyada en un
      comando que no chequea nada.

---

## 6. IA con Groq — sin decidir

> **Va después de que anden las alertas de Telegram.** Decisión del 2026-09-20:
> primero se termina lo que está a medio hacer (punto 5), recién después se
> abre este frente.

Lo que hay hasta ahora es **las ganas de probar el SDK de Groq, en plan
gratuito**. Qué tiene que hacer: todavía no se sabe, y no hace falta saberlo hoy.
Que quede anotado alcanza.

El filtro para cuando aparezca la idea es el de siempre: **si no ayuda a
arrancar, no va.** Una todo list con IA que resume o clasifica o etiqueta es una
todo list más pesada, no una que te haga empezar.

Candidatos anotados, ninguno elegido:

- Partir una tarea grande en pasos chicos ("limpiar" son en realidad 6 cosas).
- Reescribir el título vago en la primera acción concreta, una sola línea.
- Estimar cuánto va a llevar, para comparar después con lo que tardó de verdad.

Dos cosas que ya están resueltas para cuando llegue el día, sea cual sea la idea:

- **La clave de Groq nunca toca el navegador.** Va en una ruta de `api/`, igual
  que `api/log.ts` y `api/telegram.ts`. (`AGENTS.md` punto 7e dice "Cloudflare
  Worker", pero eso se escribió antes de que existiera `api/`: hoy ya hay
  funciones de servidor en Vercel y son un lugar menos donde buscar.)
- Si lo que devuelve son **pasos**, entran como **notas** de la tarea. Las notas
  ya existen y ya están validadas: no habría que tocar el modelo de datos ni
  volver a desplegar las reglas.

> **Regla de esta lista:** lo que se te ocurra en el medio de otra cosa se anota
> acá y se sigue con lo que estabas haciendo. Arrancar algo chico y agrandarlo
> sobre la marcha es la forma más segura de quedarse con dos cosas a medias — que
> es justo lo que la app viene a combatir, aplicado a la app misma.

---

## 7. Ideas, no pendientes

Están en el punto 9 de `AGENTS.md` (subtareas con Groq, tareas recurrentes, modo
"5 minutos", historial de la semana). No son deuda: antes de agarrar alguna,
preguntarse si ayuda a **arrancar**. Si no, no va.
