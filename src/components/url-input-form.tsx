'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'motion/react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { urlSchema, type UrlFormInput } from '@/lib/validation/url-schema';

/**
 * S1 トップ画面 URL 入力フォーム。
 *
 * Cycle 2.1 (本コミット) は UI + zod 検証のみを実装。
 * Cycle 2.4 で `POST /api/v1/companies` 呼び出しと /companies/[id] 遷移に置換予定。
 */
export function UrlInputForm() {
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UrlFormInput>({
    resolver: zodResolver(urlSchema),
    mode: 'onSubmit',
  });

  const onValid = async (data: UrlFormInput) => {
    setSubmitting(true);
    try {
      // TODO(#7 Cycle 2.4): POST /api/v1/companies → router.push(`/companies/${id}`)
      toast.info('URL を受け付けました', {
        description: `分析処理は Wave 2 後続で実装されます: ${data.url}`,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const errorMessage = errors.url?.message;

  return (
    <motion.form
      onSubmit={handleSubmit(onValid)}
      noValidate
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="mt-10 w-full"
      aria-label="URL を入力してチェックシートを生成"
    >
      <Label htmlFor="company-url" className="sr-only">
        分析対象の URL
      </Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="company-url"
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://your-company.example.jp"
          aria-invalid={errorMessage ? 'true' : 'false'}
          aria-describedby={errorMessage ? 'company-url-error' : undefined}
          disabled={submitting}
          className="h-12 flex-1 text-base"
          {...register('url')}
        />
        <Button type="submit" size="lg" disabled={submitting} className="h-12 sm:w-44">
          {submitting ? (
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          ) : (
            <>
              分析を開始
              <ArrowRight className="ml-2 size-4" aria-hidden="true" />
            </>
          )}
        </Button>
      </div>
      {errorMessage ? (
        <p
          id="company-url-error"
          role="alert"
          className="mt-2 text-sm text-destructive"
        >
          {errorMessage}
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          公開情報のみクロールします (SSRF対策済み)。https のみ対応。
        </p>
      )}
    </motion.form>
  );
}
