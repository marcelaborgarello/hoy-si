# AGENTS.md — memoria del proyecto

Bitácora de decisiones y contexto para cualquier agente (o para mí mismo en tres
semanas cuando no me acuerde de nada). **Se actualiza cada vez que se decide algo.**

---

## 1. Qué es esto

Una todo list personal. La de Windows no le gusta al dueño del proyecto, y el
objetivo real no es "gestionar tareas": es **vencer la procrastinación**. Todo lo
que se agregue tiene que servir a eso. Si una función no ayuda a arrancar o a
sentir que avanzaste, sobra.

Frase textual del pedido: *"Estoy poniendo en tus manos que me des la motivación
para hacer cosas que siempre pospongo o postergo mucho."*

Ejemplo concreto que dio: **odia limpiar**, pero tiene que hacerlo.

## 2. Requisitos pedidos (checklist)

- [x] Título y descripción por tarea
- [x] Registrar **cuándo empecé** y **cuándo terminé**
- [x] Fecha (límite) opcional
- [x] Guardar de verdad (persistencia)
- [x] Notas dentro de cada tarea
- [x] React (Next.js solo si hiciera falta — no hizo falta)
- [x] Este AGENTS.md

## 3. Stack y decisiones

| Decisión | Elección | Por qué |
|---|---|---|
| Framework | **React 19 + Vite** | El pedido fue "mínimo React". No hay servidor ni SEO ni rutas: Next.js sería peso muerto. |
| Lenguaje | **TypeScript** | Pedido explícito. |
| Validación | **zod** | Pedido explícito. Valida lo que vuelve de Firestore/localStorage: si un doc viene roto, se descarta esa tarea en vez de romper la app entera. |
| Gestor de paquetes | **bun** | Pedido explícito. Usar `bun` / `bunx`, **nunca** `npm`. |
| Base de datos | **Firestore** | Pedido explícito ("para variar"). |
| Estilos | **CSS plano** con custom properties en `src/index.css` | Sin dependencias extra. Tema oscuro, todos los tokens arriba del archivo. |

### Decisión clave: storage enchufable

`src/lib/store.ts` define una interfaz `TaskStore` y elige el backend **en
tiempo de arranque**:

- Config de Firebase completa en el `.env` → **Firestore** (tiempo real, `onSnapshot`).
- Falta alguna variable, o Firestore falla al iniciar → **localStorage**.

Motivo: que la app nunca quede inutilizable por un tema de credenciales. Un error
de setup no puede ser la excusa para no usarla. El badge arriba a la derecha
siempre dice dónde se está guardando.

## 4. Estado de Firebase

- Proyecto: **`todo-list-846e2`** (número `904079703992`).
- App web registrada el 2026-09-19 vía CLI: `Todo List Copada`,
  appId `1:904079703992:web:57fd01515241761e84d94d`. Antes **no existía** ninguna
  app web, y por eso faltaban `apiKey` y `appId` en el `.env`.
- El `.env` usa prefijo **`VITE_`**. Sin ese prefijo Vite no las expone al
  navegador — era el segundo error del `.env` original.
- La `apiKey` web **no es un secreto** (viaja en el bundle de toda app web de
  Firebase). Lo que protege los datos son las **Reglas de Seguridad**.

### Seguridad

Se borró el JSON de **cuenta de servicio** (`*-firebase-adminsdk-*.json`) que
estaba en la raíz: contenía una clave privada y no se usa en una app de
navegador. Quedó en `.gitignore` por las dudas.

> ⚠️ **TODO**: esa clave sigue existiendo en Google Cloud aunque el archivo ya no
> esté. Conviene revocarla en
> IAM → Cuentas de servicio → `firebase-adminsdk-fbsvc@todo-list-846e2` → Claves.

## 4b. Decisión de arquitectura: auth y reglas

Surgió esta duda, y vale dejarla escrita porque es un malentendido muy común:

> *"No se pueden cambiar las reglas, esas hay que manejarlas del backend. Sino
> por más login que tenga es un riesgo."*

**Las Security Rules de Firestore ya son backend.** `firestore.rules` no se
evalúa en el navegador: se despliega a Google y se ejecuta **en sus servidores,
en cada operación**. Un atacante puede reescribir todo el JS del cliente o pegar
requests con curl — no puede tocar las reglas. `request.auth` lo arma Google
verificando la firma del ID token, así que tampoco se puede falsear el uid.

