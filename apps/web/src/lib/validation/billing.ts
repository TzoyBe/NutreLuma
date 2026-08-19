import { z } from 'zod';

export const extendSubscriptionSchema = z.object({
  userId: z.string().cuid('Μη έγκυρο αναγνωριστικό χρήστη.'),
  months: z.coerce
    .number()
    .int('Οι μήνες πρέπει να είναι ακέραιος.')
    .min(1, 'Τουλάχιστον 1 μήνας.')
    .max(24, 'Το πολύ 24 μήνες.'),
  note: z.string().trim().max(300).optional().or(z.literal('')),
});

export type ExtendSubscriptionInput = z.infer<typeof extendSubscriptionSchema>;
