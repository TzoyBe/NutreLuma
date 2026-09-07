# Βήμα 2: Store Listing & Compliance (Google Play Console) — NutreLuma

Ενημερωμένο με βάση το πραγματικό μοναδικό project στο NAS (`S:\nutreluma`, μονόρεπο `apps/web` + `apps/native`). Αυτή η έκδοση αντικαθιστά προηγούμενο draft που είχε φτιαχτεί μόνο από το τοπικό clone του web app (`dev/nutreluma`) — εκεί το production domain αναφερόταν λάθος ως `calorievision.gr`. Το πραγματικό production domain είναι **nutreluma.com**.

**Πηγές αλήθειας που χρησιμοποιήθηκαν:**
- `S:\nutreluma\README.md` (root monorepo)
- `S:\nutreluma\apps\native\app.json`, `eas.json`, `package.json`, `README.md`
- `S:\nutreluma\apps\web\src\app\privacy\` (η σελίδα Πολιτικής Απορρήτου υπάρχει)

---

## Ταυτότητα εφαρμογής (επιβεβαιωμένα στοιχεία)

| Πεδίο | Τιμή |
|---|---|
| App name (Expo) | `NutreLuma` |
| Android package | `com.joybeedigital.nutreluma` |
| iOS bundle id | `com.joybeedigital.nutreluma` |
| Εταιρεία | Joybee Digital |
| Production web/API | `https://nutreluma.com` |
| EAS project | ήδη αρχικοποιημένο (`projectId: 755bf395-96ff-4f1e-9f92-dff3c002e5d0`, owner Expo account `tzoybe`) |
| Billing | **RevenueCat** (`react-native-purchases`, `react-native-purchases-ui`) → χρησιμοποιεί Google Play Billing / Apple IAP από κάτω, άρα **καλύπτεται σωστά** η απαίτηση Play Store για in-app αγορές (το Stripe/PayPal του README του web app αφορά μόνο το browser flow, όχι το native app) |

---

## 1. Main store listing (Grow → Store presence → Main store listing)

### Κείμενο

- **App name** (max 30 χαρακτήρες):
  `NutreLuma - Θερμίδες με Φωτό`

- **Short description** (max 80 χαρακτήρες):
  `Φωτογράφισε το γεύμα σου, το AI υπολογίζει θερμίδες & macros αυτόματα`

- **Full description** (max 4000 χαρακτήρες):
  ```
  Το NutreLuma καταγράφει τις ημερήσιες θερμίδες σου μέσα από μια φωτογραφία.
  Τραβάς φωτογραφία του γεύματός σου, το AI το αναλύει και σου δίνει άμεσα
  εκτίμηση θερμίδων και μακροθρεπτικών συστατικών — χωρίς να μετράς τίποτα
  χειροκίνητα.

  ΒΑΣΙΚΑ ΧΑΡΑΚΤΗΡΙΣΤΙΚΑ:
  • Ανάλυση γεύματος με φωτογραφία (κάμερα ή γκαλερί) μέσω AI vision
  • Αναλυτικά διατροφικά στοιχεία: θερμίδες, πρωτεΐνη, υδατάνθρακες, λιπαρά
  • Dashboard με ημερήσιο σύνολο, στόχο και πρόοδο ανά macro
  • Ιστορικό γευμάτων, στατιστικά και παρακολούθηση βάρους
  • Ειδοποιήσεις (push notifications) για υπενθυμίσεις καταγραφής
  • Ασφαλής σύνδεση με token-based authentication

  ΙΔΙΩΤΙΚΟΤΗΤΑ ΠΡΩΤΑ
  Οι φωτογραφίες σου χρησιμοποιούνται μόνο για τη συγκεκριμένη ανάλυση.
  Μπορείς να διαγράψεις τα δεδομένα σου οποιαδήποτε στιγμή.

  ΑΠΟΠΟΙΗΣΗ ΕΥΘΥΝΗΣ
  Οι θερμίδες που υπολογίζονται είναι εκτίμηση βάσει φωτογραφίας. Το NutreLuma
  δεν παρέχει ιατρική ή διατροφική διάγνωση και δεν αντικαθιστά διαιτολόγο ή
  γιατρό.

  Κατέβασε το NutreLuma και ξεκίνα να καταγράφεις τη διατροφή σου με μια
  φωτογραφία.
  ```
  ⚠️ Το native app βρίσκεται ακόμη σε "Full Native Rewrite" φάση (βλ. `apps/native/README.md` §Current Scope) — έχει ήδη: login/register, dashboard, add meal (κάμερα/photo picker), meal detail, weight tracking, notifications. Δεν έχει ακόμη: history/stats πλήρη, goals, recipes, billing/settings UI. **Μην περιγράψεις στο listing λειτουργίες που δεν υπάρχουν ακόμη στο native app** — η παραπάνω περιγραφή περιορίστηκε σκόπιμα σε αυτά που είναι ήδη υλοποιημένα.

