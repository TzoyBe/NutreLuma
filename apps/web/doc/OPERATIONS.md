# Οδηγίες λειτουργίας — NutreLuma

Πρακτικός οδηγός για αλλαγές στο `.env` και επανεκκίνηση της εφαρμογής στο NAS.

- **URL**: <http://192.168.2.249:8095>
- **Φάκελος στο NAS (SSH)**: `/share/CACHEDEV1_DATA/Container/nutreluma`
- **Φάκελος από Windows**: `\\tzoybe-nas\Container\nutreluma`

---

## 0. Απαραίτητο προοίμιο σε ΚΑΘΕ συνεδρία SSH

Ο λογαριασμός `TzoyBe` δεν έχει έγκυρο home directory, οπότε το `docker` αποτυγχάνει με
`permission denied` αν δεν οριστεί γραπτό `HOME`. **Τρέξε αυτές τις γραμμές πρώτες, πάντα:**

```sh
export PATH=/share/CACHEDEV1_DATA/.qpkg/container-station/bin:$PATH
export HOME=/tmp/nutreluma-deploy
export DOCKER_CONFIG=$HOME/.docker
mkdir -p "$DOCKER_CONFIG"
cd /share/CACHEDEV1_DATA/Container/nutreluma
```

Χωρίς αυτές, κάθε εντολή `docker compose` παρακάτω θα σκάσει.

---

## 1. Άλλαξα μόνο το `.env` → γρήγορη επανεκκίνηση

Ισχύει για αλλαγές σε API key, μοντέλο, provider, όρια, timezone κ.λπ.
**Δεν χρειάζεται build** — παίρνει ~40 δευτερόλεπτα.

```sh
docker compose --env-file .env up -d --force-recreate --no-build web
```

Το `--no-build` είναι σημαντικό: εγγυάται ότι δεν θα ξεκινήσει build και δεν θα
περιμένεις άδικα.

**Επαλήθευση:**

```sh
curl -s http://127.0.0.1:8095/api/health
```

Αναμενόμενο: `{"status":"ok","database":"up"}`

---

## 2. Άλλαξα κώδικα → πλήρες build

```sh
docker compose --env-file .env up --build -d
```

Παίρνει 2–5 λεπτά.

> ⚠️ **Το build στο NAS είναι ασταθές.** Σκάει σποραδικά με
> `Error: Unknown system error -10, mkdir '/app/.next/types/app/api'`.
> Δεν φταίει ο κώδικας — **απλό retry της ίδιας εντολής το περνάει** (συνήθως με τη 2η).

> ‼️ **Η πιο επικίνδυνη παγίδα:** όταν το build αποτύχει, το compose **κρατά το προηγούμενο
> image** και το container μένει `healthy`. Φαίνεται σαν επιτυχία ενώ τρέχει παλιός κώδικας.
> Πάντα κοίτα το exit code, όχι μόνο το healthcheck:

```sh
docker compose --env-file .env up --build -d; echo "EXIT=$?"
```

Αν δεις `EXIT=0`, το build πέτυχε. Οτιδήποτε άλλο σημαίνει ότι τρέχει ακόμη ο παλιός κώδικας.

**Build με αυτόματο retry** (κόλλα το ολόκληρο):

```sh
n=1; while [ $n -le 4 ]; do
  echo "--- προσπάθεια $n ---"
  docker compose --env-file .env up --build -d && { echo "OK"; break; }
  n=$((n+1)); sleep 5
done
```

---

## 3. Ρυθμίσεις AI στο `.env`

Το `AI_PROVIDER` δέχεται **μόνο** τις τιμές: `gemini`, `openai`, `anthropic`, `mock`.

> ‼️ **Λάθος τιμή ρίχνει ΟΛΗ την εφαρμογή**, όχι μόνο το AI. Το Zod schema κάνει validation
> στο ξεκίνημα και πετάει σφάλμα, οπότε κάθε σελίδα και κάθε API route επιστρέφει **500**.
> (Η αρχική σελίδα `/` συνεχίζει να δουλεύει επειδή είναι στατική — μη σε ξεγελάσει.)

