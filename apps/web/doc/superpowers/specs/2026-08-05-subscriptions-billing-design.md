# Συνδρομές και χρέωση — Σχεδιασμός

**Ημερομηνία**: 2026-08-05
**Κατάσταση**: εγκεκριμένο, έτοιμο για implementation plan

## Σκοπός

Οι νέοι λογαριασμοί παίρνουν δωρεάν δοκιμή 3 ημερών. Μετά, ο χρήστης πληρώνει
3€/μήνα μέσω Stripe για να συνεχίσει να καταγράφει δεδομένα. Όταν λήξει η πρόσβαση,
ο λογαριασμός γίνεται **read-only για νέα δεδομένα**: ο χρήστης βλέπει ό,τι έχει
καταγράψει, το διορθώνει, το εξάγει ή το διαγράφει, αλλά δεν προσθέτει νέο.

## Αποφάσεις που ελήφθησαν

| Ερώτημα | Απόφαση |
|---|---|
| Κοινό | Μελλοντικά δημόσιο· τώρα ανάπτυξη με Stripe **test mode** |
| Μοντέλο πληρωμής | **Μόνο συνδρομή** (Stripe Billing (Checkout + Subscriptions)) με δυνατότητα ακύρωσης |
| Εύρος κλειδώματος | **Μόνο νέα δεδομένα** — ανάγνωση, διόρθωση, export, διαγραφή επιτρέπονται |
| Υπάρχοντες λογαριασμοί | Ο ιδιοκτήτης γίνεται `ADMIN` (μόνιμα ελεύθερος)· οι υπόλοιποι μπαίνουν σε δοκιμή |
| Εναλλακτική πληρωμή | Χειροκίνητη ενεργοποίηση από ADMIN, για IRIS/IBAN |

### Γιατί δεν χρησιμοποιούμε webhooks

Η εφαρμογή τρέχει σε τοπική IP (`192.168.2.249:8095`) χωρίς δημόσιο URL, οπότε το
Stripe δεν έχει πού να στείλει ειδοποιήσεις. Αντ' αυτού ο server **ρωτά** το Stripe
(μόνο εξερχόμενες κλήσεις). Η λογική απομονώνεται στη `reconcileSubscription()`,
ώστε όταν υπάρξει δημόσιο URL να προστεθεί webhook route που καλεί **την ίδια**
συνάρτηση — χωρίς επανεγγραφή.

### Γιατί όχι IRIS απευθείας

Το IRIS δεν εκθέτει δημόσιο API για αυτο-ενσωμάτωση· περνά από πάροχο πληρωμών ή
τράπεζα και απαιτεί επαγγελματικό λογαριασμό με ΑΦΜ. Ρεαλιστική μελλοντική διαδρομή:
Viva Wallet, ως τρίτος `provider`. Μέχρι τότε, οι πληρωμές IRIS/IBAN καλύπτονται από
τη χειροκίνητη ενεργοποίηση.

---

## 1. Μοντέλο δεδομένων

```prisma
enum SubscriptionProvider { STRIPE  MANUAL }
enum SubscriptionStatus   { TRIALING  ACTIVE  CANCELLED  EXPIRED }

model Subscription {
  id            String                @id @default(cuid())
  userId        String                @unique
  status        SubscriptionStatus    @default(TRIALING)
  provider      SubscriptionProvider?          // null όσο είναι σε δοκιμή
  accessUntil   DateTime                       // η ΜΟΝΑΔΙΚΗ πηγή αλήθειας
  autoRenew     Boolean               @default(false)
  externalId    String?               @unique   // Stripe subscription ID (sub_…)
  cancelledAt   DateTime?
  lastSyncedAt  DateTime?                      // τελευταία επιτυχής ερώτηση στο Stripe
  lastSyncError String?                        // κωδικός τελευταίας αποτυχίας
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([accessUntil])
}

model Payment {
  id          String               @id @default(cuid())
  userId      String
  provider    SubscriptionProvider
  externalId  String?              @unique  // αποτρέπει διπλοκαταχώριση
  amountCents Int
  currency    String               @default("EUR")
  paidAt      DateTime
  note        String?                       // MANUAL: «IRIS 05/08, ref ABC123»
  createdAt   DateTime             @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, paidAt])
}
```

Στο `User` προστίθενται μόνο οι σχέσεις `subscription` και `payments`. Δεν
προστίθεται πεδίο ρόλου — χρησιμοποιείται ο υπάρχων `role`.

