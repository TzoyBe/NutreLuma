'use client';

import * as React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Camera, ImagePlus, X } from 'lucide-react';
import { api, ApiClientError } from '@/lib/api-client';
import { IMAGE_ACCEPT_ATTR, MEAL_TYPES } from '@/lib/constants';
import { generateRequestKey } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Field, fieldAria, Input, Select, Textarea } from '@/components/ui/field';
import { Disclaimer } from '@/components/ui/misc';
import { useToast } from '@/components/toast';
import { useT } from '@/i18n/client';

function nowLocalInput(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(
    now.getHours(),
  )}:${pad(now.getMinutes())}`;
}

function defaultMealType(): (typeof MEAL_TYPES)[number] {
  const hour = new Date().getHours();
  if (hour < 10) return 'BREAKFAST';
  if (hour < 12) return 'MORNING_SNACK';
  if (hour < 16) return 'LUNCH';
  if (hour < 19) return 'AFTERNOON_SNACK';
  if (hour < 23) return 'DINNER';
  return 'OTHER';
}

export function MealUploadForm({ maxUploadMb }: { maxUploadMb: number }) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const requestKeyRef = React.useRef<string>(generateRequestKey());

  const [file, setFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [mealType, setMealType] = React.useState(defaultMealType());
  const [mealDateTime, setMealDateTime] = React.useState(nowLocalInput());
  const [title, setTitle] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function selectFile(selected: File | undefined) {
    if (!selected) return;
    // Ο έλεγχος τύπου είναι σκόπιμα χαλαρός: το iOS Safari δίνει συχνά ΚΕΝΟ
    // MIME για φωτογραφίες της κάμερας, οπότε ένας αυστηρός έλεγχος θα
    // απέρριπτε έγκυρες λήψεις. Απορρίπτουμε μόνο ό,τι δηλώνεται ρητά μη-εικόνα·
    // ο αυθεντικός έλεγχος (magic bytes) γίνεται στον server.
    if (selected.type && !selected.type.startsWith('image/')) {
      setErrors({ image: t('meal.fileTypeInvalid') });
      return;
    }
    if (selected.size > maxUploadMb * 1024 * 1024) {
      setErrors({ image: `${t('meal.fileTooLarge')} (max ${maxUploadMb} MB)` });
      return;
    }
    setErrors({});
    setFile(selected);
    // Νέα φωτογραφία = νέα υποβολή, άρα νέο κλειδί idempotency.
    requestKeyRef.current = generateRequestKey();
  }

  function clearFile() {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return; // αποτροπή διπλής υποβολής
    if (!file) {
      setErrors({ image: t('meal.noPhoto') });
      return;
    }

    setLoading(true);
    setErrors({});

    const form = new FormData();
    form.append('image', file);
    form.append('mealType', mealType);
    form.append('mealDateTime', mealDateTime);
    form.append('requestKey', requestKeyRef.current);
    if (title) form.append('title', title);
    if (notes) form.append('notes', notes);

    try {
      const result = await api.upload<{ meal: { id: string; analysisStatus: string } }>(
        '/api/meals',
        form,
      );
      toast.push(t('toast.mealCreated'), 'success');
      router.replace(`/meals/${result.meal.id}?created=1`);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError) {
        const fieldErrors = error.fieldErrors();
        setErrors(Object.keys(fieldErrors).length ? fieldErrors : { image: error.message });
        toast.push(error.message, 'error');
      } else {
        toast.push(t('errors.generic'), 'error');
      }
      // ΔΕΝ αλλάζουμε το requestKey: σε σφάλμα δικτύου δεν ξέρουμε αν ο server
      // πρόλαβε να δημιουργήσει το γεύμα. Κρατώντας το ίδιο κλειδί, μια δεύτερη
      // προσπάθεια επιστρέφει το ίδιο γεύμα αντί να φτιάξει διπλότυπο.
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="space-y-2">
        <span className="text-sm font-medium">{t('meal.photo')}</span>

        {previewUrl ? (
          <div className="relative overflow-hidden rounded-xl border border-border">
            {/* unoptimized: blob URL τοπικής προεπισκόπησης */}
            <Image
              src={previewUrl}
              alt={t('meal.preview')}
              width={800}
              height={600}
              unoptimized
              className="h-56 w-full object-cover sm:h-72"
            />
            <button
              type="button"
              onClick={clearFile}
              className="absolute right-2 top-2 rounded-full bg-black/60 p-2 text-white"
              aria-label={t('meal.changePhoto')}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus className="h-4 w-4" aria-hidden="true" />
              {t('meal.choosePhoto')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => cameraInputRef.current?.click()}
            >
              <Camera className="h-4 w-4" aria-hidden="true" />
              {t('meal.takePhoto')}
            </Button>
          </div>
        )}

        <input
          ref={fileInputRef}
          id="image"
          name="image"
          type="file"
          accept={IMAGE_ACCEPT_ATTR}
          className="sr-only"
          onChange={(e) => selectFile(e.target.files?.[0])}
          aria-label={t('meal.choosePhoto')}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => selectFile(e.target.files?.[0])}
          aria-label={t('meal.takePhoto')}
        />

        {errors.image ? (
          <p role="alert" className="text-xs font-medium text-destructive">
            {errors.image}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            JPEG, PNG, WebP, HEIC · max {maxUploadMb} MB
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('meal.type')} htmlFor="mealType" error={errors.mealType}>
          <Select
            {...fieldAria('mealType', errors.mealType)}
            value={mealType}
            onChange={(e) => setMealType(e.target.value as typeof mealType)}
          >
            {MEAL_TYPES.map((value) => (
              <option key={value} value={value}>
                {t(`mealType.${value}` as never)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t('meal.dateTime')} htmlFor="mealDateTime" error={errors.mealDateTime}>
          <Input
            {...fieldAria('mealDateTime', errors.mealDateTime)}
            type="datetime-local"
            value={mealDateTime}
            onChange={(e) => setMealDateTime(e.target.value)}
            required
          />
        </Field>
      </div>

      <Field label={t('meal.titleField')} htmlFor="title" error={errors.title}>
        <Input
          {...fieldAria('title', errors.title)}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
        />
      </Field>

      <Field label={t('meal.notes')} htmlFor="notes" error={errors.notes}>
        <Textarea
          {...fieldAria('notes', errors.notes)}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('meal.notesPlaceholder')}
          maxLength={500}
        />
      </Field>

      <Disclaimer text={t('app.disclaimer')} />

      <Button type="submit" size="lg" block loading={loading} disabled={!file}>
        {loading ? t('meal.analyzing') : t('meal.analyze')}
      </Button>

      {loading ? (
        <p className="text-center text-sm text-muted-foreground" aria-live="polite">
          {t('meal.analyzingHint')}
        </p>
      ) : null}
    </form>
  );
}
