# PayPal — οδηγίες ρύθμισης

Δεύτερος τρόπος πληρωμής, δίπλα στη Stripe. Ο χρήστης διαλέγει.

Αν λείπει οποιαδήποτε από τις τρεις τιμές, η επιλογή PayPal **δεν εμφανίζεται
καθόλου** και η εφαρμογή δουλεύει κανονικά με κάρτα.

---

## 1. Τι χρειάζεσαι

| Τιμή | Πού βρίσκεται | Μυστικό; |
|---|---|:--:|
| `PAYPAL_CLIENT_ID` | Developer Dashboard → My Apps & Credentials → η εφαρμογή σου | **Όχι** |
| `PAYPAL_CLIENT_SECRET` | Ίδια σελίδα, κουμπί **Show** δίπλα στο Secret | **ΝΑΙ** |
| `PAYPAL_PLAN_ID` | Το πλάνο συνδρομής (αρχίζει με `P-…`) | Όχι |

> Το **client id** μπαίνει εκ σχεδιασμού μέσα στο JavaScript που κατεβάζει ο
> browser — είναι δημόσιο και δεν πειράζει να φαίνεται. Το **secret** δεν φεύγει
> ποτέ από τον server· χρησιμοποιείται μόνο για να ρωτήσουμε την PayPal αν μια
> συνδρομή είναι αληθινή.

---

## 2. Γιατί χρειάζεται οπωσδήποτε το secret

Το έτοιμο snippet που δίνει το PayPal button factory τελειώνει έτσι:

```js
onApprove: function(data, actions) {
  alert(data.subscriptionID);
}
```

Αν στέλναμε αυτό το id στον server και δίναμε πρόσβαση, **οποιοσδήποτε θα
μπορούσε να στείλει ένα οποιοδήποτε id και να ξεκλειδώσει τον λογαριασμό του
δωρεάν**. Το id έρχεται από τον browser, άρα είναι πλήρως ελεγχόμενο από τον
χρήστη.

Γι' αυτό η εφαρμογή ρωτά την ίδια την PayPal (με το secret) και ελέγχει:

1. **Πλάνο** — η συνδρομή αφορά το δικό μας `PAYPAL_PLAN_ID`.
2. **Ιδιοκτησία** — το `custom_id` της συνδρομής είναι ο συνδεδεμένος χρήστης.
3. **Μοναδικότητα** — η ίδια συνδρομή δεν έχει ήδη χρησιμοποιηθεί αλλού.
4. **Κατάσταση** — είναι όντως `ACTIVE`.

Μόνο αν περάσουν και τα τέσσερα δίνεται πρόσβαση.

---

## 3. Δημιουργία πλάνου συνδρομής