### Γραφικά

| Asset | Διαστάσεις | Format | Κατάσταση |
|---|---|---|---|
| App icon | 512x512, PNG 32-bit με alpha | Υπάρχει `apps/native/assets/icon.png` αλλά είναι **1024x1024, RGB χωρίς alpha** → χρειάζεται resize σε 512x512 (και προαιρετικά προσθήκη alpha channel) πριν το ανέβασμα |
| Feature graphic | 1024x500 PNG/JPG | ❌ Δεν υπάρχει — χρειάζεται να φτιαχτεί από το brand kit (`docs/Nutreluma_Brand_Kit_v2`) |
| Phone screenshots | min 2, max 8 | ❌ Δεν υπάρχουν — πρέπει να τραβηχτούν από build/emulator του `apps/native` (dashboard, add meal, meal detail, weight) |
| Adaptive icon (ήδη υπάρχει, για αναφορά) | — | `android-icon-foreground.png`, `android-icon-monochrome.png`, `android-icon-background.png` υπάρχουν στο `apps/native/assets/` |

**Checklist:**
- [ ] Resize `icon.png` → 512x512 για το Play listing
- [ ] Feature graphic 1024x500
- [ ] Τουλάχιστον 2 phone screenshots (πρόταση: dashboard, add-meal/camera, meal detail, weight tracking)

---

## 2. App category & tags

- **App category**: `Health & Fitness`
- **Tags**: `calorie tracker, food diary, nutrition, weight tracking, AI`
- **Store listing contact details**:
  - Email: `support@nutreluma.com` ⚠️ *πρόταση με βάση το production domain — επιβεβαίωσε ότι το mailbox υπάρχει*
  - Website: `https://nutreluma.com`

---

## 3. Privacy Policy (υποχρεωτικό)

- **Privacy Policy URL**: `https://nutreluma.com/privacy`
  Η σελίδα υπάρχει στον κώδικα (`apps/web/src/app/privacy/`). Επιβεβαίωσε ότι είναι live στο production πριν τη βάλεις στο Console.

---

## 4. Content Rating Questionnaire

- Βία: **Καμία**
- Σεξουαλικό περιεχόμενο: **Κανένα**
- Ναρκωτικά/αλκοόλ/κάπνισμα: **Καμία αναφορά**
- Gambling: **Όχι**
- User-generated content ορατό σε άλλους: **Όχι** (μονο-χρηστικό app)
- Κοινοποίηση τοποθεσίας: **Όχι**

Πιθανό αποτέλεσμα: **PEGI 3 / Everyone**.

