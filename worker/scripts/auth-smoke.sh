#!/usr/bin/env bash
# Prueba de humo de /api/auth/* contra `wrangler dev` (plans/007 §7 paso 5).
#   cd worker && npm run dev        (en otra terminal)
#   bash scripts/auth-smoke.sh [http://localhost:8787]
# Recorre: register → me → refresh (cookie nueva) → reutilizar cookie vieja (401 y
# familia revocada) → login → fusión del token anónimo → logout → refresh 401 → bloqueo.
set -u
BASE="${1:-http://localhost:8787}"
J='Content-Type: application/json'
T=$(mktemp -d)
EMAIL="smoke-$(date +%s)@example.com"
PASS="contraseña-larga-123"
fail=0

check() { # check <nombre> <esperado> <obtenido>
  if [ "$2" = "$3" ]; then echo "  ok   $1 ($3)"; else echo "  FAIL $1: esperado $2, obtenido $3"; fail=1; fi
}
code() { curl -s -o "$T/body" -w '%{http_code}' "$@"; }
cookie() { grep -o 'rt=[^;]*' "$1" | head -1 | cut -d= -f2; }

echo "== alta anónima previa (simula un móvil sin cuenta con prefs)"
LEGACY="anon-$(od -An -tx1 -N24 /dev/urandom | tr -d ' \n')"
check "register anónimo" 200 "$(code -X POST "$BASE/api/register" -H "$J" -H "Authorization: Bearer $LEGACY" -d '{"timezone":"Europe/Madrid"}')"
check "prefs anónimas" 200 "$(code -X POST "$BASE/api/prefs" -H "$J" -H "Authorization: Bearer $LEGACY" -d '{"prefs":[{"type":"weight","enabled":true,"local_time":"07:30","only_scheduled_days":false}]}')"

echo "== register (convierte la fila anónima en cuenta)"
check "contraseña corta → 400" 400 "$(code -X POST "$BASE/api/auth/register" -H "$J" -d "{\"email\":\"$EMAIL\",\"password\":\"corta\"}")"
check "correo inválido → 400" 400 "$(code -X POST "$BASE/api/auth/register" -H "$J" -d "{\"email\":\"nada\",\"password\":\"$PASS\"}")"
check "register → 201" 201 "$(code -D "$T/h1" -X POST "$BASE/api/auth/register" -H "$J" -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"legacy_token\":\"$LEGACY\"}")"
ACCESS=$(sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p' "$T/body")
RT1=$(cookie "$T/h1")
[ -n "$ACCESS" ] && echo "  ok   access token recibido (${#ACCESS} chars)" || { echo "  FAIL sin access token"; fail=1; }
grep -qi 'HttpOnly' "$T/h1" && grep -qi 'Path=/api/auth' "$T/h1" && echo "  ok   cookie HttpOnly con Path=/api/auth" || { echo "  FAIL atributos de cookie"; fail=1; }
check "register repetido → 409" 409 "$(code -X POST "$BASE/api/auth/register" -H "$J" -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")"

echo "== acceso con el JWT"
check "me → 200" 200 "$(code "$BASE/api/auth/me" -H "Authorization: Bearer $ACCESS")"
grep -q "\"email\":\"$EMAIL\"" "$T/body" && echo "  ok   me devuelve el email" || { echo "  FAIL me sin email"; fail=1; }
check "prefs con JWT → 200" 200 "$(code -X POST "$BASE/api/prefs" -H "$J" -H "Authorization: Bearer $ACCESS" -d '{"prefs":[]}')"
check "prefs con token anónimo sigue → 200" 200 "$(code -X POST "$BASE/api/prefs" -H "$J" -H "Authorization: Bearer $LEGACY" -d '{"prefs":[]}')"
check "JWT manipulado → 401" 401 "$(code "$BASE/api/auth/me" -H "Authorization: Bearer ${ACCESS%?}x")"

echo "== refresh con rotación"
check "refresh → 200" 200 "$(code -D "$T/h2" -X POST "$BASE/api/auth/refresh" -H "Cookie: rt=$RT1")"
RT2=$(cookie "$T/h2")
[ -n "$RT2" ] && [ "$RT2" != "$RT1" ] && echo "  ok   cookie rotada" || { echo "  FAIL cookie no rotada"; fail=1; }
check "reutilizar la cookie vieja → 401" 401 "$(code -X POST "$BASE/api/auth/refresh" -H "Cookie: rt=$RT1")"
check "la nueva también cae (familia revocada) → 401" 401 "$(code -X POST "$BASE/api/auth/refresh" -H "Cookie: rt=$RT2")"
check "refresh sin cookie → 401" 401 "$(code -X POST "$BASE/api/auth/refresh")"

echo "== login y fusión de otro móvil anónimo"
LEGACY2="anon-$(od -An -tx1 -N24 /dev/urandom | tr -d ' \n')"
check "alta anónima 2" 200 "$(code -X POST "$BASE/api/register" -H "$J" -H "Authorization: Bearer $LEGACY2" -d '{"timezone":"Europe/Madrid"}')"
check "facts anónimo 2" 200 "$(code -X POST "$BASE/api/facts" -H "$J" -H "Authorization: Bearer $LEGACY2" -d '{"local_date":"2026-09-05","trained":true}')"
check "login mal → 401" 401 "$(code -X POST "$BASE/api/auth/login" -H "$J" -d "{\"email\":\"$EMAIL\",\"password\":\"otra-cosa-distinta\"}")"
START=$(date +%s%N)
check "login → 200" 200 "$(code -D "$T/h3" -X POST "$BASE/api/auth/login" -H "$J" -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"legacy_token\":\"$LEGACY2\"}")"
echo "  info login tardó $(( ($(date +%s%N) - START) / 1000000 )) ms (incluye PBKDF2 y red local)"
ACCESS2=$(sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p' "$T/body")
RT3=$(cookie "$T/h3")
check "token anónimo 2 ya no existe → 401" 401 "$(code -X POST "$BASE/api/prefs" -H "$J" -H "Authorization: Bearer $LEGACY2" -d '{"prefs":[]}')"
check "MAYÚSCULAS y espacios en el correo → 200" 200 "$(code -X POST "$BASE/api/auth/login" -H "$J" -d "{\"email\":\"  ${EMAIL^^} \",\"password\":\"$PASS\"}")"

echo "== logout"
check "logout → 204" 204 "$(code -X POST "$BASE/api/auth/logout" -H "Cookie: rt=$RT3")"
check "refresh tras logout → 401" 401 "$(code -X POST "$BASE/api/auth/refresh" -H "Cookie: rt=$RT3")"
check "el access token sigue vivo hasta caducar → 200" 200 "$(code "$BASE/api/auth/me" -H "Authorization: Bearer $ACCESS2")"

echo "== bloqueo por intentos"
for i in $(seq 1 10); do code -X POST "$BASE/api/auth/login" -H "$J" -d "{\"email\":\"$EMAIL\",\"password\":\"fallo-$i-xxxxx\"}" >/dev/null; done
check "11º intento → 429" 429 "$(code -D "$T/h4" -X POST "$BASE/api/auth/login" -H "$J" -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")"
grep -qi 'Retry-After' "$T/h4" && echo "  ok   Retry-After presente" || { echo "  FAIL sin Retry-After"; fail=1; }

rm -rf "$T"
[ $fail -eq 0 ] && echo "TODO OK" || { echo "HAY FALLOS"; exit 1; }
