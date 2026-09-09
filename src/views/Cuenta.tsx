// Entrar o crear cuenta (plans/007 §4.2). Pantalla apilada que cuelga de Ajustes:
// un formulario, un campo de contraseña con «Mostrar», sin recuperación (no hay
// correo saliente) y sin puerta al arrancar: la cuenta es opcional.
import { useEffect, useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate } from 'react-router-dom'
import { getSettings } from '../db/db'
import { login, logout, register, useAuthState, type AuthResult } from '../lib/auth'
import { ensureSubscription, syncPrefs } from '../lib/push'
import { TopBar } from '../components/TopBar'
import { Icon } from '../components/Icon'
import { radioGroupKeyDown } from '../lib/a11y'

type Mode = 'login' | 'register'

const MODES: { key: Mode; label: string }[] = [
  { key: 'login', label: 'Entrar' },
  { key: 'register', label: 'Crear cuenta' },
]

const MIN_PASSWORD = 10

/** Qué pasó y qué hacer, sin disculpas (DESIGN.md §7). */
function message(result: AuthResult, mode: Mode): string | null {
  switch (result) {
    case 'ok':
      return null
    case 'bad-credentials':
      return 'Correo o contraseña incorrectos.'
    case 'exists':
      return 'Ya hay una cuenta con este correo. Entra con ella.'
    case 'weak':
      return mode === 'register' ? `La contraseña necesita al menos ${MIN_PASSWORD} caracteres.` : 'Revisa el correo y la contraseña.'
    case 'locked':
      return mode === 'register' ? 'Demasiadas cuentas creadas desde esta red. Inténtalo dentro de una hora.' : 'Demasiados intentos. Espera 15 minutos.'
    case 'offline':
      return 'Sin conexión. La cuenta necesita red; entrenar no.'
    case 'server':
      return 'El servidor no tiene configurada la cuenta.'
  }
}

const inputReset = { background: 'transparent', border: 'none', color: 'inherit', font: 'inherit' } as const
const linkStyle = { textDecoration: 'underline', textUnderlineOffset: 2 } as const