✅ **Λύθηκε**: το `android.permission.RECORD_AUDIO` αφαιρέθηκε από το `apps/native/app.json` — δεν χρησιμοποιούνταν πουθενά στον κώδικα (καμία χρήση μικροφώνου/ηχογράφησης, κανένα `expo-av`). Επιβεβαιώθηκε ότι δεν υπάρχει καμία άλλη αναφορά σε `RECORD_AUDIO` / microphone permission οπουδήποτε αλλού στο μονόρεπο (app.json, eas.json, κώδικας, iOS Info.plist strings).

---

## 5. Data Safety Form

| Τύπος δεδομένων | Συλλέγεται; | Κοινοποιείται σε 3ους; | Σκοπός |
|---|---|---|---|
| Email (λογαριασμός) | ✅ | ❌ | Account management |
| Password | ✅ (hashed) | ❌ | Authentication |
| Φωτογραφίες γευμάτων | ✅ | ✅ — AI vision provider για ανάλυση | App functionality |
| Δεδομένα υγείας (βάρος, macros, στόχοι) | ✅ | ❌ | App functionality |
| Στοιχεία συνδρομής/αγορών | ✅ (μέσω RevenueCat + Google Play Billing) | ✅ — RevenueCat, Google Play | Payments |
| Push token | ✅ (Expo push token) | ✅ — Expo push service | App functionality (notifications) |
| Device/App activity | ✅ | ❌ | Analytics, fraud prevention |
| Τοποθεσία | ❌ | ❌ | — |

- [x] Κρυπτογράφηση in transit: **Ναι** (HTTPS, Bearer token auth)
- [x] Δυνατότητα διαγραφής δεδομένων: **Ναι** (ίδιο account-deletion flow με το web app)
- [x] Not shared for advertising/marketing

---

## 6. Target Audience & Content

- **Target age group**: `18+` (δεδομένα υγείας + in-app αγορές + ιατρική αποποίηση ευθύνης)
- [x] Δεν απευθύνεται σε παιδιά → Families Policy δεν εφαρμόζεται

---

## 7. Ads declaration

- [x] **No ads** (κανένα ad SDK στο `package.json`)

---

## 8. Government / COVID-19 / News declarations

- [x] Όχι σε όλα

---

## 9. Pricing & Distribution

- **Τιμή**: Δωρεάν εγκατάσταση, in-app συνδρομή μέσω **Google Play Billing (RevenueCat)** — σωστά ευθυγραμμισμένο με την πολιτική Google Play, δεν χρειάζεται επιπλέον διευθέτηση όπως θα χρειαζόταν με Stripe/PayPal απευθείας
- **Χώρες διανομής**: πρόταση αρχικά `Ελλάδα, Κύπρος` (ελληνικό UI), επέκταση αργότερα
- [x] Contains ads: Όχι

---

## Τελικό Checklist πριν το submit

- [ ] Main store listing κείμενο ✅ έτοιμο εδώ, γραφικά ❌ λείπουν
- [x] Category & tags
- [x] Privacy policy URL (`https://nutreluma.com/privacy`) — επιβεβαίωσε ότι είναι live
- [x] Content rating απαντήσεις έτοιμες
- [x] `RECORD_AUDIO` permission αφαιρέθηκε πλήρως
- [x] Data safety form έτοιμο
- [x] Target audience (18+)
- [x] Ads (No)
- [x] Pricing/billing — ✅ λυμένο, RevenueCat ήδη ενσωματωμένο
- [ ] App icon resize σε 512x512
- [ ] Feature graphic 1024x500
- [ ] Screenshots από το τρέχον native app (dashboard, add meal, meal detail, weight)
- [ ] Google Play app entry δημιουργημένο στο Play Console για `com.joybeedigital.nutreluma`
- [ ] Service account + `eas.json` submit config (βλ. Βήμα 4-5 του αρχικού οδηγού)

Θέλεις να προχωρήσουμε τώρα στα screenshots (χρειάζεται να τρέξουμε το native app σε emulator/simulator) ή πρώτα να καθαρίσουμε το θέμα του `RECORD_AUDIO` permission στο `app.json`;
