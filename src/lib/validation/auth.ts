import { z } from 'zod';

export const emailSchema = z
  .string({ required_error: 'Το email είναι υποχρεωτικό.' })
  .trim()
  .toLowerCase()
  .min(5, 'Το email είναι πολύ σύντομο.')
  .max(254, 'Το email είναι πολύ μεγάλο.')
  .email('Δώσε ένα έγκυρο email.');

export const passwordSchema = z
  .string({ required_error: 'Ο κωδικός είναι υποχρεωτικός.' })
  .min(10, 'Ο κωδικός πρέπει να έχει τουλάχιστον 10 χαρακτήρες.')
  .max(128, 'Ο κωδικός είναι πολύ μεγάλος.')
  .regex(/[a-z]/, 'Ο κωδικός πρέπει να περιέχει πεζό γράμμα.')
  .regex(/[A-Z]/, 'Ο κωδικός πρέπει να περιέχει κεφαλαίο γράμμα.')
  .regex(/[0-9]/, 'Ο κωδικός πρέπει να περιέχει αριθμό.');

export const registerSchema = z
  .object({
    email: emailSchema,
    displayName: z
      .string({ required_error: 'Το όνομα εμφάνισης είναι υποχρεωτικό.' })
      .trim()
      .min(2, 'Το όνομα εμφάνισης πρέπει να έχει τουλάχιστον 2 χαρακτήρες.')
      .max(60, 'Το όνομα εμφάνισης είναι πολύ μεγάλο.'),
    password: passwordSchema,
    passwordConfirm: z.string(),
    consent: z.literal(true, {
      errorMap: () => ({ message: 'Πρέπει να αποδεχτείς την πολιτική απορρήτου για να συνεχίσεις.' }),
    }),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    path: ['passwordConfirm'],
    message: 'Οι κωδικοί δεν ταιριάζουν.',
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Ο κωδικός είναι υποχρεωτικός.').max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    // 32 bytes σε base64url δίνουν 43 χαρακτήρες· αφήνουμε περιθώριο.
    token: z
      .string({ required_error: 'Λείπει ο σύνδεσμος επαναφοράς.' })
      .trim()
      .min(20, 'Μη έγκυρος σύνδεσμος επαναφοράς.')
      .max(200, 'Μη έγκυρος σύνδεσμος επαναφοράς.')
      .regex(/^[A-Za-z0-9_-]+$/, 'Μη έγκυρος σύνδεσμος επαναφοράς.'),
    password: passwordSchema,
    passwordConfirm: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    path: ['passwordConfirm'],
    message: 'Οι κωδικοί δεν ταιριάζουν.',
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Ο τρέχων κωδικός είναι υποχρεωτικός.'),
    newPassword: passwordSchema,
    newPasswordConfirm: z.string(),
  })
  .refine((d) => d.newPassword === d.newPasswordConfirm, {
    path: ['newPasswordConfirm'],
    message: 'Οι κωδικοί δεν ταιριάζουν.',
  });

/**
 * Λέξεις επιβεβαίωσης διαγραφής, μία ανά γλώσσα του UI.
 *
 * Δεχόμαστε και τις δύο ανεξάρτητα από την επιλεγμένη γλώσσα: χρήστης με
 * αγγλικό πληκτρολόγιο δεν μπορεί να πληκτρολογήσει «ΔΙΑΓΡΑΦΗ», και θα έμενε
 * κλειδωμένος έξω από τη διαγραφή του ίδιου του λογαριασμού του.
 */
export const DELETE_CONFIRMATIONS = ['ΔΙΑΓΡΑΦΗ', 'DELETE'] as const;

export const deleteAccountSchema = z.object({
  password: z.string().optional().default(''),
  confirmation: z
    .string()
    .transform((value) => value.trim().toUpperCase())
    .refine((value) => (DELETE_CONFIRMATIONS as readonly string[]).includes(value), {
      message: 'Πληκτρολόγησε ΔΙΑΓΡΑΦΗ ή DELETE για επιβεβαίωση.',
    }),
});
