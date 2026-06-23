export const zh: any = {"common": {"model": "模型", "prompt": "提示词", "aspectRatio": "比例", "resolution": "分辨率", "quality": "画质", "generating": "生成中...", "delete": "删除", "connect": "连接"}, "app": {"save": "保存", "saving": "保存中...", "new": "新建", "nodes": "节点", "workflows": "工作流", "empty": "（空）", "deleteWorkflow": "删除工作流", "dragHint": "拖拽图片或视频到画布"}, "admin": {"title": "管理后台", "welcome": "欢迎", "role": "角色", "email": "邮箱", "status": "状态", "owner": "主账号", "member": "子账号", "active": "正常", "disabled": "已禁用", "backToWork": "返回工作台"}, "nodes": {"image": {"header": "图片生成", "generate": "生成图片", "refImages": "参考图", "promptPlaceholder": "描述你想要生成的图片..."}, "video": {"header": "视频生成", "generate": "生成视频", "promptPlaceholder": "描述你想要生成的视频...", "duration": "时长", "audio": "音频"}, "startEnd": {"header": "首尾帧视频", "generate": "生成首尾帧视频", "startFrame": "首帧", "endFrame": "尾帧", "connectSource": "连接素材", "promptPlaceholder": "描述转场效果..."}, "imageSource": {"header": "图片素材", "replace": "替换文件", "output": "输出: 图片"}}};
export const en: any = {"common": {"model": "Model", "prompt": "Prompt", "aspectRatio": "Aspect Ratio", "resolution": "Resolution", "quality": "Quality", "generating": "Generating...", "delete": "Delete", "connect": "Connect"}, "app": {"save": "Save", "saving": "Saving...", "new": "New", "nodes": "Nodes", "workflows": "Workflows", "empty": "(empty)", "deleteWorkflow": "Delete workflow", "dragHint": "Drag files to canvas"}, "admin": {"title": "Admin Panel", "welcome": "Welcome", "role": "Role", "email": "Email", "status": "Status", "owner": "Owner", "member": "Member", "active": "Active", "disabled": "Disabled", "backToWork": "Back to Workspace"}, "nodes": {"image": {"header": "Image", "generate": "Generate Image", "refImages": "Reference Images", "promptPlaceholder": "Describe the image..."}, "video": {"header": "Video", "generate": "Generate Video", "promptPlaceholder": "Describe the video...", "duration": "Duration", "audio": "Audio"}, "startEnd": {"header": "Start-End Video", "generate": "Generate Start-End Video", "startFrame": "Start Frame", "endFrame": "End Frame", "connectSource": "Connect Source", "promptPlaceholder": "Describe the transition..."}, "imageSource": {"header": "Image Source", "replace": "Replace File", "output": "OUTPUT: IMAGE"}}};

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode, createElement } from 'react';

const dictionaries: Record<string, any> = { zh, en };
if (typeof window !== 'undefined') { (window as any).__I18N__ = { zh, en, dictionaries }; }

const I18nContext = createContext<any>({ locale: 'zh', setLocale: (l: string) => {}, t: (k: string): string => k });

export function useI18n() { return useContext(I18nContext); }

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<string>('zh');
  useEffect(() => { const s = localStorage.getItem('cubex-lang'); if (s === 'zh' || s === 'en') setLocale(s); }, []);
  const t = useCallback((key: string) => {
    const dict = dictionaries[locale];
    const keys = key.split('.');
    let v: any = dict;
    for (const k of keys) { if (v && typeof v === 'object' && k in v) v = v[k]; else return key; }
    return typeof v === 'string' ? v : key;
  }, [locale]);
  const Provider = I18nContext.Provider;
  return createElement(Provider, { value: { locale, setLocale, t } }, children);
}