Lo que **sí** era un riesgo real (y estaba bien desconfiar) eran las reglas
abiertas `allow read, write: if true` de la primera versión.

Un backend propio se justificaría si hiciera falta lógica que las reglas no
pueden expresar: llamar a otras APIs, guardar secretos, validaciones complejas,
tareas programadas. Para "cada usuario ve solo sus tareas", las reglas alcanzan.

**Decisión tomada: Firebase Auth con Google + reglas por `uid`. Sin backend propio.**

Consecuencias en el código:

- Las tareas viven en **`/users/{uid}/tasks/{taskId}`**, no en `/tasks`.
- El store dejó de ser un singleton: `createStore(uid)` lo crea **por usuario**,
  y `useTasks(uid)` lo recrea si cambia la sesión. Así las tareas de una cuenta
  no se filtran a otra al cambiar de usuario.
- Sin login no hay app (`App.tsx` muestra `<SignIn/>`). Excepción: si no hay
  config de Firebase, sigue el modo local sin login.
- Las reglas además **validan la forma** de cada documento en el servidor
  (tipos, largo del título, status dentro del enum, tope de notas), para que un
  cliente modificado no pueda escribir basura.

## 5. Modelo de datos

Colección `users/{uid}/tasks`, un documento por tarea (`src/types/task.ts`):

```ts
{
  id: string
  title: string
  description: string
  status: 'todo' | 'doing' | 'done'
  createdAt: number       // ms — cuándo la anotaste (mide cuánto la pateás)
  startedAt: number|null  // ms — botón "Empecé"
  finishedAt: number|null // ms — botón "Terminé"
  dueDate: string|null    // 'YYYY-MM-DD'
  notes: { id, text, createdAt }[]
}
```

Las fechas se guardan como **números (epoch ms)**, no como `Timestamp` de
Firestore: así el mismo objeto sirve para localStorage y para Firestore sin
convertir nada, y zod lo valida igual en los dos casos.

Las **notas van embebidas** en el documento, no en una subcolección. Son pocas y
cortas; una subcolección agregaría queries y complejidad sin beneficio.

## 6. Las tres decisiones anti-procrastinación

Esto es el corazón del proyecto, no decoración:

1. **Separar "empecé" de "terminé".** Una tarea tiene tres estados, no dos. El
   botón *Empecé* existe para que arrancar ya cuente como progreso — que es
   justo el paso que más cuesta.
2. **Mostrar la antigüedad.** Cada tarea abierta dice hace cuántos días espera
   (en ámbar a partir de 7). La culpa vaga no mueve; el número concreto sí.
3. **Devolver la evidencia.** Al tachar aparece cuánto tardó *de verdad*
   ("te llevó 12 min"), más confeti y un mensaje. Es la prueba de que casi
   siempre era menos terrible de lo imaginado. La racha 🔥 cuenta días
   consecutivos con al menos una tarea terminada.

El banner de arriba (`nudge()` en `src/lib/motivation.ts`) siempre sugiere **una
sola** acción concreta. Nunca una lista de pendientes en la cara.

## 7. Estructura

```
src/
  App.tsx                 gate de login + <Board/>: layout, filtros, orden, festejo
  types/task.ts           esquemas zod + tipos
  hooks/
    useAuth.ts            login con Google, estado de sesión
    useTasks.ts           suscripción al store + acciones (única fuente de verdad)
  lib/
    firebase.ts           init condicional; isFirebaseConfigured; getDb/getAuthInstance
    store.ts              interfaz TaskStore + createStore(uid)
    store.local.ts        adaptador localStorage
    store.firestore.ts    adaptador Firestore (onSnapshot sobre users/{uid}/tasks)
    factory.ts            buildTask/newId (módulo aparte para evitar ciclo de imports)
    time.ts               formateo de fechas y duraciones en es-AR
    motivation.ts         stats, racha, mensajes
  components/
    SignIn.tsx  TaskForm.tsx  TaskCard.tsx  TaskDetail.tsx  Celebration.tsx
firestore.rules           reglas por uid + validación de forma (se evalúan en Google)
```

### Dos bugs que hay que no repetir

**1. La app quedaba colgada en "Cargando…".** Si la nube rechazaba la lectura,
el `onSnapshot` fallaba y nadie bajaba el flag de `loading`. Por eso
`TaskStore.subscribe` acepta un segundo callback `onError`. Si se agrega otro
backend, **tiene que llamar a `onError`**.