### Google Gemini — δωρεάν tier (τρέχουσα ρύθμιση)

```env
AI_PROVIDER=gemini
AI_API_KEY=<key από https://aistudio.google.com>
AI_API_BASE_URL=https://generativelanguage.googleapis.com/v1beta
AI_MODEL=gemini-3.6-flash
```

Το `/openai` προστίθεται αυτόματα στο base URL — δουλεύει και με τις δύο μορφές.

Για να δεις ποια μοντέλα είναι διαθέσιμα στο key σου:

```sh
curl -s "https://generativelanguage.googleapis.com/v1beta/openai/models" \
  -H "Authorization: Bearer ΤΟ_KEY_ΣΟΥ" | grep -o '"id"[^,]*'
```

Τα ονόματα μοντέλων αλλάζουν και τα παλιά αποσύρονται — αν πάρεις 404, εδώ θα βρεις το σωστό.

### Anthropic — επί πληρωμή, καλύτερη ακρίβεια

```env
AI_PROVIDER=anthropic
AI_API_KEY=sk-ant-...
AI_API_BASE_URL=https://api.anthropic.com
AI_MODEL=claude-haiku-4-5
```

Μοντέλα: `claude-haiku-4-5` (~$0.003/γεύμα, φθηνότερο) ή `claude-sonnet-5`
(~$0.01/γεύμα, καλύτερο vision). Απαιτεί credits στο <https://console.anthropic.com>.

### OpenAI-compatible — οποιοσδήποτε άλλος πάροχος

```env
AI_PROVIDER=openai
AI_API_KEY=<key>
AI_API_BASE_URL=https://api.groq.com/openai/v1     # ή openrouter, x.ai, LM Studio κ.λπ.
AI_MODEL=<όνομα μοντέλου>
```

### Mock — demo δεδομένα χωρίς κόστος

```env
AI_PROVIDER=mock
```

Επιστρέφει σταθερά δείγματα, **άσχετα με τη φωτογραφία**. Εμφανίζεται κίτρινη προειδοποίηση
στη σελίδα του γεύματος ώστε να μην μπερδευτεί με πραγματική ανάλυση.

> Αν το `AI_API_KEY` είναι κενό, η εφαρμογή πέφτει αυτόματα σε mock και το γράφει στα logs
> (`ai_provider_fallback_to_mock`). Δεν κρασάρει.

---

## 4. Άλλες χρήσιμες ρυθμίσεις

| Μεταβλητή | Σημείωση |
|---|---|
| `RUN_SEED` | **Κράτα το `false`.** Με `true` το seed τρέχει σε ΚΑΘΕ εκκίνηση και **σβήνει όλα τα γεύματα του demo χρήστη**. |
| `WEB_PORT` | Θύρα προς τα έξω (τώρα 8095). Αλλαγή θέλει `docker compose up -d` για να ξαναγίνει bind. |
| `APP_URL` | Καθορίζει αν τα cookies είναι `Secure`: αν βάλεις `https://`, τα cookies γίνονται Secure και πάνω από http το login σταματά να δουλεύει. **Δεν** περιορίζει από ποια διεύθυνση μπαίνεις — ο CSRF έλεγχος συγκρίνει το `Origin` με το host που ζήτησε ο ίδιος ο browser, οπότε δουλεύει με IP, με `tzoybe-nas`, ή με domain πίσω από reverse proxy. |
| `MAX_AI_REQUESTS_PER_HOUR` | Όριο αναλύσεων ανά χρήστη ανά ώρα (τώρα 20). |
| `AUTH_SECRET` | **Αν το αλλάξεις, αποσυνδέονται όλοι** — τα υπάρχοντα session cookies γίνονται άκυρα. |

---

## 5. Διάγνωση προβλημάτων

### Όλα βγάζουν 500 μετά από αλλαγή στο `.env`

Σχεδόν σίγουρα λάθος τιμή σε μεταβλητή:

```sh
docker compose logs web | grep -i "Μη έγκυρη διαμόρφωση"
```

### «Μη έγκυρη προέλευση αιτήματος»

