# Meal History & Quick-Pick — Design Spec

**Ημερομηνία:** 2026-08-06
**Project:** NutreLuma (\\tzoybe-nas\Container\nutreluma)
**Στόχος:** Ιστορικό γευμάτων + γρήγορη επανακαταχώριση συχνών/αγαπημένων/πρόσφατων γευμάτων, χωρίς νέο AI request.

## Αρχιτεκτονικές αποφάσεις (κλειδωμένες)

1. **Frequent/recent = compute-on-read** πάνω σε indexed `Meal.mealFingerprint`. Όχι aggregate table.
2. **Favorites = per-fingerprint template** με snapshot (επιβιώνει διαγραφής αρχικού meal).
3. **Add Meal hub = νέα σελίδα `/meals/add`**· το κουμπί «Add Meal» του dashboard δείχνει εκεί.
4. **Barcode / Nutrition label / Recipe: εκτός scope** — το hub δείχνει μόνο Photo + Manual.

## Reuse (καμία επανεγγραφή υπάρχουσας ροής)

- **Quick-pick create → `createManualMeal`** (service/meal.ts): ήδη CONFIRMED, χωρίς AI, idempotent (`requestKey`), ανεξάρτητο record. Επέκταση: προαιρετικό `source` override (default `MANUAL`, quick-pick περνά `SAVED_MEAL`).
- **Search → `listMealHistory`**: ήδη title/notes/item + mealType + date range + pagination. Προσθήκη: calorie-range φίλτρο + client infinite-scroll.
- **Image serving pattern → `/api/meals/[id]/image`**: αντιγράφεται για `/api/meals/favorites/[id]/image`.
- API conventions: `withErrorHandling`, `assertSameOrigin`, `requireApiUser`, `requireWriteAccess`, `jsonOk`, `ApiError`, `getUserTimezone`, `hitLimit`.

## Data model (Prisma migration, χωρίς data loss)

### `Meal.mealFingerprint String?` + `@@index([userId, mealFingerprint])`
Υπολογίζεται backend σε κάθε γραφή που καταλήγει/παραμένει CONFIRMED:
`createManualMeal`, `confirmMeal`, `updateMeal` (όταν αλλάζει τίτλος/type/items/calories), quick-pick create.
Nullable: μη-confirmed γεύματα δεν χρειάζονται fingerprint.

### `FavoriteMeal`
```prisma
model FavoriteMeal {
  id           String   @id @default(cuid())
  userId       String
  fingerprint  String
  title        String?
  mealType     MealType
  calories     Int?
  proteinGrams      Decimal? @db.Decimal(7,2)
  carbohydrateGrams Decimal? @db.Decimal(7,2)
  fatGrams          Decimal? @db.Decimal(7,2)
  fiberGrams        Decimal? @db.Decimal(7,2)
  sugarGrams        Decimal? @db.Decimal(7,2)
  saturatedFatGrams Decimal? @db.Decimal(7,2)
  sodiumMg          Int?
  items        Json     // snapshot: [{name, quantity, calories, macros}] — immutable template
  thumbKey     String?  // αντίγραφο του thumb σε δικό του key (επιβιώνει διαγραφής meal)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([userId, fingerprint])
  @@index([userId])
  @@map("favorite_meals")
}
```
Στο `User`: `favoriteMeals FavoriteMeal[]`.

### Backfill
Script `prisma/backfill-fingerprints.ts`: διαβάζει meals+items σε batches, υπολογίζει fingerprint με την **ίδια** TS συνάρτηση, κάνει update. Τεκμηρίωση εκτέλεσης μετά το migrate. (Χωρίς αυτό τα υπάρχοντα γεύματα δεν εμφανίζονται στα «συχνά».)

## Fingerprint (`src/lib/meal-fingerprint.ts`, ντετερμινιστικό, tested)

