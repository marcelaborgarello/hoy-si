type Props = {
  onSignIn: () => void
  error: string | null
}

export function SignIn({ onSignIn, error }: Props) {
  return (
    <div className="signin">
      <div className="signin-card">
        <div className="signin-emoji">✦</div>
        <h1>Hoy sí</h1>
        <p className="sub">
          Anotá eso que venís pateando, apretá <strong>Empecé</strong>, y cuando lo tachás
          te muestro cuánto tardó de verdad.
        </p>

        <button className="btn primary big" onClick={onSignIn}>
          Entrar con Google
        </button>

        {error && <p className="signin-error">{error}</p>}

        <p className="signin-foot">
          Tu lista es tuya y de nadie más. No la ve ni quien hizo esta app.
        </p>
      </div>
    </div>
  )
}