Ο CSRF έλεγχος απέρριψε το αίτημα. Πλέον αυτό σημαίνει ότι το `Origin` του browser
δεν ταιριάζει με το host που ζητήθηκε — π.χ. σελίδα ανοιγμένη σε μία διεύθυνση που
υποβάλλει σε άλλη. Δες ποιο origin ήρθε:

```sh
docker compose logs --tail 200 web | grep -i forbidden | tail -5
```

Αν μπαίνεις πίσω από reverse proxy, βεβαιώσου ότι προωθεί το `X-Forwarded-Host`.

### Η ανάλυση αποτυγχάνει

Το ακριβές σφάλμα από τον πάροχο (δεν εμφανίζεται ποτέ στον χρήστη):

```sh
docker compose logs --tail 200 web | grep ai_provider_error | tail -3
```

Συνήθη: `credit balance is too low` (θέλει credits), `404 model not found`
(λάθος `AI_MODEL`), `401` (λάθος key).

### Τι ρυθμίσεις τρέχει ΟΝΤΩΣ το container

Το `.env` στον δίσκο μπορεί να διαφέρει από αυτό που φορτώθηκε στη μνήμη:

```sh
docker inspect nutreluma-web --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | grep -E "^AI_|^RUN_SEED"
```

Αν διαφέρουν, χρειάζεσαι `--force-recreate` (ενότητα 1).

### Γενική εικόνα

```sh
docker compose ps
docker compose logs --tail 50 web
```

---

## 6. Βάση δεδομένων

```sh
# Διαδραστικό psql
docker compose exec db psql -U nutreluma_user -d nutreluma_app

# Μία εντολή
docker compose exec -T db psql -U nutreluma_user -d nutreluma_app -c "SELECT count(*) FROM meals;" < /dev/null
```

> ⚠️ Το `< /dev/null` είναι απαραίτητο όταν τρέχεις `docker compose exec -T` **μέσα σε script**:
> αλλιώς καταναλώνει το υπόλοιπο του script από το stdin και η εκτέλεση κόβεται σιωπηλά.

**Backup:**

```sh
docker compose exec -T db pg_dump -U nutreluma_user -d nutreluma_app -Fc > backup-$(date +%F).dump
```

**Demo λογαριασμός:** `demo@nutreluma.local` / `Test1234demo`

---

## 7. Συνδρομές

Πλήρεις οδηγίες ρύθμισης: **`STRIPE-SETUP.md`**.

**Ξεκλείδωμα χρήστη σε έκτακτη ανάγκη** (χωρίς Stripe, χωρίς UI):

```sh
docker compose exec -T db psql -U nutreluma_user -d nutreluma_app -c   "UPDATE subscriptions SET \"accessUntil\" = NOW() + INTERVAL '1 month', status='ACTIVE', provider='MANUAL' WHERE \"userId\" = (SELECT id FROM users WHERE email='XXX@example.com');" < /dev/null
```

**Δες ποιος έχει πρόσβαση:**

```sh
docker compose exec -T db psql -U nutreluma_user -d nutreluma_app -c   "SELECT u.email, u.role, s.status, s.\"accessUntil\" FROM users u LEFT JOIN subscriptions s ON s.\"userId\"=u.id ORDER BY u.\"createdAt\";" < /dev/null
```

**Απενεργοποίηση χρέωσης συνολικά:** `BILLING_ENABLED=false` στο `.env` και
`--force-recreate`. Κανείς δεν κλειδώνεται.

**Ο ρόλος ADMIN παρακάμπτει πάντα τη χρέωση** — ο λογαριασμός `tzoybe@msn.com`
έγινε ADMIN στο migration.

---

## 8. Καθάρισμα χώρου στο NAS

Το build cache μεγαλώνει γρήγορα:

```sh
docker system df                # τι πιάνει χώρο
docker builder prune -f         # καθαρίζει build cache
docker image prune -a -f        # ΠΡΟΣΟΧΗ: σβήνει images που δεν χρησιμοποιούνται
```

---

## 9. Σύνοψη — τι τρέχω πότε