### Ο κανόνας πρόσβασης

```
canWrite = role === ADMIN
        || BILLING_ENABLED === false
        || accessUntil > τώρα
        || (status === ACTIVE
            && autoRenew === true
            && accessUntil έληξε πριν < SUBSCRIPTION_GRACE_DAYS)
```

**Ποιος ΔΕΝ δικαιούται χάρη**, ρητά:
- `TRIALING` — η δοκιμή λήγει οριστικά· δεν υπάρχει πάροχος να ρωτήσουμε.
- `CANCELLED` — ο χρήστης ακύρωσε συνειδητά· δεν αναμένεται ανανέωση.
- `MANUAL` — δεν υπάρχει αυτόματη χρέωση που θα μπορούσε να καθυστερήσει.

Η χάρη υπάρχει για έναν μόνο λόγο: να μην τιμωρείται χρήστης που **περιμένει
ανανέωση** επειδή το Stripe ή η τράπεζά του αργεί.

Το `status` είναι **μόνο για εμφάνιση** και για το τι θα συμβεί στη συνέχεια. Ποτέ
δεν αποφασίζει πρόσβαση. Έτσι αποκλείεται η κατάσταση όπου το `status` λέει `ACTIVE`
ενώ η ημερομηνία έχει περάσει (ή το αντίστροφο).

### Καταστάσεις προς εμφάνιση

| Κατάσταση | Συνθήκη | Μήνυμα |
|---|---|---|
| `TRIAL` | `TRIALING` και `accessUntil` στο μέλλον | «Δοκιμαστική περίοδος — απομένουν X ημέρες» |
| `ACTIVE` | `ACTIVE` και `accessUntil` στο μέλλον | «Ενεργή έως <ημερομηνία>» |
| `GRACE` | έληξε, τελευταία γνωστή `ACTIVE`, εντός χάριτος | «Επιβεβαιώνουμε τη συνδρομή σου…» |
| `LOCKED` | οτιδήποτε άλλο | «Η συνδρομή έληξε» |
| `UNLIMITED` | `role === ADMIN` ή `BILLING_ENABLED=false` | κανένα banner |

---

## 2. Ροές

### Α. Εγγραφή → δοκιμή

Στο **ίδιο transaction** με τη δημιουργία του χρήστη δημιουργείται `Subscription` με
`status=TRIALING`, `accessUntil = τώρα + TRIAL_DAYS`. Δεν μπορεί να υπάρξει χρήστης
χωρίς συνδρομή.

### Β. Έναρξη συνδρομής Stripe

1. `POST /api/billing/stripe/subscribe` → ο server καλεί
   `POST /v1/billing/subscriptions` με `plan_id`, `client_reference_id = userId`,
   `application_context.return_url = {APP_URL}/api/billing/stripe/return`.
2. Ο χρήστης ανακατευθύνεται στον σύνδεσμο έγκρισης του Stripe.
3. Επιστροφή στο `GET /api/billing/stripe/return?subscription_id=…`.
4. Ο server καλεί `GET /v1/billing/subscriptions/{id}` και **επαληθεύει**:
   - `status === "ACTIVE"`
   - **`client_reference_id === userId` του τρέχοντος session**
5. `reconcileSubscription()` → redirect στο `/billing`.

**Ο έλεγχος `client_reference_id` είναι απαίτηση ασφαλείας, όχι βελτίωση.** Το
`subscription_id` φτάνει μέσω URL, άρα είναι είσοδος χρήστη· χωρίς τον έλεγχο,
κάποιος θα μπορούσε να ενεργοποιήσει τον λογαριασμό του με ξένη συνδρομή.

### Γ. `reconcileSubscription(userId)` — η καρδιά

```
1. accessUntil > τώρα                      → επιστροφή (καμία κλήση δικτύου)
2. provider !== STRIPE ή !externalId       → LOCKED
3. lastSyncedAt < SYNC_COOLDOWN (5 λεπτά)  → επιστροφή cached (rate limit)
4. GET /v1/billing/subscriptions/{id}
   ├─ ACTIVE     → accessUntil = current_period_end
   │                (fallback: τώρα + 1 μήνας)· καταγραφή Payment
   ├─ CANCELLED  → status=CANCELLED, autoRenew=false, accessUntil αμετάβλητο
   ├─ SUSPENDED  → status=EXPIRED
   └─ σφάλμα     → lastSyncError, accessUntil αμετάβλητο (ισχύει η χάρη)
```

