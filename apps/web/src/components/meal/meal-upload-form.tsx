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

function isHeicLikeFile(file: File): boolean {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return (
    type === 'image/heic' ||
    type === 'image/heif' ||
    name.endsWith('.heic') ||
    name.endsWith('.heif')
  );
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
  const [preparingImage, setPreparingImage] = React.useState(false);

  React.useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function selectFile(selected: File | undefined) {
    if (!selected) return;
    if (selected.type && !selected.type.startsWith('image/')) {
      setErrors({ image: t('meal.fileTypeInvalid') });
      return;
    }
    if (selected.size > maxUploadMb * 1024 * 1024) {
      setErrors({ image: `${t('meal.fileTooLarge')} (max ${maxUploadMb} MB)` });
      return;
    }

    setPreparingImage(true);
    try {
      let normalizedFile = selected;

      if (isHeicLikeFile(selected)) {
        const { default: heic2any } = await import('heic2any');
        const converted = await heic2any({
          blob: selected,
          toType: 'image/jpeg',
          quality: 0.9,
        });
        const convertedBlob = Array.isArray(converted) ? converted[0] : converted;
        if (!(convertedBlob instanceof Blob)) {
          throw new Error('HEIC conversion did not return a Blob.');
        }
        normalizedFile = new File(
          [convertedBlob],
          selected.name.replace(/\.(heic|heif)$/i, '.jpg'),
          { type: 'image/jpeg', lastModified: selected.lastModified },
        );
      }

      if (normalizedFile.size > maxUploadMb * 1024 * 1024) {
        setErrors({ image: `${t('meal.fileTooLarge')} (max ${maxUploadMb} MB)` });
        return;
      }

      setErrors({});
      setFile(normalizedFile);
      requestKeyRef.current = generateRequestKey();
    } catch {
      setErrors({ image: t('meal.heicConversionFailed') });
    } finally {
      setPreparingImage(false);
    }
  }

  function clearFile() {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || preparingImage) return;
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
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="space-y-2">
        <span className="text-sm font-medium">{t('meal.photo')}</span>

        {previewUrl ? (
          <div className="relative overflow-hidden rounded-xl border border-border">
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
              disabled={preparingImage || loading}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus className="h-4 w-4" aria-hidden="true" />
              {t('meal.choosePhoto')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={preparingImage || loading}
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
          onChange={(e) => void selectFile(e.target.files?.[0])}
          aria-label={t('meal.choosePhoto')}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => void selectFile(e.target.files?.[0])}
          aria-label={t('meal.takePhoto')}
        />

        {errors.image ? (
          <p role="alert" className="text-xs font-medium text-destructive">
            {errors.image}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {preparingImage ? t('meal.preparingPhoto') : `JPEG, PNG, WebP, HEIC · max ${maxUploadMb} MB`}
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

      <Button
        type="submit"
        size="lg"
        block
        loading={loading || preparingImage}
        disabled={!file || preparingImage}
      >
        {loading ? t('meal.analyzing') : t('meal.analyze')}
      </Button>

      {loading || preparingImage ? (
        <p className="text-center text-sm text-muted-foreground" aria-live="polite">
          {preparingImage ? t('meal.preparingPhoto') : t('meal.analyzingHint')}
        </p>
      ) : null}
    </form>
  );
}
