'use client';

import { LanguageProvider } from '@/lib/i18n';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';

export function RootLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <LanguageSwitcher />
      {children}
    </LanguageProvider>
  );
}
