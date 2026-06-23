'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

// ============================================================
// Translation dictionaries
// ============================================================

const zh = {
  common: {
    model: '模型',
    prompt: '提示词',
    aspectRatio: '比例',
    resolution: '分辨率',
    quality: '质量',
    generating: '生成中...',
    delete: '删除',
    connect: '连接',
    invalid: '无效引用',
  },
  nodes: {
    image: {
      header: '图片生成',
      modelDesc: '模型',
      promptPlaceholder: '描述你想生成的图片...',
      generate: '生成图片',
      refImages: '参考图',
      preview: '预览',
    },
    video: {
      header: '视频生成',
      promptPlaceholder: '描述你想生成的视频...',
      generate: '生成视频',
      duration: '时长',
      audio: '音频',
      refImages: '参考图',
      mode: '模式',
      text2video: '文生视频',
      img2video: '图生视频',
      ref2video: '参考生视频',
      startEnd2video: '首尾帧视频',
    },
    startEnd: {
      header: '首尾帧视频',
      promptPlaceholder: '描述过渡效果...',
      generate: '生成首尾帧视频',
      startFrame: '开始帧',
      endFrame: '结束帧',
      connectSource: '连接素材',
    },
    imageSource: {
      header: '图片素材',
      replace: '替换文件',
      output: '输出：图片',
    },
  },
};

const en = {
  common: {
    model: 'Model',
    prompt: 'Prompt',
    aspectRatio: 'Aspect Ratio',
    resolution: 'Resolution',
    quality: 'Quality',
    generating: 'Generating...',
    delete: 'Delete',
    connect: 'Connect',
    invalid: 'Invalid Ref',
  },
  nodes: {
    image: {
      header: 'Image',
      modelDesc: 'Model',
      promptPlaceholder: 'Describe the image...',
      generate: 'Generate Image',
      refImages: 'Reference Images',
      preview: 'Preview',
    },
    video: {
      header: 'Video',
      promptPlaceholder: 'Describe the video...',
      generate: 'Generate Video',
      duration: 'Duration',
      audio: 'Audio',
      refImages: 'Reference Images',
      mode: 'Mode',
      text2video: 'Text to Video',
      img2video: 'Image to Video',
      ref2video: 'Reference to Video',
      startEnd2video: 'Start-End Video',
    },
    startEnd: {
      header: 'Start-End Video',
      promptPlaceholder: 'Describe the transition...',
      generate: 'Generate Start-End Video',
      startFrame: 'Start Frame',
      endFrame: 'End Frame',
      connectSource: 'Connect Source',
    },
    imageSource: {
      header: 'Image Source',
      replace: 'Replace File',
      output: 'OUTPUT: IMAGE',
    },
  },
};

const dictionaries = { zh, en } as const;
export type Locale = keyof typeof dictionaries;
export type TranslationDict = typeof zh;

// ============================================================
// Context
// ============================================================

interface I18nContextType {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  locale: 'zh',
  setLocale: () => {},
  t: (key: string) => key,
});

export function useI18n() {
  return useContext(I18nContext);
}

// ============================================================
// Provider
// ============================================================

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('zh');

  useEffect(() => {
    const saved = localStorage.getItem('cubex-lang') as Locale | null;
    if (saved && (saved === 'zh' || saved === 'en')) {
      setLocaleState(saved);
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem('cubex-lang', l);
  }, []);

  const t = useCallback(
    (key: string) => {
      const dict = dictionaries[locale] as Record<string, unknown>;
      const keys = key.split('.');
      let val: unknown = dict;
      for (const k of keys) {
        if (val && typeof val === 'object' && k in val) {
          val = (val as Record<string, unknown>)[k];
        } else {
          return key;
        }
      }
      return typeof val === 'string' ? val : key;
    },
    [locale],
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}
