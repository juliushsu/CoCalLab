const modules = import.meta.glob('./*/*.ts', { eager: true });

const messages: Record<string, { translation: Record<string, unknown> }> = {};

Object.keys(modules).forEach((path) => {
  const match = path.match(/\.\/([^/]+)\/([^/]+)\.ts$/);
  if (match) {
    const [, lang] = match;
    const module = modules[path] as { cocal?: Record<string, unknown>; cacal?: Record<string, unknown>; default?: Record<string, unknown> };
    
    if (!messages[lang]) {
      messages[lang] = { translation: {} };
    }
    
    // 優先使用具名匯出 cocal（新品牌），保留 cacal 向下相容，若無則使用 default
    const content = module.cocal || module.cacal || module.default;
    if (content) {
      messages[lang].translation = {
        ...messages[lang].translation,
        ...content
      };
    }
  }
});

export default messages;