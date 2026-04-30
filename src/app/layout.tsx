import type { Metadata, Viewport } from 'next';
import { Manrope, Source_Sans_3, Noto_Sans_JP, JetBrains_Mono } from 'next/font/google';
import { AxeReporter } from '@/components/dev/axe-reporter';
import './globals.css';

// 見出し: Manrope (design-system.yml typography.heading)
const manrope = Manrope({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-heading',
  weight: ['600', '700'],
});

// 本文 (Latin): Source Sans 3 (design-system.yml typography.body)
const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
  weight: ['400', '500'],
});

// 本文 (JP): Noto Sans JP (design-system.yml typography.jp)
const notoJp = Noto_Sans_JP({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jp',
  weight: ['400', '500', '600', '700'],
});

// 等幅: JetBrains Mono (コード/ID 表示)
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: {
    default: 'Security Checklist Tool',
    template: '%s | Security Checklist Tool',
  },
  description:
    'URL一つで、セキュリティ対策の地図が手に入る。27ガイドライン横断のチェックシート自動生成ツール。',
  applicationName: 'Security Checklist Tool',
  authors: [{ name: 'Customer Cloud' }],
  keywords: ['security', 'checklist', 'compliance', 'IPA', 'METI', 'NIST', 'guideline'],
  robots: {
    index: false, // 認証必須プロダクトのため検索インデックス対象外
    follow: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAFAF7' },
    { media: '(prefers-color-scheme: dark)', color: '#0F2540' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ja"
      className={`${manrope.variable} ${sourceSans.variable} ${notoJp.variable} ${jetbrains.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh bg-background font-body text-foreground antialiased">
        <AxeReporter />
        {children}
      </body>
    </html>
  );
}