/** Misma regla que el servidor (worker/src/auth.ts normalizeEmail): suficiente para no enviar basura. */
function looksLikeEmail(value: string): boolean {
  const v = value.trim()
  return v.length >= 5 && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

export function Cuenta() {
  const navigate = useNavigate()
  const auth = useAuthState()
  const settings = useLiveQuery(getSettings)
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sesión caducada: el correo ya se sabe; solo falta la contraseña.
  useEffect(() => {
    if ((auth.status === 'expired' || auth.status === 'offline') && email === '') setEmail(auth.email)
  }, [auth, email])

  if (settings === undefined) return null

  // Este móvil ya habló con el servidor sin cuenta: lo suyo pasa a la cuenta al entrar.
  const hasAnonymousData = settings.push_endpoint !== null || settings.last_backup_at !== null

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setError(null)
    setBusy(true)
    const result = await (mode === 'login' ? login(email, password) : register(email, password))
    setBusy(false)
    const msg = message(result, mode)
    if (msg !== null) {
      setError(msg)
      return
    }
    // El notificador queda al día bajo la cuenta; sin esperar a que termine.
    void ensureSubscription()
    void syncPrefs()
    navigate('/ajustes', { replace: true })
  }

  const canSubmit = looksLikeEmail(email) && password.length >= (mode === 'register' ? MIN_PASSWORD : 1) && !busy

  return (
    <div className="screen screen--stacked">
      <TopBar as="p" title="Cuenta" />
      <main className="flex-1 w-full pb-24 px-gutter flex flex-col relative">
        <div className="flex flex-col w-full gap-lg pb-2xl">
          <div className="flex flex-col pt-xs">
            <span className="type-label-sm uppercase tracking-wider text-primary-dim">Avisos y copia</span>
            <h1 className="type-headline-sm uppercase tracking-tight text-on-surface">{auth.status === 'in' ? 'Cuenta' : 'Entrar o crear cuenta'}</h1>
          </div>

          {auth.status === 'in' ? (
            <section className="flex flex-col rounded-xl bg-sc-low overflow-hidden shadow-sm">
              <div className="flex items-center justify-between p-md gap-sm">
                <div className="flex items-center gap-md min-w-0">
                  <div className="w-8 h-8 rounded bg-sc-high flex items-center justify-center flex-none text-on-surface">
                    <Icon name="user" size={18} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="type-body-md font-medium text-on-surface" style={{ overflowWrap: 'anywhere' }}>{auth.email}</span>
                    <span className="type-label-sm text-on-surface-variant">Sesión abierta en este dispositivo</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="h-touch px-sm rounded-lg type-label-md uppercase tracking-wider text-on-surface-variant press flex-none"
                  onClick={() => void logout().then(() => navigate('/ajustes', { replace: true }))}
                >
                  Salir
                </button>
              </div>
            </section>
          ) : (
            <form className="flex flex-col gap-lg" onSubmit={(e) => void onSubmit(e)} noValidate>
              <div className="p-xxs rounded-xl bg-sc-low flex items-center gap-xxs" role="radiogroup" onKeyDown={radioGroupKeyDown} aria-label="Entrar o crear cuenta">
                {MODES.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    role="radio"
                    aria-checked={mode === m.key} tabIndex={mode === m.key ? 0 : -1}
                    className={`flex-1 h-touch rounded-lg flex items-center justify-center gap-xs type-label-md uppercase ${mode === m.key ? 'bg-volt text-on-primary-container shadow-sm' : 'text-on-surface-variant'}`}
                    onClick={() => {
                      setMode(m.key)
                      setError(null)
                    }}
                  >
                    <span className={mode === m.key ? 'font-bold' : ''}>{m.label}</span>
                    {mode === m.key && <Icon name="check" size={16} />}
                  </button>
                ))}
              </div>

              {(auth.status === 'expired' || auth.status === 'offline') && (
                <p className="type-body-sm text-on-surface-variant px-xxs">
                  {auth.status === 'expired' ? 'La sesión de este móvil caducó. Entra de nuevo.' : 'Sin conexión: la sesión se comprueba al volver la red.'}
                </p>
              )}

              <div className="flex flex-col gap-md">
                <div className="flex flex-col gap-xs">
                  <label htmlFor="cuenta-email" className="type-label-sm uppercase tracking-wider text-on-surface-variant px-xxs">
                    Correo
                  </label>
                  <div className="field">
                    <input
                      id="cuenta-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      spellCheck={false}
                      placeholder="nombre@dominio.es"
                      className="type-body-md text-on-surface"
                      style={inputReset}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={(e) => e.currentTarget.scrollIntoView({ block: 'center' })}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-xs">
                  <div className="flex items-center justify-between px-xxs">
                    <label htmlFor="cuenta-password" className="type-label-sm uppercase tracking-wider text-on-surface-variant">
                      Contraseña
                    </label>
                    <button
                      type="button"
                      className="h-touch px-sm type-label-sm uppercase tracking-wider text-on-surface-variant"
                      aria-pressed={show}
                      onClick={() => setShow((s) => !s)}
                    >
                      {show ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </div>
                  <div className="field">
                    <input
                      id="cuenta-password"
                      type={show ? 'text' : 'password'}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      className="type-body-md text-on-surface"
                      style={inputReset}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={(e) => e.currentTarget.scrollIntoView({ block: 'center' })}
                    />
                  </div>
                  {mode === 'register' && <p className="type-body-sm text-on-surface-variant px-xxs">Mínimo {MIN_PASSWORD} caracteres.</p>}
                </div>
              </div>

              <div className="flex flex-col gap-sm">
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={`w-full rounded-lg type-label-md uppercase tracking-wider flex items-center justify-center press ${canSubmit ? 'bg-volt text-on-volt font-bold' : 'bg-sc-high text-on-surface-variant'}`}
                  style={{ minHeight: 'var(--h-cta)' }}
                >
                  {busy ? (mode === 'login' ? 'Entrando…' : 'Creando la cuenta…') : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
                </button>
                <p className="type-body-sm text-on-surface-variant px-xxs" aria-live="polite" style={{ minHeight: 20 }}>
                  {error}
                </p>
                {hasAnonymousData && error === null && <p className="type-body-sm text-on-surface-variant px-xxs">Los avisos y la copia de este móvil pasarán a la cuenta.</p>}
                {mode === 'register' && (
                  <p className="type-body-sm text-on-surface-variant px-xxs">
                    Al crear la cuenta aceptas los{' '}
                    <Link to="/terminos" className="text-on-surface" style={linkStyle}>
                      términos de uso
                    </Link>{' '}
                    y la{' '}
                    <Link to="/privacidad" className="text-on-surface" style={linkStyle}>
                      política de privacidad
                    </Link>
                    .
                  </p>
                )}
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}