Στη συνήθη περίπτωση δεν γίνεται καμία κλήση δικτύου — μόνο σύγκριση ημερομηνίας.
Το `lastSyncedAt` περιορίζει σε μία κλήση ανά `SYNC_COOLDOWN` (σταθερά κώδικα,
5 λεπτά — όχι ρύθμιση περιβάλλοντος) ανά χρήστη.

**Ιδιαιτερότητα Stripe**: το `current_period_end` λείπει σε ακυρωμένες
συνδρομές. Το `accessUntil` δεν μένει ποτέ κενό — γίνεται fallback σε +1 μήνα.

**Idempotency πληρωμών**: `externalId = latest_invoice.id` — το Stripe δίνει
πραγματικό μοναδικό αναγνωριστικό τιμολογίου, οπότε δεν χρειάζεται συνθετικό κλειδί.
Δεύτερη συμφιλίωση της ίδιας πληρωμής απορρίπτεται από το unique constraint.

### Δ. Ακύρωση

`POST /api/billing/cancel` → `POST /v1/billing/subscriptions/{id}/cancel` →
`autoRenew=false`, `status=CANCELLED`, `cancelledAt=τώρα`. **Το `accessUntil` μένει
ως έχει** — ο πληρωμένος μήνας ολοκληρώνεται.

### Ε. Χειροκίνητη ενεργοποίηση (IRIS/IBAN)

`POST /api/admin/subscriptions/extend` (μόνο `role === ADMIN`), με `userId`,
`months`, `note`:

```
accessUntil = max(τώρα, accessUntil) + months
provider    = MANUAL
status      = ACTIVE
+ εγγραφή Payment (amountCents = months × SUBSCRIPTION_PRICE_CENTS)
```

Το `max` σημαίνει ότι πρόωρη πληρωμή **προσθέτει** χρόνο αντί να τον χάνει.

---

## 3. Επιβολή

### Κλειδωμένα endpoints (ακριβώς τρία)

| Endpoint | Λόγος |
|---|---|
| `POST /api/meals` | Νέο γεύμα + ανάλυση AI |
| `POST /api/meals/[id]/analyze` | Επανάληψη ανάλυσης — κοστίζει AI |
| `POST /api/weight` | Νέα καταχώριση βάρους |

Όλα τα υπόλοιπα παραμένουν ανοιχτά: `PATCH /api/meals/[id]`, κάθε `DELETE`,
`PUT /api/profile`, `GET /api/account/export`, όλα τα `GET`.

Ο έλεγχος γίνεται με `requireWriteAccess(userId)` **μόνο** σε αυτά τα τρία. Δεν
μπαίνει σε middleware: το edge runtime δεν έχει πρόσβαση στη βάση, και έλεγχος
μοιρασμένος σε δύο επίπεδα κάποια στιγμή αποκλίνει.

Νέος κωδικός `SUBSCRIPTION_REQUIRED` → **HTTP 402**, ώστε ο client να τον ξεχωρίζει
από 401 (μη συνδεδεμένος) και 403 (ξένο δεδομένο) χωρίς parsing μηνυμάτων.

### UI

- **Dashboard**: banner ανάλογα με την κατάσταση· το κουμπί «Προσθήκη γεύματος»
  γίνεται ανενεργό με εξήγηση όταν ο λογαριασμός είναι κλειδωμένος.
- **`/billing`**: κατάσταση, ημερομηνία λήξης, κουμπί συνδρομής, κουμπί ακύρωσης
  (όταν `autoRenew`), ιστορικό πληρωμών.
- **`/admin/users`** (μόνο ADMIN): λίστα χρηστών με κατάσταση συνδρομής και κουμπί
  χειροκίνητης παράτασης.

Ο έλεγχος υπάρχει **και** στο UI **και** στον server. Το UI για να μη φτάνει ο
χρήστης σε σφάλμα για να μάθει ότι έληξε· ο server επειδή το UI δεν είναι ασφάλεια.

---

## 4. Ρυθμίσεις

```env
BILLING_ENABLED=true              # false = κανένα κλείδωμα πουθενά
TRIAL_DAYS=3
SUBSCRIPTION_GRACE_DAYS=3
SUBSCRIPTION_PRICE_CENTS=300

STRIPE_SECRET_KEY=                # sk_test_… ή sk_live_… — το ΠΡΟΘΕΜΑ ορίζει το περιβάλλον
STRIPE_PRICE_ID=                  # price_… (3€/μήνα, recurring)
```

