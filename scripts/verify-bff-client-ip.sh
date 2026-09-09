#!/usr/bin/env bash
# Verifies the browser → edge → web → private network → API path resolves each visitor
# separately. Run against a locally built API (port 3001) and Next.js server (port 3000)
# where API_INTERNAL_URL points at the API directly, i.e. the production topology.
#
# `CF-Connecting-IP` stands in for Cloudflare, which writes that header itself; requests
# also carry a hostile `X-Forwarded-For` wherever spoofing is under test. Visitor addresses
# and account names are unique per run, so counters from an earlier run cannot mask a
# regression here.
#
# Optional: set DB_PSQL to a psql command with access to the API's database to also assert
# the counter keys and to exercise the verified-email path, e.g.
#   DB_PSQL='psql -U agrobridge -h 127.0.0.1 -d agrobridge_bff' KEY_SECRET=<JWT_SECRET> ...
set -uo pipefail

WEB=${WEB:-http://127.0.0.1:3000}
API=${API:-http://127.0.0.1:3001}
RUN=${RUN:-$(printf '%x' $((RANDOM % 65536)))}
PASS=0
FAIL=0

# Distinct visitor per label, stable within a run and unused by any other run.
visitor() { printf '2001:db8:%s::%s' "$RUN" "$1"; }
account() { printf '%s-%s@example.com' "$1" "$RUN"; }

check() {
  local label=$1 expected=$2 actual=$3
  if [[ "$actual" == "$expected" ]]; then
    printf '  PASS  %-66s %s\n' "$label" "$actual"
    PASS=$((PASS + 1))
  else
    printf '  FAIL  %-66s got %s, want %s\n' "$label" "$actual" "$expected"
    FAIL=$((FAIL + 1))
  fi
}

# Status code of a BFF call made by a visitor at $1, with optional forged headers in $4.
bff() {
  local visitor=$1 path=$2 body=${3:-} extra=${4:-}
  # shellcheck disable=SC2086
  curl -s -o /dev/null -w '%{http_code}' \
    -H "CF-Connecting-IP: ${visitor}" -H 'Content-Type: application/json' \
    ${extra} \
    -X POST "${WEB}${path}" --data "${body}"
}

login() { bff "$1" /api/auth/login "{\"email\":\"$2\",\"password\":\"wrong-password\"}" "${3:-}"; }

# Counter keys are HMACs of the action and the address the API resolved.
key_for() {
  node -e 'const {createHmac}=require("crypto");const [s,a,ip]=process.argv.slice(1);
    process.stdout.write(a+":"+createHmac("sha256",s).update(a+"|ip="+ip).digest("base64url"));' \
    "${KEY_SECRET:-}" "$1" "$2"
}
counters_for() { $DB_PSQL -tAq -c "SELECT count(*) FROM rate_limit_counters WHERE key = '$1';"; }

# Addresses the API would fall back to if it stopped believing the relay. Cleared up front
# so the assertion below reports on this run only.
PEERS=(127.0.0.1 ::1 10.0.0.1)
if [[ -n "${DB_PSQL:-}" && -n "${KEY_SECRET:-}" ]]; then
  for peer in "${PEERS[@]}"; do
    $DB_PSQL -q -c "DELETE FROM rate_limit_counters WHERE key = '$(key_for auth.login.ip "$peer")';" >/dev/null
  done
fi

echo "== run ${RUN}: two visitors through the BFF are counted separately (login, max 2) =="
A=$(visitor a) B=$(visitor b) TARGET=$(account victim)
check 'visitor A attempt 1' 401 "$(login "$A" "$TARGET")"
check 'visitor A attempt 2' 401 "$(login "$A" "$TARGET")"
check 'visitor A attempt 3 blocked' 429 "$(login "$A" "$TARGET")"
check 'visitor B unaffected by A' 401 "$(login "$B" "$TARGET")"

echo '== a client cannot spoof its way into another visitor bucket =='
C=$(visitor c) D=$(visitor d)
check 'blocked A forging X-Forwarded-For stays blocked' 429 "$(login "$A" "$TARGET" "-H X-Forwarded-For:${C}")"
check 'the address A forged was never charged' 401 "$(login "$C" "$TARGET")"
check 'fresh visitor claiming another address is charged to itself' 401 \
  "$(login "$D" "$(account victim2)" "-H X-Forwarded-For:${B},10.0.0.1")"
check 'the address it claimed keeps its own budget' 401 "$(login "$B" "$(account victim2)")"

echo '== support submissions are counted per visitor (max 2) =='
E=$(visitor e) F=$(visitor f)
SUPPORT="{\"name\":\"Nino\",\"email\":\"$(account nino)\",\"subject\":\"Catalog question\",\"message\":\"How do I publish a product?\"}"
check 'visitor E submission 1' 200 "$(bff "$E" /api/support "$SUPPORT")"
check 'visitor E submission 2' 200 "$(bff "$E" /api/support "$SUPPORT")"
check 'visitor E submission 3 blocked' 429 "$(bff "$E" /api/support "$SUPPORT")"
check 'visitor F unaffected by E' 200 "$(bff "$F" /api/support "$SUPPORT")"

echo '== verification-code sending is counted per visitor (max 2 per address) =='
# Registration sends the first code, so one send per registered account is already spent.
register() {
  local visitor=$1 email=$2 jar=$3
  curl -s -o /dev/null -w '%{http_code}' -c "$jar" \
    -H "CF-Connecting-IP: ${visitor}" -H 'Content-Type: application/json' \
    -X POST "${WEB}/api/auth/register" \
    --data "{\"email\":\"${email}\",\"password\":\"password1\",\"role\":\"buyer\"}"
}
send_code() {
  curl -s -o /dev/null -w '%{http_code}' -b "$2" \
    -H "CF-Connecting-IP: $1" -H 'Content-Type: application/json' \
    -X POST "${WEB}/api/verification/email/send-code" --data '{}'
}
G=$(visitor 10) H=$(visitor 11)
check 'visitor G registers (code 1 of 2)' 200 "$(register "$G" "$(account g)" /tmp/jar-g-$RUN.txt)"
sleep 1.2
check 'visitor G requests code 2 of 2' 200 "$(send_code "$G" /tmp/jar-g-$RUN.txt)"
sleep 1.2
check 'visitor G blocked on code 3' 429 "$(send_code "$G" /tmp/jar-g-$RUN.txt)"
check 'visitor H registers (own budget)' 200 "$(register "$H" "$(account h)" /tmp/jar-h-$RUN.txt)"
sleep 1.2
check 'visitor H can still request a code' 200 "$(send_code "$H" /tmp/jar-h-$RUN.txt)"
# A brand-new account cannot escape the address budget, which is what pins the 429 above on
# the visitor address rather than on the account.
check 'second account registers from H' 200 "$(register "$H" "$(account h2)" /tmp/jar-h2-$RUN.txt)"
sleep 1.2
check 'fresh account on a spent address is blocked' 429 "$(send_code "$H" /tmp/jar-h2-$RUN.txt)"

echo '== authenticated BFF requests still work =='
check 'protected endpoint without a cookie' 401 \
  "$(curl -s -o /dev/null -w '%{http_code}' "${WEB}/api/cabinet/overview")"
check 'protected endpoint refuses an unverified account' 403 \
  "$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/jar-h-$RUN.txt "${WEB}/api/cabinet/overview")"
check 'auth cookie is httpOnly' 'httponly' \
  "$(grep -o 'HttpOnly\|#HttpOnly_' /tmp/jar-h-$RUN.txt | head -1 | tr -d '#_' | tr 'A-Z' 'a-z')"
if [[ -n "${DB_PSQL:-}" ]]; then
  $DB_PSQL -q -c "UPDATE \"User\" SET \"emailVerifiedAt\" = now() WHERE email = '$(account h)';" >/dev/null
  check 'protected endpoint through the BFF once verified' 200 \
    "$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/jar-h-$RUN.txt "${WEB}/api/cabinet/overview")"
  check 'verification status through the BFF' 200 \
    "$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/jar-h-$RUN.txt "${WEB}/api/verification/me")"
fi

# Finding a row under the visitor's address proves req.ip is the visitor itself, not a
# Cloudflare, Railway or web-tier address.
if [[ -n "${DB_PSQL:-}" && -n "${KEY_SECRET:-}" ]]; then
  echo '== the stored counter is keyed on the visitor address =='
  check 'counter exists for visitor A' 1 "$(counters_for "$(key_for auth.login.ip "$A")")"
  check 'counter exists for visitor B' 1 "$(counters_for "$(key_for auth.login.ip "$B")")"
  for peer in "${PEERS[@]}"; do
    check "no counter under ${peer}" 0 "$(counters_for "$(key_for auth.login.ip "$peer")")"
  done
fi

echo '== the public API path keeps working =='
check 'direct health check' 200 "$(curl -s -o /dev/null -w '%{http_code}' "${API}/api/health")"
check 'direct login attempt' 401 "$(curl -s -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' \
  -X POST "${API}/api/auth/login" --data "{\"email\":\"$(account direct)\",\"password\":\"wrong-password\"}")"
check 'direct catalog read' 200 "$(curl -s -o /dev/null -w '%{http_code}' "${API}/api/products")"


echo
echo "passed: ${PASS}  failed: ${FAIL}"
[[ $FAIL -eq 0 ]]
