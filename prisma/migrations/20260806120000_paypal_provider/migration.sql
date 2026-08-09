-- Δεύτερος τρόπος πληρωμής: PayPal.
--
-- Καθαρά προσθετικό: νέα τιμή enum, καμία υπάρχουσα γραμμή δεν αλλάζει.
-- Το ALTER TYPE ... ADD VALUE δεν μπορεί να τρέξει μέσα σε transaction block σε
-- παλαιότερες εκδόσεις Postgres· το `IF NOT EXISTS` το κάνει επαναλήψιμο.
ALTER TYPE "SubscriptionProvider" ADD VALUE IF NOT EXISTS 'PAYPAL';