| Άλλαξα... | Εντολή | Χρόνος |
|---|---|---|
| `.env` | `docker compose --env-file .env up -d --force-recreate --no-build web` | ~40 δευτ. |
| Κώδικα | `docker compose --env-file .env up --build -d` (retry αν σκάσει) | 2–5 λεπτά |
| `docker-compose.yml` | `docker compose --env-file .env up -d` | ~1 λεπτό |
| Τίποτα, θέλω restart | `docker compose restart web` | ~20 δευτ. |

---

## RevenueCat native-subscription operations

### Configuration boundaries

Set these values only in the web/backend deployment environment (the container's `.env` or
equivalent secret store):

```dotenv
REVENUECAT_SECRET_API_KEY=
REVENUECAT_ENTITLEMENT_ID=pro
REVENUECAT_PRODUCT_IDS=nutreluma_pro_monthly,nutreluma_pro_yearly
REVENUECAT_ALLOW_SANDBOX=false
```

`REVENUECAT_SECRET_API_KEY` is a server-only RevenueCat REST API key. Never add it to an
Expo configuration, EAS variable, native binary, browser bundle, or git commit. Only these
native-build variables are public and enter EAS/iOS/Android builds:

```dotenv
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=
EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=pro
```

The public platform SDK keys must remain separate from the backend secret. A native app
without valid public keys remains in the free state. Server verification requires a non-empty
secret, entitlement ID, and product allow-list; `REVENUECAT_ALLOW_SANDBOX` is optional and
defaults to `false` unless a dedicated sandbox backend explicitly sets it to `true`.

### Deployment order and matching rules

1. Create the iOS and Android auto-renewable store products, with IDs
   `nutreluma_pro_monthly` and `nutreluma_pro_yearly`, in App Store Connect and Google Play
   Console. Complete their store credentials, agreements, and tester configuration.
2. Add both apps to RevenueCat for `com.joybeedigital.nutreluma`, connect the Apple and
   Google store integrations, import the same products, and attach both to the `pro`
   entitlement. Make an offering/paywall containing the packages; enable Customer Center
   when native subscription management is required.
3. Before releasing any native binary, deploy the backend with a real server secret,
   `REVENUECAT_ENTITLEMENT_ID=pro`, and an allow-list containing exactly those product IDs.
   Run the normal application deployment/migration process for the integration; do not
   expose the secret in build tooling.
4. Set the three `EXPO_PUBLIC_*` values in EAS and distribute a newly built binary. Public
   environment values are compiled into the native bundle, so an EAS rebuild is required
   after changing one.

All entitlement and product identifiers must match exactly. The backend accepts only an
active `pro` entitlement whose product is allow-listed, belongs to App Store or Google Play,
and is in an allowed environment. Monthly/yearly subscriptions are supported; lifetime
entitlements are rejected.

### Reconciliation, polling, and support

The native app logs into RevenueCat with the NutreLuma user ID as its App User ID. Following
a purchase or restore, it immediately calls authenticated
`POST /api/billing/revenuecat/sync`; the backend fetches that customer through RevenueCat's
REST API and persists the verified access state. Client-side entitlement data by itself does
not grant NutreLuma access. Support can find the customer in RevenueCat by searching the
NutreLuma user ID.

The RevenueCat Free plan has no webhooks in this deployment. Access is therefore reconciled
on the immediate sync above and when an expired local access record is read. Expiration-time
polling keeps the existing five-minute per-user cooldown and graceful failure behavior; it
does not shorten a future `accessUntil` after a failed or inactive response. RevenueCat
cancellation is managed through Customer Center/store UI, not the web cancellation endpoint.

### Sandbox and production checks

Keep `REVENUECAT_ALLOW_SANDBOX=false` in production. For a dedicated sandbox, TestFlight,
or Play internal-testing backend environment, set it to `true` only for the test period;
otherwise sandbox responses are rejected. Use Apple sandbox testers or Google Play license
testers to purchase each product, verify the immediate backend sync and renewed/expired
state, test Restore Purchases, and test cancellation management.

Real store purchases cannot be verified locally: they require the external store products,
RevenueCat/store credentials, a store tester, deployed backend configuration, and an
EAS-built native binary. Expo Go cannot load the RevenueCat native module.
