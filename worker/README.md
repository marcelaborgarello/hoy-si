# El despertador (Cloudflare Worker)

Diez líneas cuyo único trabajo es tocarle el timbre a la app **cada minuto**.
La app fija si hay algún aviso que mandar; el Worker no sabe nada de tareas.

## Por qué está acá y no en Vercel

El plan gratuito de Vercel corre tareas programadas **una vez por día, con hasta
59 minutos de imprecisión** — inservible para avisar a una hora. Cloudflare
Workers incluye **5 tareas programadas gratis, cada un minuto**, sin tarjeta.

Y no suma un proveedor: el dominio `ginialtech.com` ya vive en Cloudflare.

Se descartaron, y por qué:

| | Por qué no |
|---|---|
| Google Cloud Tasks | Exige facturación con tarjeta, y Google rechazó el alta |
| QStash / Inngest | El plan gratuito solo programa hasta 7 días adelante, y suman proveedor |
| Supabase con `pg_cron` | Andaría, pero los proyectos gratuitos **se pausan tras 7 días de poca actividad** y los avisos morirían en silencio |
| Cron cada día + programar | Resolvía, pero necesitaba igual uno de los de arriba |

## Cómo se instala (una sola vez)

1. Entrar a [Cloudflare → Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages)
2. **Create** → **Start with Hello World!** → nombre: `hoysi-despertador` → **Deploy**
3. **Edit code**, borrar todo y pegar el contenido de [`despertador.js`](./despertador.js) → **Deploy**
4. En el Worker → **Settings** → **Variables and Secrets** → **Add**:
   - Tipo **Secret**, nombre `CRON_SECRET`, valor: el mismo que está en Vercel
5. En **Settings** → **Trigger Events** → **Add** → **Cron Trigger** → `* * * * *` (cada minuto)

## Para probar que anda

En el Worker, pestaña **Logs** → **Begin log stream**. Cada minuto tiene que
aparecer una línea. Si dice `401`, el `CRON_SECRET` de los dos lados no coincide.

## Lo que hay que saber

- **Si el Worker se cae, no llegan los avisos y nadie se entera.** La app sigue
  funcionando igual; lo único que se pierde son los mensajes de Telegram.
- El aviso puede llegar hasta un minuto tarde. Es el precio de no pagar.
- Cloudflare da 100.000 llamadas por día gratis; esto usa 1.440.
