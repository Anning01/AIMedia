export interface AiConfigDraft {
  baseUrl: string;
  model: string;
  apiKey: string;
  hasApiKey: boolean;
}

export function draftFromConfig(config: AiConfigInfo): AiConfigDraft {
  return {
    baseUrl: config.baseUrl || "",
    model: config.model || "",
    apiKey: "",
    hasApiKey: !!config.hasApiKey,
  };
}

export function validateDraft(draft: AiConfigDraft) {
  if (!draft.baseUrl.trim()) return "请填写接口地址";
  try {
    const url = new URL(draft.baseUrl);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return "接口地址须为无账号、查询参数和片段的 HTTP(S) 地址";
  } catch {
    return "请填写完整的 HTTP(S) 接口地址";
  }
  if (!draft.model.trim()) return "请填写模型名称";
  if (!draft.apiKey.trim() && !draft.hasApiKey) return "请填写 API Key";
  return "";
}
