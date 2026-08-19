# NutreLuma

Καταγραφή ημερήσιων θερμίδων μέσω φωτογραφιών γευμάτων. Ο χρήστης ανεβάζει ή τραβά φωτογραφία, ο backend τη στέλνει σε multimodal AI vision provider και επιστρέφει εκτίμηση θερμίδων που καταχωρίζεται αυτόματα στο ημερολόγιό του.

> **Αποποίηση ευθύνης**
> Οι θερμίδες που υπολογίζονται από την εφαρμογή αποτελούν εκτίμηση βάσει της φωτογραφίας και ενδέχεται να μην είναι ακριβείς. Η εφαρμογή δεν παρέχει ιατρική ή διατροφική διάγνωση και δεν αντικαθιστά διαιτολόγο ή γιατρό.

---

## Περιεχόμενα

- [Χαρακτηριστικά](#χαρακτηριστικά)
- [Architecture](#architecture)
- [Directory structure](#directory-structure)
- [Database schema](#database-schema)
- [Requirements](#requirements)
- [Γρήγορη εκκίνηση με Docker](#γρήγορη-εκκίνηση-με-docker)
- [Environment variables](#environment-variables)
- [Database migrations](#database-migrations)
- [Seed data](#seed-data)
- [Development](#development)
- [Production build](#production-build)
- [Testing](#testing)
- [AI provider configuration](#ai-provider-configuration)
- [Upload storage configuration](#upload-storage-configuration)
- [Backup και restore PostgreSQL](#backup-και-restore-postgresql)
- [API reference](#api-reference)
- [Security notes](#security-notes)
- [Privacy](#privacy)
- [Known limitations](#known-limitations)

---

## Χαρακτηριστικά

- Εγγραφή / σύνδεση / αποσύνδεση με HttpOnly session cookies και bcrypt hashing
- Προφίλ υγείας με υπολογισμό προτεινόμενου ημερήσιου στόχου (BMR Mifflin-St Jeor × activity factor)
- Ανέβασμα φωτογραφίας από υπολογιστή, από κινητό ή απευθείας από την κάμερα
- Ανάλυση εικόνας με AI vision και structured JSON output, επικυρωμένο με Zod
- **Αναλυτικά διατροφικά στοιχεία**: θερμίδες με εύρος (ελάχιστο / πιθανότερο / μέγιστο), πρωτεΐνη, υδατάνθρακες, λιπαρά, ίνες, ζάχαρη, κορεσμένα, νάτριο — συνολικά και ανά τρόφιμο
- **Ροή επιβεβαίωσης**: η ανάλυση αποθηκεύεται ως draft και μετρά στα σύνολα μόνο αφού την επιβεβαιώσει ο χρήστης
- **Διευκρινιστικές ερωτήσεις** από το AI (λάδι, dressing, μέγεθος μερίδας) με refinement της εκτίμησης βάσει των απαντήσεων
- **Χειροκίνητη καταχώριση** γεύματος χωρίς φωτογραφία και χωρίς AI
- Ξεχωριστή αποθήκευση αρχικής AI εκτίμησης και τελικής τιμής
- **Ημερήσιοι στόχοι θερμίδων και macros με ιστορικό** — αλλαγή στόχου δεν αλλοιώνει παλιές αναφορές
- Dashboard με ημερήσιο σύνολο, στόχο, υπόλοιπο, progress bars ανά macro και λίστα γευμάτων
- Ιστορικό με φίλτρα ημερομηνίας/τύπου/αναζήτησης και σελιδοποίηση
- Στατιστικά: θερμίδες ανά ημέρα, μέσοι όροι 7/30 ημερών, % ημερών εντός στόχου, κατανομή ανά τύπο γεύματος
- Παρακολούθηση βάρους με γράφημα πορείας
- **Συνδρομές**: δοκιμή 3 ημερών, 3 €/μήνα, κλείδωμα σε read-only μετά τη λήξη
- **Δύο τρόποι πληρωμής με επιλογή του χρήστη**: κάρτα μέσω Stripe ή PayPal — δες [`STRIPE-SETUP.md`](STRIPE-SETUP.md) και [`PAYPAL-SETUP.md`](PAYPAL-SETUP.md)
- **Διγλωσσία EL/EN** με εναλλαγή εν λειτουργία (cookie ανά αίτημα, server + client)
- Εξαγωγή όλων των δεδομένων σε JSON/CSV και οριστική διαγραφή λογαριασμού
- Ελληνικό interface με δομή λεξικών έτοιμη για προσθήκη αγγλικών
- Mobile-first UI με loading states, skeletons, empty states, toasts και προσβάσιμα controls

---

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│ Browser (mobile-first React UI)                            │
│  • preview & client-side validation                        │
│  • ΔΕΝ βλέπει ποτέ AI key, prompt ή raw AI response         │
└───────────────┬────────────────────────────────────────────┘
                │ same-origin fetch (HttpOnly cookie)
┌───────────────▼────────────────────────────────────────────┐
│ Next.js 15 (App Router) — container "web"                  │
│                                                            │
│  middleware.ts        security headers · CSP · route guard │
│  app/(app)/*          RSC σελίδες (δεδομένα από services)  │
│  app/api/*            Route handlers                       │
│    └─ withErrorHandling  → συνεπή JSON errors              │
│    └─ requireApiUser     → authn + ύπαρξη χρήστη           │
│    └─ assertSameOrigin   → CSRF                            │
│    └─ zod schemas        → input validation                │
│                                                            │
│  server/services/*    domain logic (κάθε query με userId)  │
│  server/ai/*          provider adapters + prompt + schema  │
│  server/storage/*     StorageDriver (local → S3 αργότερα)  │
│  server/images.ts     sharp: resize, EXIF strip, re-encode │
└───────┬─────────────────────────────────┬──────────────────┘
        │ Prisma                          │ fs
┌───────▼───────────┐            ┌────────▼─────────┐
│ PostgreSQL 16     │            │ /app/uploads     │
│ volume: db_data   │            │ volume: uploads  │
└───────────────────┘            └──────────────────┘
```

### Ροή ανάλυσης γεύματος

1. Ο χρήστης επιλέγει φωτογραφία — τοπικός έλεγχος τύπου και μεγέθους.
2. `POST /api/meals` (multipart) με `requestKey` για αποτροπή διπλής υποβολής.
3. Έλεγχος rate limits (uploads/ημέρα, AI κλήσεις/ώρα).
4. `processMealImage`: magic-byte sniffing → απόρριψη εκτελέσιμων → `sharp` resize (max 1280px) + re-encode σε WebP (αφαιρεί EXIF/GPS) + thumbnail 320px.
5. Αποθήκευση αρχείων με τυχαία UUID ονόματα μέσω `StorageDriver`.
6. Δημιουργία `Meal` με `analysisStatus = PENDING`.
7. `analyzeMealImage`: κλήση provider → `parseAiResponse` (Zod + sanitization). Σε μη έγκυρο JSON γίνεται **ένα** controlled retry με αυστηρότερη οδηγία.
8. Επιτυχία → transaction: `Meal` → `COMPLETED` με `aiEstimatedCalories`, `finalCalories`, `aiConfidence`, `MealItem[]` και `AiUsageLog`.
9. Αποτυχία → `FAILED` **χωρίς θερμίδες** (καμία λανθασμένη εγγραφή) + κουμπί «Δοκίμασε ξανά».
10. Ο χρήστης βλέπει «Εκτιμώμενες θερμίδες: X kcal» και μπορεί να ανοίξει τις λεπτομέρειες ή να διορθώσει.

Η ανάλυση είναι σύγχρονη στο MVP. Η συνάρτηση `runAnalysis()` στο [`src/server/services/meal.ts`](../src/server/services/meal.ts) είναι απομονωμένη ώστε να μπορεί αργότερα να καλείται από queue worker χωρίς αλλαγές στο API.

---

## Directory structure

```
nutreluma/
├── Dockerfile
├── docker-compose.yml
├── docker/entrypoint.sh          # migrate deploy + optional seed + start
├── .env.example
├── .dockerignore
├── next.config.mjs               # security headers + CSP
├── tailwind.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
│       ├── migration_lock.toml
│       └── 20260101000000_init/migration.sql
├── public/robots.txt
├── src/
│   ├── middleware.ts
│   ├── i18n/{index,el,en}.ts
│   ├── lib/
│   │   ├── api-client.ts         # typed fetch wrapper
│   │   ├── calories.ts           # BMR / TDEE / summaries
│   │   ├── constants.ts
│   │   ├── dates.ts              # UTC ↔ timezone χρήστη
│   │   ├── image-mime.ts         # magic bytes
│   │   ├── utils.ts
│   │   └── validation/{auth,profile,meal,weight}.ts
│   ├── server/
│   │   ├── env.ts  errors.ts  http.ts  logger.ts  images.ts
│   │   ├── db/prisma.ts
│   │   ├── auth/{jwt,session,guards,password,rate-limit}.ts
│   │   ├── storage/{index,local,types}.ts
│   │   ├── ai/
│   │   │   ├── index.ts          # orchestration + retry + logging
│   │   │   ├── prompt.ts         # system prompt
│   │   │   ├── schema.ts         # Zod validation + sanitization
│   │   │   └── providers/{types,anthropic,openai,mock}.ts
│   │   └── services/{user,profile,meal,weight,stats,account}.ts
│   ├── components/
│   │   ├── ui/{button,field,card,misc}.tsx
│   │   ├── forms/{register,login,profile}-form.tsx
│   │   ├── meal/{meal-upload-form,meal-detail,meal-card}.tsx
│   │   ├── weight/weight-panel.tsx
│   │   ├── settings/account-panels.tsx
│   │   ├── history/history-filters.tsx
│   │   ├── app-nav.tsx  charts.tsx  confirm-dialog.tsx
│   │   ├── date-nav.tsx  toast.tsx
│   └── app/
│       ├── layout.tsx  globals.css  page.tsx  error.tsx  not-found.tsx
│       ├── privacy/page.tsx
│       ├── login/page.tsx  register/page.tsx
│       ├── (app)/
│       │   ├── layout.tsx
│       │   ├── onboarding/page.tsx
│       │   ├── dashboard/{page,loading}.tsx
│       │   ├── meals/new/page.tsx
│       │   ├── meals/[id]/{page,loading}.tsx
│       │   ├── history/page.tsx
│       │   ├── stats/page.tsx
│       │   ├── weight/page.tsx
│       │   └── settings/page.tsx
│       └── api/
│           ├── health/route.ts
│           ├── auth/{register,login,logout}/route.ts
│           ├── profile/route.ts
│           ├── dashboard/route.ts
│           ├── stats/route.ts
│           ├── meals/route.ts
│           ├── meals/[id]/{route,analyze/route,image/route}.ts
│           ├── weight/route.ts  weight/[id]/route.ts
│           └── account/{route,password/route,export/route}.ts
└── tests/
    ├── setup.ts
    ├── stubs/server-only.ts
    ├── unit/*.test.ts
    └── e2e/smoke.spec.ts
```

---

## Database schema

| Model | Σκοπός | Indexes |
|---|---|---|
| `User` | λογαριασμός, `passwordHash`, `role`, `consentAcceptedAt` | unique `email` |
| `HealthProfile` | 1-1 με χρήστη· ύψος/βάρος ως `Decimal`, timezone, στόχοι | unique `userId` |
| `Meal` | γεύμα, εικόνες, AI εκτίμηση **και** τελική τιμή, κύκλος ζωής (`status`), προέλευση (`source`), εύρος θερμίδων, macros | `userId`, `mealDateTime`, `(userId, mealDateTime)`, `(userId, status, mealDateTime)`, unique `requestKey` |
| `MealItem` | τρόφιμα ανά γεύμα με AI και τελικές θερμίδες + macros | `mealId` |
| `MealClarification` | διευκρινιστική ερώτηση του AI και η απάντηση του χρήστη | `mealId`, unique `(mealId, questionId)` |
| `NutritionGoal` | ημερήσιοι στόχοι **με ιστορικό** (`effectiveFrom`) | unique + index `(userId, effectiveFrom)` |
| `WeightEntry` | ημερήσια καταχώριση βάρους | unique + index `(userId, entryDate)` |
| `AiUsageLog` | provider, model, status, διάρκεια, requestId, errorCode | `(userId, createdAt)` |

### Κύκλος ζωής γεύματος

`MealStatus`: `PENDING` → `ANALYZING` → `REVIEW_REQUIRED` → `CONFIRMED`, με `FAILED` και `CANCELLED` ως εναλλακτικές καταλήξεις.

**Μόνο τα `CONFIRMED` μετρούν σε σύνολα, στατιστικά και αναφορές.** Ο κανόνας επιβάλλεται σε κάθε aggregation query στη βάση — όχι στο UI.

Το παλιό `analysisStatus` (`PENDING`/`COMPLETED`/`FAILED`) διατηρείται αμετάβλητο και περιγράφει **μόνο** το αν απάντησε το AI.

`MealSource`: `AI_IMAGE`, `MANUAL`, `BARCODE`, `NUTRITION_LABEL`, `SAVED_MEAL`, `RECIPE`.

### Στόχοι με ιστορικό

Ο στόχος μιας ημέρας είναι η πιο πρόσφατη εγγραφή `NutritionGoal` με `effectiveFrom <= ημέρα`. Αλλαγή του σημερινού στόχου **δεν** αλλοιώνει αναδρομικά παλιές αναφορές.

Σημειώσεις:

- Όλες οι χρονικές στιγμές αποθηκεύονται σε **UTC**· η ομαδοποίηση ανά ημέρα γίνεται με το timezone του χρήστη (`zonedDayRangeUtc`).
- Οι θερμίδες είναι `Int`. Βάρος/ύψος είναι `Decimal(6,2)` / `Decimal(5,2)`, macros `Decimal(7,2)`, νάτριο `Int` (mg) — decimal-safe.
- Τα macros είναι **nullable**: `null` σημαίνει «άγνωστο», ποτέ μηδέν.
- Το `aiRawResponse` κρατά **μόνο** το δομημένο αποτέλεσμα και σύντομο summary — ποτέ chain-of-thought.
- Διαγραφή χρήστη κάνει cascade σε profile, meals, items, weight entries και AI logs.

---

## Requirements

- **Docker** 24+ και **Docker Compose v2** (μοναδική απαίτηση για την προτεινόμενη εγκατάσταση)
- Για τοπική ανάπτυξη χωρίς Docker: **Node.js 20+** και **PostgreSQL 16**

---

## Γρήγορη εκκίνηση με Docker

```bash
cp .env.example .env

# Παράγωγε ισχυρό AUTH_SECRET και βάλ' το στο .env
openssl rand -base64 48

docker compose up --build
```

Η εφαρμογή είναι διαθέσιμη στο <http://localhost:3000>.

Τι κάνει αυτόματα το `docker compose up --build`:

1. Σηκώνει PostgreSQL 16 με persistent volume `db_data` και healthcheck.
2. Χτίζει το Next.js image και περιμένει η βάση να γίνει healthy.
3. Το `entrypoint.sh` τρέχει `prisma migrate deploy` (με retry) πριν ξεκινήσει ο server.
4. Το `/api/health` χρησιμοποιείται ως Docker HEALTHCHECK.

**Χωρίς AI API key η εφαρμογή λειτουργεί πλήρως** με `AI_PROVIDER=mock`: ντετερμινιστικά αποτελέσματα με βάση το hash της εικόνας, ώστε να μπορείς να δοκιμάσεις όλη τη ροή.

Χρήσιμες εντολές:

```bash
docker compose logs -f web          # logs εφαρμογής
docker compose exec web npm run db:seed   # demo δεδομένα
docker compose down                 # σταμάτημα (τα volumes παραμένουν)
docker compose down -v              # σταμάτημα + διαγραφή δεδομένων
```

Αλλαγή θύρας: `WEB_PORT=8080 docker compose up -d`.

---

## Environment variables

| Μεταβλητή | Default | Περιγραφή |
|---|---|---|
| `NODE_ENV` | `development` | `production` σε deployment |
| `APP_URL` | `http://localhost:3000` | Χρησιμοποιείται στον έλεγχο same-origin (CSRF) |
| `DATABASE_URL` | — | Connection string PostgreSQL |
| `AUTH_SECRET` | — | **Υποχρεωτικό** σε production· ≥16 χαρακτήρες (`openssl rand -base64 48`) |
| `SESSION_MAX_AGE_DAYS` | `30` | Διάρκεια session cookie |
| `AI_PROVIDER` | `mock` | `anthropic` \| `openai` \| `mock` |
| `AI_API_KEY` | — | Κενό ⇒ αυτόματη πτώση σε `mock` |
| `AI_API_BASE_URL` | `https://api.anthropic.com` | Base URL του provider |
| `AI_MODEL` | `claude-sonnet-5` | Multimodal μοντέλο |
| `AI_TIMEOUT_MS` | `60000` | Timeout κλήσης AI |
| `STORAGE_DRIVER` | `local` | Προς το παρόν μόνο `local` |
| `UPLOAD_DIR` | `/app/uploads` | Root του storage |
| `MAX_UPLOAD_SIZE_MB` | `10` | Μέγιστο μέγεθος αρχείου |
| `MAX_AI_REQUESTS_PER_HOUR` | `20` | Όριο AI ανά χρήστη ανά ώρα |
| `MAX_UPLOADS_PER_DAY` | `50` | Όριο uploads ανά χρήστη ανά 24ωρο |
| `MAX_LOGIN_ATTEMPTS_PER_15MIN` | `8` | Όριο προσπαθειών σύνδεσης |
| `DEFAULT_LOCALE` | `el` | Γλώσσα UI |
| `DEFAULT_TIMEZONE` | `Europe/Athens` | Fallback όταν δεν υπάρχει προφίλ |
| `LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error` |
| `RUN_SEED` | `false` | `true` ⇒ το entrypoint τρέχει seed |
| `SEED_DEMO_EMAIL` / `SEED_DEMO_PASSWORD` | — | Στοιχεία demo χρήστη |

Τα API keys διαβάζονται **αποκλειστικά** από environment variables. Δεν υπάρχει κανένα secret στον κώδικα και το `.env` είναι στο `.gitignore` και στο `.dockerignore`.

---

## Database migrations

Το initial migration βρίσκεται στο `prisma/migrations/20260101000000_init/`.

```bash
# Production / Docker (αυτόματο από το entrypoint)
npm run db:deploy          # prisma migrate deploy

# Development: δημιουργία νέου migration μετά από αλλαγή schema
npm run db:migrate -- --name add_something

# Ξαναδημιουργία Prisma client
npm run db:generate

# GUI περιήγηση δεδομένων
npm run db:studio
```

Μέσα από Docker:

```bash
docker compose exec web npx prisma migrate deploy
docker compose exec web npx prisma migrate status
```

---

## Seed data

```bash
npm run db:seed
# ή
docker compose exec web npm run db:seed
# ή αυτόματα στο boot
RUN_SEED=true docker compose up
```

Δημιουργεί demo χρήστη με προφίλ υγείας, 5 γεύματα με τρόφιμα και 4 καταχωρίσεις βάρους.

Το password διαβάζεται από `SEED_DEMO_PASSWORD`. **Αν δεν οριστεί, παράγεται τυχαίο ισχυρό password και τυπώνεται μία φορά στο stdout.** Δεν χρησιμοποιείται ποτέ γνωστό/αδύναμο password. Μη χρησιμοποιήσεις τον demo λογαριασμό σε production.

---

## Development

```bash
npm install
cp .env.example .env        # DATABASE_URL προς τοπική PostgreSQL
npm run db:deploy
npm run dev                 # http://localhost:3000
```

Διαθέσιμα scripts:

| Script | Τι κάνει |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | `prisma generate` + production build |
| `npm run start` | Εκκίνηση production build |
| `npm run typecheck` | TypeScript χωρίς emit |
| `npm run lint` | Next.js lint |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright) |
| `npm run db:*` | migrate / deploy / generate / seed / studio |

Αν θέλεις μόνο τη βάση σε Docker: `docker compose up db -d` και `DATABASE_URL=postgresql://nutreluma_user:change_me@localhost:5432/nutreluma_app` (ξεσχολίασε το `ports` στο `docker-compose.yml`).

---

## Production build

```bash
docker compose --env-file .env up --build -d
```

Checklist πριν το production:

- [ ] `NODE_ENV=production`
- [ ] `AUTH_SECRET` τυχαίο, ≥32 bytes — η εφαρμογή αρνείται να ξεκινήσει με το placeholder
- [ ] `POSTGRES_PASSWORD` ισχυρό και `DATABASE_URL` ενημερωμένο
- [ ] `APP_URL` το πραγματικό https URL (χρησιμοποιείται στον CSRF έλεγχο)
- [ ] TLS termination μπροστά από την εφαρμογή (reverse proxy). Τα cookies γίνονται `Secure` + `__Host-` αυτόματα σε production
- [ ] Backups του `db_data` και του `uploads_data`

Το Nginx **δεν** συμπεριλαμβάνεται: ο Next server εξυπηρετεί απευθείας στο :3000. Αν υπάρχει ήδη reverse proxy/ingress, πρόσθεσέ το εκεί και προώθησε το `X-Forwarded-For` (χρησιμοποιείται στο rate limiting).

---

## Testing

```bash
npm test              # unit tests
npm run test:watch
npm run test:e2e      # χρειάζεται να τρέχει η εφαρμογή
```

Κάλυψη unit tests:

| Αρχείο | Τι ελέγχει |
|---|---|
| `validation.test.ts` | εγγραφή (email, μήκος/πολυπλοκότητα κωδικού, ταύτιση, consent), login, προφίλ, γεύμα, βάρος, **αρνητικές θερμίδες** |
| `auth.test.ts` | bcrypt hashing/verify, salt, JWT round-trip, παραποιημένο token, rate limiting σύνδεσης |
| `ai-schema.test.ts` | έγκυρη/άκυρη AI απάντηση, code fences, `NO_FOOD_DETECTED`, schema mismatch, διόρθωση ασυνεπούς συνόλου, καθαρισμός XSS, clamping |
| `image-validation.test.ts` | magic bytes JPEG/PNG/WebP, απόρριψη GIF/κειμένου, εντοπισμός ELF/PE/shebang/ZIP, **path traversal** στα storage keys |
| `calories.test.ts` | BMR/TDEE, προτεινόμενος στόχος, ημερήσια σύνοψη, normalizeCalories |
| `dates.test.ts` | όρια ημέρας ανά timezone (θερινή/χειμερινή), UTC round-trip, ηλικία |
| `meal-service.test.ts` | **απομόνωση δεδομένων χρήστη / IDOR** (ανάγνωση, επεξεργασία, διαγραφή γεύματος άλλου χρήστη), δημιουργία με ανάλυση, αποτυχία χωρίς καταχώριση θερμίδων, idempotency, διόρθωση με διατήρηση AI τιμής, όριο υψηλών θερμίδων |
| `export.test.ts` | εξαγωγή CSV, escaping, προστασία από CSV injection |

Τα e2e (`tests/e2e/smoke.spec.ts`) καλύπτουν: landing, privacy, **redirect ανώνυμου χρήστη**, **401 σε protected API**, health endpoint και πλήρη ροή εγγραφή → προφίλ → dashboard → αποσύνδεση.

```bash
docker compose up -d
E2E_BASE_URL=http://localhost:3000 npm run test:e2e
```

---

## AI provider configuration

### Anthropic (default)

```env
AI_PROVIDER=anthropic
AI_API_KEY=sk-ant-...
AI_API_BASE_URL=https://api.anthropic.com
AI_MODEL=claude-sonnet-5
```

### OpenAI-compatible

Λειτουργεί με OpenAI, OpenRouter, vLLM, LM Studio κ.λπ. — οτιδήποτε εκθέτει `/chat/completions` με υποστήριξη εικόνας.

```env
AI_PROVIDER=openai
AI_API_KEY=sk-...
AI_API_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
```

### Mock (χωρίς key)

```env
AI_PROVIDER=mock
```

### Προσθήκη νέου provider

1. Δημιούργησε `src/server/ai/providers/<name>.ts` που υλοποιεί το `VisionProvider`:
   ```ts
   analyze(request: VisionRequest): Promise<VisionResponse>
   ```
2. Πρόσθεσέ τον στο `getVisionProvider()` του [`src/server/ai/index.ts`](../src/server/ai/index.ts).
3. Πρόσθεσε την τιμή στο enum `AI_PROVIDER` του [`src/server/env.ts`](../src/server/env.ts).

Δεν χρειάζεται καμία άλλη αλλαγή: το prompt, το retry, η επικύρωση και το logging είναι κοινά.

Το system prompt βρίσκεται στο [`src/server/ai/prompt.ts`](../src/server/ai/prompt.ts) και δεν εκτίθεται ποτέ στον client. Η σημείωση του χρήστη περνά ως *untrusted hint* και όχι ως εντολή προς το μοντέλο.

---

## Upload storage configuration

Οι φωτογραφίες αποθηκεύονται μέσω του interface `StorageDriver`:

```ts
interface StorageDriver {
  put(key: string, data: Buffer, contentType: string): Promise<StoredObject>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}
```

Ο τρέχων driver (`LocalDiskStorage`) γράφει στο `UPLOAD_DIR` (Docker volume `uploads_data`). Δομή κλειδιού:

```
meals/<userId>/<YYYY>/<MM>/<uuid>-<full|thumb>.webp
```

Για S3-compatible storage αργότερα: υλοποίησε το ίδιο interface σε `src/server/storage/s3.ts` και πρόσθεσέ το στο `getStorage()`. Καμία αλλαγή στα services.

**Οι εικόνες δεν σερβίρονται στατικά.** Το `GET /api/meals/[id]/image` ελέγχει session και ιδιοκτησία σε κάθε αίτημα, ώστε να μην υπάρχει δημόσιο URL με δεδομένα υγείας.

---

## Backup και restore PostgreSQL

**Backup βάσης**

```bash
docker compose exec -T db pg_dump -U nutreluma_user -d nutreluma_app -Fc > backup-$(date +%F).dump
```

**Restore**

```bash
cat backup-2026-08-04.dump | docker compose exec -T db pg_restore -U nutreluma_user -d nutreluma_app --clean --if-exists
```

**Backup φωτογραφιών**

```bash
docker run --rm \
  -v nutreluma_uploads_data:/data:ro \
  -v "$PWD":/backup \
  alpine tar czf /backup/uploads-$(date +%F).tar.gz -C /data .
```

**Restore φωτογραφιών**

```bash
docker run --rm \
  -v nutreluma_uploads_data:/data \
  -v "$PWD":/backup \
  alpine sh -c "rm -rf /data/* && tar xzf /backup/uploads-2026-08-04.tar.gz -C /data"
```

Το πρόθεμα του volume είναι το όνομα του project (φάκελος). Δες τα ακριβή ονόματα με `docker volume ls`.

---

## API reference

Όλες οι απαντήσεις έχουν τη μορφή `{ "ok": true, "data": ... }` ή `{ "ok": false, "error": { "code", "message" } }`.

| Method | Endpoint | Auth | Περιγραφή |
|---|---|:--:|---|
| `POST` | `/api/auth/register` | – | Εγγραφή (rate limited) |
| `POST` | `/api/auth/login` | – | Σύνδεση (rate limited) |
| `POST` | `/api/auth/logout` | ✓ | Αποσύνδεση |
| `GET` | `/api/profile` | ✓ | Προφίλ υγείας + προτεινόμενος στόχος |
| `PUT` | `/api/profile` | ✓ | Δημιουργία/ενημέρωση προφίλ |
| `GET` | `/api/dashboard?date=YYYY-MM-DD` | ✓ | Σύνοψη ημέρας + γεύματα |
| `GET` | `/api/stats?days=30\|90` | ✓ | Στατιστικά & κατανομή |
| `GET` | `/api/meals?from&to&mealType&search&page&pageSize` | ✓ | Ιστορικό με φίλτρα |
| `POST` | `/api/meals` | ✓ | `multipart/form-data` → upload + ανάλυση· `application/json` → χειροκίνητη καταχώριση χωρίς AI |
| `GET` | `/api/meals/[id]` | ✓ | Ένα γεύμα |
| `PATCH` | `/api/meals/[id]` | ✓ | Χειροκίνητη διόρθωση |
| `DELETE` | `/api/meals/[id]` | ✓ | Διαγραφή γεύματος + αρχείων |
| `POST` | `/api/meals/[id]/analyze` | ✓ | Επανάληψη ανάλυσης |
| `POST` | `/api/meals/[id]/confirm` | ✓ | Οριστικοποίηση draft — από εδώ και πέρα μετρά στα σύνολα |
| `POST` | `/api/meals/[id]/cancel` | ✓ | Ακύρωση draft (δεν απαιτεί ενεργή συνδρομή) |
| `POST` | `/api/meals/[id]/clarify` | ✓ | Απαντήσεις σε διευκρινιστικές ερωτήσεις → refinement |
| `GET` | `/api/meals/[id]/image?variant=thumb` | ✓ | Εικόνα με έλεγχο ιδιοκτησίας |
| `GET` | `/api/goals?date=YYYY-MM-DD` | ✓ | Στόχος ημέρας + πρόταση + ιστορικό |
| `PUT` | `/api/goals` | ✓ | Ορισμός στόχων, ισχύει από σήμερα |
| `POST` | `/api/billing/stripe/checkout` | ✓ | Δημιουργία Stripe Checkout session |
| `GET` | `/api/billing/stripe/return` | ✓ | Επιστροφή από Stripe, επαλήθευση ιδιοκτησίας |
| `POST` | `/api/billing/paypal/confirm` | ✓ | Επαλήθευση συνδρομής PayPal server-side |
| `POST` | `/api/billing/cancel` | ✓ | Ακύρωση συνδρομής (Stripe ή PayPal) |
| `POST` | `/api/locale` | – | Αλλαγή γλώσσας (cookie) |
| `GET` | `/api/weight` · `POST` `/api/weight` | ✓ | Λίστα / καταχώριση βάρους |
| `DELETE` | `/api/weight/[id]` | ✓ | Διαγραφή καταχώρισης |
| `PATCH` | `/api/account` | ✓ | Ενημέρωση ονόματος εμφάνισης |
| `DELETE` | `/api/account` | ✓ | Οριστική διαγραφή λογαριασμού |
| `POST` | `/api/account/password` | ✓ | Αλλαγή κωδικού |
| `GET` | `/api/account/export?format=json\|csv` | ✓ | Εξαγωγή δεδομένων |
| `GET` | `/api/health` | – | Healthcheck |

HTTP status codes: `400` bad request · `401` unauthenticated · `403` forbidden/CSRF · `404` not found · `409` conflict · `413` payload too large · `415` unsupported media type · `422` validation · `429` rate limited · `502` AI unavailable.

---

## Security notes

**Authentication & sessions**
- bcrypt (12 rounds) — ο κωδικός δεν αποθηκεύεται και δεν καταγράφεται ποτέ
- Session = υπογεγραμμένο JWT (HS256) σε **HttpOnly** cookie, `SameSite=Lax`, `Secure` + πρόθεμα `__Host-` σε production
- Σταθερού χρόνου απάντηση σε ανύπαρκτο email (anti user-enumeration)
- Κάθε protected route επαληθεύει και ότι ο χρήστης **υπάρχει ακόμη** στη βάση

**Authorization**
- Κάθε query γεύματος/βάρους περιλαμβάνει `userId` στο `where` — ένα γεύμα άλλου χρήστη επιστρέφει `404`, όχι `403` (χωρίς διαρροή ύπαρξης)
- Καλύπτεται από tests (`meal-service.test.ts`)

**CSRF**
- `SameSite=Lax` + έλεγχος `Origin`/`Referer` σε κάθε `POST`/`PATCH`/`DELETE`

**Uploads**
- Έλεγχος πραγματικού MIME από magic bytes (όχι από όνομα ή Content-Type)
- Απόρριψη ELF/PE/shebang/ZIP
- Επανακωδικοποίηση με `sharp` → αφαίρεση EXIF/GPS και τυχόν ενσωματωμένου payload
- Τυχαία UUID filenames· τα κλειδιά περνούν από regex + `path.resolve` containment check
- Όριο μεγέθους (`MAX_UPLOAD_SIZE_MB`) και ορίων pixel

**Rate limiting**
- Σύνδεση/εγγραφή: sliding window ανά IP και ανά email
- AI: `MAX_AI_REQUESTS_PER_HOUR` ανά χρήστη, μετρημένο από το `AiUsageLog`
- Uploads: `MAX_UPLOADS_PER_DAY` ανά χρήστη

**Headers**
- CSP χωρίς εξωτερικά origins, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS σε production

**Τι δεν εκτίθεται ποτέ**
- AI API keys, database credentials, stack traces, internal prompts, raw provider errors, raw AI response
- Τα logs είναι JSON με redaction σε `password`, `token`, `cookie`, `email`, `apiKey`, σημειώσεις κ.λπ.

**SQL injection / XSS**
- Όλα τα queries μέσω Prisma (parameterized)· καμία χρήση `dangerouslySetInnerHTML`· επιπλέον sanitization των ονομάτων που επιστρέφει το AI

---

## Privacy

- Ρητό consent checkbox κατά την εγγραφή (αποθηκεύεται `consentAcceptedAt`)
- Σελίδα [Πολιτικής Απορρήτου](../src/app/privacy/page.tsx) με σαφή ενημέρωση για τα δεδομένα υγείας
- Εξαγωγή όλων των δεδομένων σε JSON ή CSV
- Οριστική διαγραφή λογαριασμού: απαιτεί κωδικό + πληκτρολόγηση `ΔΙΑΓΡΑΦΗ`· διαγράφει προφίλ, γεύματα, τρόφιμα, καταχωρίσεις βάρους, AI logs **και τα αρχεία εικόνων**
- Οι φωτογραφίες **δεν** χρησιμοποιούνται για training· στέλνονται στον provider μόνο για τη συγκεκριμένη ανάλυση
- Τα EXIF metadata αφαιρούνται πριν την αποθήκευση
- Το disclaimer εμφανίζεται σε landing, register, dashboard, ανάλυση γεύματος, προφίλ και στατιστικά

---

## Known limitations

- **Η ανάλυση είναι σύγχρονη.** Ένα αργό AI request κρατά ανοιχτό το HTTP αίτημα (`maxDuration = 120s`). Η `runAnalysis()` είναι έτοιμη για μετακίνηση σε queue worker.
- **Rate limiting σύνδεσης σε μνήμη.** Λειτουργεί για single-instance deployment· για οριζόντια κλιμάκωση χρειάζεται Redis (τα όρια AI/uploads είναι ήδη DB-based και κλιμακώνονται).
- **Η ακρίβεια των θερμίδων είναι περιορισμένη.** Η εκτίμηση από φωτογραφία δεν μπορεί να δει λάδι, ζάχαρη ή κρυμμένα συστατικά — γι' αυτό υπάρχει πάντα χειροκίνητη διόρθωση.
- **Μόνο local storage driver** υλοποιημένος· το interface είναι έτοιμο για S3.
- **Το UI είναι μόνο στα ελληνικά** προς το παρόν. Το αγγλικό λεξικό υπάρχει πλήρες (`src/i18n/en.ts`)· λείπει η επιλογή γλώσσας στο UI και το plumbing του `locale` στα components.
- **Μονάδες**: το `preferredUnits` αποθηκεύεται αλλά η εμφάνιση είναι πάντα σε kg/cm.
- **Χωρίς email verification / password reset.** Απαιτεί SMTP και είναι εκτός MVP.
- **Χωρίς offline υποστήριξη ή PWA install.**
- Το `datetime-local` της φόρμας χρησιμοποιεί τη ζώνη ώρας του **προφίλ** για τη μετατροπή σε UTC· αν ταξιδέψεις σε άλλη ζώνη χωρίς να ενημερώσεις το προφίλ, η ώρα θα ερμηνευτεί με βάση το προφίλ.

---

## License

Ιδιωτικό project. Δεν παρέχεται άδεια χρήσης προς τρίτους.


## Use this while making changes in .env file 
docker compose --env-file .env up -d --force-recreate --no-build web