Το Stripe έχει **ένα** base URL· το περιβάλλον καθορίζεται από το πρόθεμα του
κλειδιού (`sk_test_` / `sk_live_`). Δεν υπάρχει μεταβλητή που μπορείς να ξεχάσεις να
αλλάξεις — το κλειδί είναι ο διακόπτης. Η εφαρμογή εκθέτει `stripeIsLive` ώστε το UI
να προειδοποιεί όταν τρέχει σε live.

Αν λείπουν τα credentials, το κουμπί Stripe δεν εμφανίζεται και μένει μόνο η
χειροκίνητη ενεργοποίηση· η εφαρμογή δεν κρασάρει. Ίδιο μοτίβο με το `AI_PROVIDER`.

---

## 5. Χειρισμός σφαλμάτων

| Σενάριο | Συμπεριφορά |
|---|---|
| Stripe δεν απαντά στη λήξη | Χάρη `SUBSCRIPTION_GRACE_DAYS` αν η τελευταία γνωστή κατάσταση ήταν `ACTIVE` |
| `client_reference_id` ≠ userId | 403, καμία αλλαγή, καταγραφή στα logs |
| Διπλή συμφιλίωση ίδιας πληρωμής | Απορρίπτεται από το unique `externalId` |
| Λείπει `current_period_end` | Fallback `τώρα + 1 μήνας` |
| Λείπουν Stripe credentials | Το Stripe κρύβεται· μόνο MANUAL |
| Ο χρήστης ακυρώνει στο Stripe απευθείας | Εντοπίζεται στην επόμενη συμφιλίωση |

Η χάρη ισχύει και για γνήσια αποτυχία πληρωμής (ληγμένη κάρτα). Αυτό είναι
**σκόπιμο**: σε προϊόν 3€ το κόστος τριών ημερών είναι αμελητέο μπροστά στο να
διώξεις πελάτη επειδή έληξε η κάρτα του ένα Σαββατοκύριακο.

---

## 6. Δοκιμές

**Unit — καθαρή λογική ημερομηνιών** (`resolveAccessState`): ενεργή δοκιμή, ληγμένη
δοκιμή, ενεργή συνδρομή, ληγμένη, ακυρωμένη-αλλά-πληρωμένη, εντός χάριτος, εκτός
χάριτος, ADMIN bypass, `BILLING_ENABLED=false`.

**Unit — με mock**: αντιστοίχιση απάντησης Stripe σε πεδία `Subscription`· fallback
όταν λείπει `current_period_end`· απόρριψη `client_reference_id` που δεν ταιριάζει· idempotency
διπλού `externalId`· 402 από τον φύλακα· τα μη κλειδωμένα endpoints παραμένουν
προσβάσιμα σε ληγμένο χρήστη.

**Χειροκίνητα (δεν αυτοματοποιείται)**: η έγκριση στο Stripe απαιτεί ανθρώπινο κλικ.
Θα δοκιμαστεί σε sandbox και θα αναφερθεί τι παρατηρήθηκε — χωρίς ισχυρισμό
λειτουργίας πριν επιβεβαιωθεί.

---

## 7. Migration

1. Δημιουργία `subscriptions`, `payments` και των δύο enums.
2. `UPDATE users SET role='ADMIN' WHERE email='tzoybe@msn.com'`.
3. Backfill: για κάθε υπάρχοντα χρήστη, `Subscription` με `TRIALING` και
   `accessUntil = τώρα + TRIAL_DAYS`.

---

## 8. Εκτός εμβέλειας

Σκόπιμα δεν περιλαμβάνονται: τιμολόγηση και αποδείξεις, επιστροφές χρημάτων,
χειρισμός ΦΠΑ, εκπτωτικοί κωδικοί, πολλαπλά πακέτα συνδρομής, email ειδοποιήσεων
λήξης, webhooks (μέχρι να υπάρξει δημόσιο URL), ενσωμάτωση Viva Wallet/IRIS.

Κανένα δεν απαιτείται για να λειτουργήσει το σύστημα, και το καθένα αποτελεί
ξεχωριστό έργο.

## 9. Νομική σημείωση

Η είσπραξη χρημάτων από τρίτους δημιουργεί φορολογικές υποχρεώσεις (εισόδημα,
τιμολόγηση, ΑΑΔΕ) ανεξάρτητα από πάροχο πληρωμών. Αφορά τη μετάβαση σε δημόσια
λειτουργία, όχι την ανάπτυξη σε sandbox.