**2. Las escrituras fallaban en silencio** (el peor de los dos). Apretabas
"Anotar" y no pasaba absolutamente nada: la promesa de Firestore se rechazaba,
nadie la agarraba, y la persona se quedaba mirando la pantalla sin saber si
había hecho algo mal. Arreglado así:

- Toda escritura pasa por el helper `run()` de `useTasks`, que captura el error
  y devuelve `true`/`false`.
- `TaskForm` **no borra lo que escribiste** si `add()` devolvió `false`, y el
  botón muestra "Guardando…" mientras tanto.
- **Regla:** ninguna acción del usuario puede terminar sin feedback. Si se
  agrega una acción nueva, va envuelta en `run()`.

### Modo local de emergencia

Si la nube rechaza la conexión, `useTasks` **cambia el store a localStorage**
(`modoLocalPara`, recordado por uid para no reintentar en loop) y avisa en
ámbar: *"No me pude conectar a la nube, así que guardo todo en esta compu"*.

El motivo es el del punto 1 del documento: un problema de infraestructura no
puede ser la excusa para no usar la app. Preferimos guardar en un lugar peor
antes que no guardar.

> ⚠️ **Pendiente conocido:** lo que se guarde en modo local **no migra solo** a
> la nube cuando la conexión vuelve. Si esto se usa seguido, hay que escribir
> esa migración. Hoy no existe: no prometer en la UI que se va a sincronizar.


## 7b. La app se va a compartir: reglas de redacción

Cambió un supuesto del punto 1. Arrancó como "una app para que yo limpie", pero
el usuario **la quiere compartir**, y quien la reciba la va a usar para
cualquier otra cosa. Textual: *"cuando hago cosas me gusta compartirla y a lo
mejor otro la quiere usar para otra cosa"*.

Dos consecuencias, y las dos son reglas firmes de ahora en más:

**1. Cero jerga de programación en pantalla.** Nadie tiene por qué leer
"Firestore", "localStorage", "uid", ni mucho menos un comando de terminal.
Se sacaron:

| Antes | Ahora |
|---|---|
| "Tus tareas quedan en `/users/tu-id/tasks`. Las reglas de Firestore…" | "Tu lista es tuya y de nadie más." |
| "Firestore rechazó la conexión: faltan desplegar las reglas de seguridad" + el comando `bunx …` | "No me puedo conectar para guardar tu lista. Lo que anotes ahora se puede perder." |
| "Guardando en Firestore" / "Guardando en este navegador" | "Guardado" / "Solo en esta compu" |
| "Falta habilitar Google como método de acceso en la consola…" | "No pudimos entrar con esa cuenta. Probá de nuevo." |

El detalle técnico **no se perdió**: va por `console.error`, y además la UI
muestra una pista extra envuelta en `import.meta.env.DEV`, que Vite elimina del
build de producción. O sea: quien desarrolla ve el comando exacto; quien recibe
la app compartida, no.

**2. Nada atado a limpieza.** Se sacó la escoba 🧹 del título y del favicon
(ahora es un ✦ neutro). Los textos ya eran genéricos ("¿Qué venís pateando?") y
así se quedan. Si se agrega copy nuevo, que sirva igual para estudiar, para
trámites o para limpiar.

**Regla derivada:** un mensaje de error tiene que decirle a la persona qué le
pasa a *sus datos*, no qué le pasa al sistema. Y el badge de estado **no puede
mentir**: si Firestore rechaza la conexión muestra "Sin guardar" en rojo, nunca
"Guardado".

## 7c. Las fechas no aprietan

Apareció un "vence hoy" en rojo que generó alarma: *"¿Por qué me dice que vence
hoy???"*. El dato era correcto (la fecha límite era efectivamente hoy), pero la
UI estaba mal en dos cosas:

1. **El campo de fecha estaba siempre visible, pegado al botón Anotar.** Se
   ponía sin querer. Ahora hay que pedirlo con "📅 Ponerle fecha", y tiene una
   ✕ para sacarlo.
2. **"vence hoy" se pintaba de rojo** (`tone: 'late'` con `faltan <= 0`). Rojo
   ahora es **solo** `faltan < 0`, o sea cuando de verdad se pasó.

Y se cambió el vocabulario: "vence hoy" → **"para hoy"**, "vencida hace 3 días"
→ **"se pasó hace 3 días"**. Suena a información, no a reto.