```
fingerprint = sha256( normTitle + '|' + mealType + '|' + sortedItemSigs.join(',') )
normTitle   = lowercase → trim → collapse whitespace → strip diacritics (Greek+Latin) → strip punctuation
              (κενός τίτλος → από τα ονόματα των items)
itemSig     = normName + ':' + bucket(finalCalories)     // ταξινομημένα αλφαβητικά
bucket(c)   = Math.round(c / 25) * 25                    // ανοχή «αρκετά κοντινή σύνθεση»
```
- **Χωρίς `source`**: μετράει η σύνθεση, όχι ο τρόπος εισαγωγής.
- Δύο γεύματα με ίδιες θερμίδες αλλά διαφορετικά items → **διαφορετικό** fingerprint (δεν ομαδοποιούνται μόνο λόγω θερμίδων).
- Γεύμα χωρίς items: `normTitle + mealType + bucket(totalCalories)`.

## Ranking (backend — `src/server/services/meal-history.ts`)

SQL `GROUP BY mealFingerprint` (μόνο CONFIRMED, ανά userId) → `usageCount, lastUsedAt, firstUsedAt, avgCalories, representativeMealId`. Μετά score στο service:
```
daysSinceLast = (now - lastUsedAt) / 1d
recency       = 0.5 ^ (daysSinceLast / 14)            // half-life 14 ημέρες, (0,1]
contextMult   = 1.5 αν groupMealType == expectedMealTypeForNow(userTz) αλλιώς 1.0
score         = ln(1 + usageCount) * (0.5 + 0.5 * recency) * contextMult
```
`expectedMealTypeForNow` (ώρα στο timezone χρήστη): 05–10:59→BREAKFAST, 11–12:29→MORNING_SNACK, 12:30–15:59→LUNCH, 16–18:29→AFTERNOON_SNACK, 18:30–23→DINNER, αλλιώς→OTHER. Ο κυρίαρχος τύπος του group παίρνει το bonus.
Day-of-week: εκτός scope (spec: προαιρετικό).
**Το ranking γίνεται πάντα backend** — ο frontend μόνο εμφανίζει.

## Portion scaling (`src/lib/meal-scaling.ts`, decimal-safe, tested)

`scaleComposition(base, multiplier)`:
- multiplier ∈ {0.5, 1, 1.5, 2} ή custom > 0 (max 20).
- Κάθε πεδίο (calories, protein, carbohydrate, fat, fiber, sugar, saturatedFat, sodium) × multiplier σε `Prisma.Decimal`· στρογγυλοποίηση στο τέλος: grams → 2dp, calories/sodium → int.
- Per-item + total.
- Authoritative στο preview· το create ξανα-υπολογίζει από το server-side base (δεν εμπιστεύεται client αριθμούς).

## Quick-pick flow (χωρίς AI)

Κάρτα: τίτλος, τύπος, thumbnail (αν υπάρχει), θερμίδες, protein/carb/fat, #χρήσεων, τελευταία χρήση, κουμπί «Προσθήκη».

1. «Προσθήκη» → `POST /api/meals/quick-pick/preview` `{ ref: {kind:'favorite'|'frequent'|'recent', id}, servingMultiplier }` → επιστρέφει **scaled σύνθεση** (backend-authoritative). Καμία κλήση AI.
2. Preview drawer: αλλαγή mealType, μερίδας (0.5/1/1.5/2/custom), calories, macros, notes· `mealDateTime = τώρα`.
3. Τελική επιβεβαίωση → `POST /api/meals/quick-pick` `{ ref, servingMultiplier, overrides?, mealType, notes, requestKey }`:
   backend φορτώνει base (**ownership-checked**), scale, εφαρμόζει overrides, validate ranges, `createManualMeal(source=SAVED_MEAL)`.
   **Ανεξάρτητο copy** (μεταβολή παλιού δεν το αγγίζει). **Idempotent** via `requestKey`.

Το `ref` επιλύεται server-side:
- `favorite` → `FavoriteMeal` (userId-scoped) snapshot.
- `frequent` → representative CONFIRMED meal του fingerprint (userId-scoped).
- `recent` → συγκεκριμένο CONFIRMED meal (userId-scoped).

## API (όλα: auth από session, ownership-in-where, zod validation, IDOR-safe, consistent `ApiError`)