**Sandbox πρώτα.** Στο [developer.paypal.com](https://developer.paypal.com):

1. **Apps & Credentials** → διάλεξε **Sandbox** → **Create App** (τύπος: Merchant).
2. Αντίγραψε Client ID και Secret.
3. Φτιάξε προϊόν και πλάνο 3,00 € / μήνα. Από το Dashboard:
   **Pay & Get Paid → Subscriptions → Create plan**.

<details>
<summary>Ή με curl</summary>

```bash
BASE=https://api-m.sandbox.paypal.com
TOKEN=$(curl -sS -u "$CLIENT_ID:$CLIENT_SECRET" \
  -d grant_type=client_credentials "$BASE/v1/oauth2/token" \
  | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')

# Προϊόν
curl -sS -X POST "$BASE/v1/catalogs/products" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"NutreLuma","type":"SERVICE","category":"SOFTWARE"}'

# Πλάνο 3,00 EUR / μήνα  (βάλε το product id από πάνω)
curl -sS -X POST "$BASE/v1/billing/plans" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "product_id": "PROD-XXXX",
    "name": "NutreLuma Monthly",
    "billing_cycles": [{
      "frequency": {"interval_unit":"MONTH","interval_count":1},
      "tenure_type":"REGULAR","sequence":1,"total_cycles":0,
      "pricing_scheme":{"fixed_price":{"value":"3.00","currency_code":"EUR"}}
    }],
    "payment_preferences": {"auto_bill_outstanding": true}
  }'
```

</details>

---

## 4. Ρύθμιση στο NAS

```sh
export PATH=/share/CACHEDEV1_DATA/.qpkg/container-station/bin:$PATH
export HOME=/tmp/nutreluma-deploy; export DOCKER_CONFIG=$HOME/.docker
cd /share/Container/nutreluma

sed -i 's|^PAYPAL_CLIENT_ID=.*|PAYPAL_CLIENT_ID=ΤΟ_ΔΙΚΟ_ΣΟΥ|' .env
sed -i 's|^PAYPAL_CLIENT_SECRET=.*|PAYPAL_CLIENT_SECRET=ΤΟ_ΔΙΚΟ_ΣΟΥ|' .env
sed -i 's|^PAYPAL_PLAN_ID=.*|PAYPAL_PLAN_ID=P-ΤΟ_ΔΙΚΟ_ΣΟΥ|' .env
sed -i 's|^PAYPAL_ENV=.*|PAYPAL_ENV=sandbox|' .env

docker compose --env-file .env up -d --force-recreate --no-build web
```

Επιβεβαίωσε ότι έφτασαν στο container:

```sh
docker inspect nutreluma-web --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | grep -E "^PAYPAL_" | sed -E 's/(SECRET=).*/\1<κρυμμένο>/'
```

---

## 5. Δοκιμή

1. Μπες με λογαριασμό **που δεν είναι ADMIN**.
2. **Συνδρομή** → επίλεξε **PayPal**.
3. Πλήρωσε με sandbox αγοραστή: Developer Dashboard → **Testing Tools →
   Sandbox Accounts** (υπάρχει έτοιμος προσωπικός λογαριασμός με κωδικό).
4. Μετά την έγκριση η σελίδα ανανεώνεται και η κατάσταση γίνεται ενεργή.

Έλεγχος στα logs ότι πέρασε η επαλήθευση:

```sh
docker compose logs --tail 100 web | grep -E "subscription_activated|paypal_"
```

Αν δεις `paypal_owner_mismatch` ή `paypal_plan_mismatch`, η επαλήθευση έκανε
ακριβώς τη δουλειά της.

---

## 6. Μετάβαση σε live

1. Στο Developer Dashboard γύρνα σε **Live** και φτιάξε **νέα** εφαρμογή.
2. Ξαναδημιούργησε προϊόν και πλάνο σε live — τα sandbox δεδομένα **δεν**
   μεταφέρονται.
3. Βάλε τα live `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_PLAN_ID`
   και `PAYPAL_ENV=live` στο `.env`.
4. `docker compose --env-file .env up -d --force-recreate --no-build web`

> ⚠️ Από εκείνη τη στιγμή κάθε πληρωμή είναι αληθινή. Ισχύουν και οι
> φορολογικές υποχρεώσεις που συζητήσαμε για τη Stripe.

---

## 7. Ακύρωση συνδρομής

Η ακύρωση από τη σελίδα «Συνδρομή» καλεί το PayPal API. Η PayPal σταματά τις
μελλοντικές χρεώσεις **αμέσως**, αλλά η ήδη πληρωμένη περίοδος δεν
επιστρέφεται — γι' αυτό η εφαρμογή **δεν** μειώνει το `accessUntil` και ο
χρήστης κρατά πρόσβαση μέχρι τη λήξη του μήνα που πλήρωσε.

---

## 8. Γνωστός περιορισμός: χωρίς webhooks

Όπως και στη Stripe, δεν υπάρχει δημόσιο URL, οπότε δεν λαμβάνουμε webhooks.
Ο συγχρονισμός γίνεται **outbound**: όταν λήξει η πρόσβαση ενός χρήστη, η
εφαρμογή ρωτά η ίδια την PayPal (το πολύ μία φορά ανά 5 λεπτά ανά χρήστη).

Πρακτική συνέπεια: μια ανανέωση μπορεί να φανεί με μικρή καθυστέρηση. Η
περίοδος χάριτος (`SUBSCRIPTION_GRACE_DAYS`) καλύπτει ακριβώς αυτό το κενό,
ώστε να μη κλειδωθεί χρήστης που έχει πληρώσει κανονικά.