> **Regla:** en esta app el rojo se reserva para lo que de verdad salió mal. Una
> lista que te reta produce más evitación, que es justo lo que venimos a
> combatir (punto 1). La antigüedad en ámbar a los 7 días es el único empujón
> por presión, y alcanza.

## 7d. Hora límite

Las tareas ahora tienen **`dueTime`** (`'HH:MM'`, 24 h) además de `dueDate`.

- La hora **solo aparece si hay fecha**; al sacar la fecha se borra la hora.
- **Sin hora, el límite es el final del día** (`dueMoment()` usa 23:59:59). Una
  tarea "para hoy" no está atrasada a las 9 de la mañana — eso sería volver al
  problema del punto 7c.
- Con hora sí se puede ser preciso: "se pasó a las 18:30".
- `dueTime` tiene `.default(null)` en el esquema zod, así las tareas guardadas
  antes de que esto existiera siguen cargando sin romper nada.

> Las reglas de Firestore validan la forma de cada documento, así que se agregó
> `dueTime` a `esTareaValida()`. **Hay que correr `bun run rules`** para que esa
> validación quede activa (sin eso igual funciona: las reglas viejas no
> rechazan campos que no conocen).

## 7e. Rumbo: infraestructura propia y secretos

Definiciones del usuario que condicionan todo lo que viene:

- **Dominios:** tiene `ginialym.com` (**no mezclar con este proyecto**) y
  `ginialtech.com`. La app iría en **`tareas.ginialtech.com`**.
- **Hosting: Vercel** (las variables de entorno ya están cargadas ahí).
  Cloudflare queda solo como **DNS**, no como hosting.
- **IA:** Groq SDK, **plan gratuito** por ahora.
- **Alertas por WhatsApp** cuando vence una tarea (de ahí la hora del punto 7d).
- **Firebase Hosting quedó descartado** a favor de Vercel. `firebase.json`
  conserva la config de hosting y existe el script `bun run publicar`, pero
  **nunca se ejecutó** y no es el camino elegido. Firebase se usa solo para
  **Auth + Firestore**.

### Conectar tareas.ginialtech.com (Vercel + Cloudflare)

1. **Vercel** → el proyecto → Settings → Domains → Add → `tareas.ginialtech.com`.
   Vercel devuelve el registro DNS que espera.
2. **Cloudflare** → `ginialtech.com` → DNS → Add record:
   - Type **CNAME**, Name **`tareas`**, Target **`cname.vercel-dns.com`**
   - **Proxy status: DNS only (nube GRIS, no naranja)**
3. Volver a Vercel y esperar la verificación. El certificado lo emite Vercel.

> ⚠️ **La nube naranja rompe esto.** Si Cloudflare proxea el subdominio, Vercel
> no puede validar el dominio ni emitir el certificado, y suele terminar en
> error 525/526 de SSL. Es el problema número uno de la combinación
> Vercel + Cloudflare. Tiene que quedar en **DNS only**.

> ⚠️ **Y falta un paso que no es de DNS:** hay que agregar
> `tareas.ginialtech.com` en Firebase Console → Authentication → Settings →
> **Authorized domains**. Firebase Auth rechaza el login desde cualquier dominio
> que no esté en esa lista, así que sin esto **el login con Google falla en
> producción** aunque el dominio resuelva perfecto.

### Requisito de seguridad (palabras del usuario)

> *"si hay que guardar claves privadas. Nunca nada de lo que hacemos tiene que
> poder ser visto desde el navegador. Inyectar un script o nada."*

**Regla dura: ninguna clave privada toca el cliente.** Ni en el bundle, ni en
una variable `VITE_*`, ni en un fetch desde el navegador. Todo lo que necesite
un secreto (Groq, WhatsApp) se llama a través de un **Cloudflare Worker**, con
los secretos cargados vía `wrangler secret put` — que nunca salen del servidor.

Hay que tener presente la distinción, porque se presta a confusión:

| | ¿Visible en el navegador? | ¿Es un problema? |
|---|---|---|
| Config de Firebase (`VITE_FIREBASE_*`) | **Sí**, inevitable | No. Es pública por diseño en toda app web de Firebase; no da acceso a nada. Lo que protege los datos son las reglas (punto 4b). |
| API key de Groq | **Nunca** | Sí. Con esa clave cualquiera consume tu cuota. Va en el Worker. |
| Token de WhatsApp | **Nunca** | Sí. Con eso se mandan mensajes en tu nombre. Va en el Worker. |