| Method | Route | Σκοπός |
|---|---|---|
| GET | `/api/meals/favorites` | Λίστα favorites (δικά, ranked recency/usage). |
| GET | `/api/meals/frequent?mealType=&limit=` | Ranked συχνά (context-aware, backend). |
| GET | `/api/meals/recent?limit=` | Τελευταία 5–10 CONFIRMED. |
| GET | `/api/meals` (reuse) | History search + pagination (+ calorie range). |
| POST | `/api/meals/quick-pick/preview` | Scaled σύνθεση (backend). |
| POST | `/api/meals/quick-pick` | Δημιουργία ανεξάρτητου meal (rate-limited, idempotent). |
| POST | `/api/meals/favorites` | Create favorite από ref (userId-scoped)· idempotent στο `[userId, fingerprint]` (υπάρχον → επιστρέφεται). |
| DELETE | `/api/meals/favorites/[id]` | Αφαίρεση favorite (userId-scoped· διαγράφει και το thumbKey αντίγραφο). |
| GET | `/api/meals/favorites/[id]/image` | Thumbnail favorite με authorization. |

- **Ποτέ `userId` από frontend** — πάντα από session.
- Rate limiting quick-pick: νέο `assertQuickPickRateLimit(userId)` με in-memory `hitLimit` (π.χ. 60/λεπτό) — αποτρέπει abuse χωρίς να εμποδίζει κανονική χρήση.
- IDOR: κάθε ref/favorite/meal ελέγχεται με `userId` στο where.

## UI (mobile-first, υπάρχον design system)

- **`/meals/add`** (server component): φορτώνει favorites/frequent/recent + options. Σειρά: **Αγαπημένα → Συχνά → Πρόσφατα → [Photo | Manual]**.
- Client sections: horizontal-scroll compact cards στο κινητό. Skeleton loading, empty states.
- Empty state (συχνά): «Τα γεύματα που χρησιμοποιείς συχνά θα εμφανίζονται εδώ.»
- Search area: input + calorie range + infinite scroll (καλεί `/api/meals`).
- Quick-pick preview: drawer με portion presets, editable calories/macros/notes/type, macro preview, **confirmation** πριν την καταχώριση, **toast** μετά.
- «Αποθήκευση/Αφαίρεση αγαπημένων» toggle σε κάρτες & meal detail.
- i18n: νέα κλειδιά el + en.
- Dashboard: το κουμπί «Add Meal» → `/meals/add` (το `/meals/new` παραμένει η photo-flow, προσβάσιμο από το hub).

## Privacy

- Κάθε query userId-scoped· κανένα cross-user recommendation.
- Φωτογραφίες (meal & favorite thumb) σερβίρονται με authorization.

## Tests (vitest)

Unit:
- fingerprint: ίδια σύνθεση → ίδιο· διαφορετικά items → διαφορετικό· ίδιες θερμίδες/διαφορετικά items → **όχι** ομαδοποίηση· diacritics/whitespace normalization.
- ranking: frequency + recency + context ordering (πρωί → πρωινά πρώτα).
- scaling: όλα τα macros, decimal-safe, στρογγυλοποιήσεις, custom multiplier.
- expectedMealTypeForNow ανά ώρα.

Integration (service-level, με test db/mock):
- user meal isolation σε favorites/frequent/recent.
- recent ordering + αποκλεισμός DRAFT/ANALYZING/REVIEW_REQUIRED/FAILED/CANCELLED.
- favorites-first ordering στο hub payload.
- quick-pick δημιουργεί **ανεξάρτητο** copy (mutate original → copy αμετάβλητο).
- **no AI request** από quick-pick (assert ο AI provider δεν καλείται).
- idempotent quick-pick (ίδιο requestKey → ένα meal).
- IDOR: user A δεν μπορεί preview/create/favorite ref του user B (NOT_FOUND).
- search filters (title/item/type/date/calorie-range).

## Deliverables

Migration (`mealFingerprint` + `favorite_meals` + backfill script), fingerprint/scaling libs, `meal-history` service, API routes, `/meals/add` hub + client components + quick-pick preview, i18n el/en, tests. Build + lint + tests πράσινα, χωρίς TODOs/placeholders/mocks.
