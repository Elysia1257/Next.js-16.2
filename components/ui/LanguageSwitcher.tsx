'use client';

import { useI18n } from '@/lib/i18n';
import { useState, useEffect } from 'react';

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  const toggle = () => setLocale(locale === 'zh' ? 'en' : 'zh');
  const label = locale === 'zh' ? 'Switch to English' : '切换到中文';
  const flag = locale === 'zh' ? 'EN' : '中';
  return <button onClick={toggle} className="fixed top-3 right-3 z-50 px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-800/80 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors" title={label}>{flag}</button>;
}