> Si el requisito se interpreta al pie de la letra ("que el navegador no vea
> *nada*"), entonces el front tampoco debería hablar directo con Firestore y
> habría que proxear todo por el Worker. Esa es la opción "backend propio" que
> se descartó en el punto 4b — pero **ahora que va a existir un Worker igual
> para Groq y WhatsApp, el costo de esa opción bajó**. Decisión pendiente del
> usuario.

### Pendientes en orden

1. Variables de entorno (lo está haciendo el usuario).
2. Worker en Cloudflare + `tareas.ginialtech.com`.
3. Alertas de WhatsApp: **ojo**, para mandar mensajes proactivos (no como
   respuesta) la API de WhatsApp exige plantillas aprobadas por Meta y una
   cuenta de negocio verificada. Telegram no pide nada de eso — vale evaluarlo
   para tener alertas andando rápido.
4. Groq: las ideas que encajan con el punto 1 del documento son partir una
   tarea grande en pasos chicos y estimar cuánto lleva de verdad.

## 8. Convenciones

- **UI y comentarios en español rioplatense.** Nombres de código en inglés
  (`status`, `createdAt`), textos al usuario en castellano y **sin jerga**
  (ver punto 7b).
- Nada de `window.confirm` / `alert`: confirmación en dos pasos dentro del panel.
- Se respeta `prefers-reduced-motion` (el confeti se apaga).
- Comandos: `bun run dev`, `bun run build`, `bun run lint`.

## 9. Ideas que quedaron en el tintero

No están hechas. Si se retoman, revisar primero si sirven al objetivo del punto 1.

- Migrar a la nube lo guardado en modo local de emergencia (ver 6b).
- Subtareas / checklist adentro de una tarea grande — bueno para "limpiar",
  que en realidad son 6 cosas chicas. Candidato natural para Groq.
- Tareas recurrentes (limpiar es semanal).
- Modo "5 minutos": timer corto para arrancar sin comprometerse a terminar.
- Vista de historial: qué tachaste esta semana.

## 10. Registro

- **2026-09-19** — Arranque del proyecto. Scaffolding Vite+React+TS, bun, zod.
  Se registró la app web de Firebase que faltaba y se completó el `.env` con
  prefijos `VITE_`. Se borró el JSON de cuenta de servicio. App funcionando
  punta a punta con festejo, racha y notas (verificada en el navegador contra el
  fallback de localStorage).
- **2026-09-19** — Se discutió si las reglas de Firestore alcanzan o hace falta
  un backend propio (ver punto 4b). Se decidió **Auth con Google + reglas por
  uid**. Los datos se movieron a `users/{uid}/tasks`, el store pasó a crearse por
  usuario y se agregó validación de forma en las reglas.

- **2026-09-19** — El login con Google quedó funcionando (verificado en el
  navegador: sesión iniciada y nombre en el header). Se reescribió todo el copy
  para sacar jerga técnica, porque la app se va a compartir (punto 7b).

### Bloqueado esperando al humano

**Falta un solo paso**, que necesita la cuenta de Google y no se puede
automatizar desde acá:

```bash
bun run fb:login   # abre el navegador, hay que entrar con la cuenta de Google
bun run rules      # despliega firestore.rules al proyecto
```

`firebase-tools` está como devDependency **a propósito**: invocarlo con
`bunx firebase-tools` usa un caché aparte que en esta máquina quedó corrupto
(`Cannot find module 'semver'`) y falla. Usar siempre los scripts de arriba.

> **Error de secuencia que costó caro:** la cuenta de servicio original servía
> para desplegar las reglas sin intervención humana. Se usó para registrar la
> app web y **se borró antes de desplegar las reglas**. Si vuelve a aparecer una
> credencial así: **primero dejar la infraestructura lista, después borrarla.**

Sin eso, Firestore responde `Missing or insufficient permissions`. **La app
igual funciona**: cae al modo local de emergencia y guarda en la computadora.
Lo que no hay hasta desplegar las reglas es sincronización entre dispositivos.

Nota: los errores de *"change in the order of Hooks"* que aparecieron durante el
refactor de auth eran de **Fast Refresh con estado viejo**, no un bug real. Se
van con una recarga completa. Si reaparecen después de mover hooks entre
componentes, recargar antes de salir a buscar el problema.
