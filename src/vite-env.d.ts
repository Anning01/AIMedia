/// <reference types="vite/client" />

interface AiConfigInfo {
  ok: boolean;
  error?: string;
  provider?: string;
  baseUrl?: string;
  apiPath?: string;
  model?: string;
  timeout?: number;
  vision?: boolean;
  translationProvider?: string;
  hasApiKey?: boolean;
  hasYoudaoKey?: boolean;
  hasYoudaoSecret?: boolean;
  imageProvider?: string;
  imageBaseUrl?: string;
  imageModel?: string;
  hasImageKey?: boolean;
  hasMinimaxKey?: boolean;
  hasArkKey?: boolean;
  quickConfig?: { status: "available" };
  service?: "custom" | "qiling";
  qilingConfigured?: boolean;
  qilingModel?: string;
  qilingMaxTokens?: number;
  qilingMaxFee?: string;
  qilingBudgetConfigured?: boolean;
  qilingThinkingMode?: QilingThinkingMode | "";
}

type QilingThinkingMode = "enabled" | "disabled";
interface QilingModel {
  code: string;
  name: string;
  maxTokens?: number;
  thinkingModes?: QilingThinkingMode[];
  pricing?: { input?: string; output?: string; cache?: string };
}
interface QilingAuthState {
  ok?: boolean;
  status: string;
  interval?: number;
  expiresAt?: number;
  error?: string;
  models?: QilingModel[];
}
interface QilingPrice {
  price: string | null;
  freeQuota: number | null;
  balance: string | null;
  enabled: boolean;
}
interface QilingRemoveJob {
  id: string;
  source: string;
  state: string;
  error?: string;
  candidate?: string;
  parts: Array<{
    source: string;
    taskId?: string;
    status: string;
    text?: string;
    charged?: string;
    balance?: string;
  }>;
}
interface QilingReply {
  ok: boolean;
  error?: string;
  code?: string;
  models?: QilingModel[];
  config?: AiConfigInfo;
  job?: QilingRemoveJob | null;
}

interface ImageHostConfig {
  provider?: string;
  endpoint?: string;
  bucket?: string;
  region?: string;
  accessKey?: string;
  secretKey?: string;
  customUploadUrl?: string;
  customToken?: string;
}

interface AiResult {
  code?: string;
  retryable?: boolean;
  models?: QilingModel[];
  ok: boolean;
  error?: string;
  mode?: string;
  japanese?: string;
  chinese?: string;
  reply?: string;
  blocks?: Array<{
    type: string;
    text?: string;
    items?: string[];
    src?: string;
  }>;
}

interface UpdateStatusPayload {
  status?:
    | "checking"
    | "available"
    | "not-available"
    | "downloaded"
    | "error"
    | "manual";
  version?: string;
  error?: string;
}

interface UpdateProgressPayload {
  percent?: number;
  transferred?: number;
  total?: number;
  bytesPerSecond?: number;
}

interface UpdateLogPayload {
  time?: string;
  msg?: string;
}

interface XhsAuthor {
  userId: string;
  nickname: string;
  avatar: string;
}

interface XhsInteract {
  likedCount: string | number;
  collectedCount: string | number;
  commentCount: string | number;
  shareCount: string | number;
}

interface XhsNote {
  noteId: string;
  type: string;
  title: string;
  desc: string;
  tags: string[];
  images: string[];
  author: XhsAuthor;
  interact: XhsInteract;
  link: string;
}

interface PlatformLoginSession {
  id: string;
  platform: string;
  mode: "qr" | "web";
  qrDataUrl?: string;
  loginUrl?: string;
  expiresAt?: number;
  status?: string;
  message?: string;
  accountName?: string;
}

interface Window {
  wangaohui?: {
    qilingConnect: (payload: { apiKey: string }) => Promise<QilingReply>;
    qilingModels: () => Promise<QilingReply>;
    qilingSelectModel: (payload: {
      model: string;
      maxTokens: number;
      maxFee: string;
      thinkingMode?: QilingThinkingMode;
    }) => Promise<QilingReply>;
    qilingAuthStart: (source?: { site_code?: string }) => Promise<QilingAuthState & { ok: boolean }>;
    qilingAuthPoll: () => Promise<QilingAuthState & { ok: boolean }>;
    qilingAuthCancel: () => Promise<{ ok: boolean }>;
    qilingOpenAccount: (payload: {
      page: "usage" | "recharge" | "keys";
    }) => Promise<QilingReply>;
    qilingRemovePrice: () => Promise<QilingPrice & QilingReply>;
    qilingRemoveGet: (payload: { id?: string }) => Promise<QilingReply>;
    qilingRemoveStart: (payload: {
      text: string;
      allowSplit: boolean;
    }) => Promise<QilingReply>;
    qilingRemovePoll: (payload: { id: string }) => Promise<QilingReply>;
    qilingRemovePause: (payload: { id?: string }) => Promise<QilingReply>;
    qilingRemoveResume: (payload: { id: string }) => Promise<QilingReply>;
    qilingRemoveAdopt: (payload: { id: string }) => Promise<QilingReply>;
    cancelGeneration: (payload: {
      requestId: string;
    }) => Promise<{ ok: boolean; error?: string }>;
    onGenerationProgress: (
      cb: (event: {
        requestId: string;
        stage: string;
        message: string;
      }) => void,
    ) => () => void;
    generateArticle: (payload: Record<string, unknown>) => Promise<AiResult>;
    winMinimize: () => Promise<void>;
    winMaximize: () => Promise<void>;
    winClose: () => Promise<void>;
    appVersion: () => Promise<string>;
    updateCheck: () => Promise<{
      ok: boolean;
      hasUpdate?: boolean;
      currentVersion?: string;
      latestVersion?: string;
      message?: string;
      error?: string;
    }>;
    updateInstall: () => Promise<{ ok: boolean; error?: string }>;
    onUpdateStatus: (cb: (payload: UpdateStatusPayload) => void) => () => void;
    onUpdateProgress: (
      cb: (payload: UpdateProgressPayload) => void,
    ) => () => void;
    onUpdateLog: (cb: (payload: UpdateLogPayload) => void) => () => void;
    copyHtml: (html: string) => Promise<{ ok: boolean; error?: string }>;
    testAiConfig: (payload: Record<string, unknown>) => Promise<AiResult>;
    saveAiConfig: (
      payload: Record<string, unknown>,
    ) => Promise<{ ok: boolean; error?: string }>;
    readAiConfig: () => Promise<AiConfigInfo>;
    selectImage: () => Promise<{
      ok: boolean;
      canceled?: boolean;
      error?: string;
      name?: string;
      dataUrl?: string;
    }>;
    selectTextFile: () => Promise<{
      ok: boolean;
      canceled?: boolean;
      error?: string;
      name?: string;
      path?: string;
      content?: string;
    }>;
    selectImages: (payload?: { max?: number }) => Promise<{
      ok: boolean;
      canceled?: boolean;
      error?: string;
      images?: Array<{ name: string; dataUrl: string }>;
    }>;
    saveImage: (payload: {
      dataUrl: string;
      kind: "library" | "generated" | "history";
    }) => Promise<{ ok: boolean; url?: string; path?: string; error?: string }>;
    readImage: (payload: {
      src: string;
    }) => Promise<{ ok: boolean; dataUrl?: string; error?: string }>;
    openImageDir: () => Promise<{ ok: boolean; error?: string }>;
    readImageHostConfig: () => Promise<{
      ok: boolean;
      config?: ImageHostConfig;
    }>;
    saveImageHostConfig: (
      payload: ImageHostConfig,
    ) => Promise<{ ok: boolean; error?: string }>;
    saveFile: (payload: {
      defaultName?: string;
      dataUrl?: string;
      text?: string;
    }) => Promise<{
      ok: boolean;
      canceled?: boolean;
      error?: string;
      path?: string;
    }>;
    selectDirectory: () => Promise<{
      ok: boolean;
      canceled?: boolean;
      path?: string;
    }>;
    setAutostart: (payload: {
      enabled: boolean;
    }) => Promise<{ ok: boolean; enabled?: boolean; error?: string }>;
    generateImage: (
      payload: Record<string, unknown>,
    ) => Promise<{ ok: boolean; images?: string[]; error?: string }>;
    cutoutImage: (payload: {
      dataUrl: string;
      ak?: string;
      sk?: string;
    }) => Promise<{ ok: boolean; dataUrl?: string; error?: string }>;
    publishArticle: (
      payload: Record<string, unknown>,
    ) => Promise<{ ok: boolean; error?: string; response?: unknown }>;
    llmChat: (payload: {
      requestId?: string;
      system: string;
      user: string;
      provider?: string;
      temperature?: number;
    }) => Promise<AiResult>;
    readNote: (payload: {
      url: string;
      cookie?: string;
    }) => Promise<{ ok: boolean; note?: XhsNote; error?: string }>;
    downloadNoteImages: (payload: {
      urls: string[];
      cookie?: string;
      referer?: string;
    }) => Promise<{
      ok: boolean;
      images?: Array<{
        url: string;
        ok: boolean;
        dataUrl?: string;
        error?: string;
      }>;
      error?: string;
    }>;
    downloadImage: (payload: {
      url: string;
      cookie?: string;
      referer?: string;
    }) => Promise<{
      ok: boolean;
      dataUrl?: string;
      error?: string;
    }>;
    analyzeNoteImages: (payload: { images: string[] }) => Promise<{
      ok: boolean;
      compositions?: string[];
      overallStyle?: string;
      items?: Array<{
        index?: number;
        layout?: string;
        subject?: string;
        lighting?: string;
        color?: string;
        scene?: string;
        style?: string;
        text?: string;
        suggestSlot?: string;
        borrow?: string;
        mustReplace?: string;
      }>;
      error?: string;
    }>;
    platformLoginCreate: (payload: { platform: string }) => Promise<{
      ok: boolean;
      session?: PlatformLoginSession;
      error?: string;
    }>;
    platformLoginPoll: (payload: { id: string }) => Promise<{
      ok: boolean;
      status?: string;
      message?: string;
      cookie?: string;
      accountName?: string;
      token?: string;
      fingerprint?: string;
      userId?: string;
      avatar?: string;
      wechatAccounts?: Array<{
        username: string;
        nickname: string;
        bizuin?: string;
        headImg?: string;
        appid?: string;
        kind?: "mp" | "wxa";
        enabled?: boolean;
        token?: string;
        cookies?: string;
      }>;
      url?: string;
      error?: string;
    }>;
    platformLoginCancel: (payload: { id: string }) => Promise<{
      ok: boolean;
      error?: string;
    }>;
    wechatSyncAccounts: (payload: {
      token?: string;
      cookie?: string;
    }) => Promise<{
      ok: boolean;
      accounts?: Array<{
        username: string;
        nickname: string;
        bizuin?: string;
        headImg?: string;
        acctType?: number;
        appid?: string;
        kind?: "mp" | "wxa";
        enabled?: boolean;
        token?: string;
        cookies?: string;
      }>;
      token?: string;
      cookies?: string;
      error?: string;
    }>;
    openAccountBackend: (payload: {
      platform: "wechat" | "toutiao" | "baijiahao" | "xiaohongshu";
      cookie?: string;
      token?: string;
      username?: string;
    }) => Promise<{ ok: boolean; error?: string }>;
    platformPublish: (payload: {
      platform: "wechat" | "toutiao" | "baijiahao" | "xiaohongshu";
      cookie?: string;
      token?: string;
      fingerprint?: string;
      title: string;
      content: string;
      postType?: "article" | "sticker";
      images?: string[];
      sections0?: string;
      composeInfo?: string;
      coverImageUrl?: string;
      digest?: string;
      saveDraftOnly?: boolean;
      wechatUsername?: string;
      wechatAccounts?: Array<{ username?: string; appid?: string; acctType?: number; kind?: string }>;
      currentUsername?: string;
      claimExclusive?: boolean;
      contentDeclaration?: string;
      bjhTtv?: boolean;
      bjhAiTts?: boolean;
      bjhAigc?: boolean;
      bjhAutoGoods?: boolean;
      xhsOriginal?: "none" | "original" | "repost";
      xhsContentDeclaration?: string;
      claimSourceType?: number;
      isUserNoClaim?: number;
      copyrightType?: number;
    }) => Promise<{
      ok: boolean;
      articleId?: string;
      method?: string;
      msgid?: string;
      cookies?: string;
      token?: string;
      lastRefresh?: string;
      currentUsername?: string;
      error?: string;
    }>;
    wechatRefreshSession: (payload: {
      token?: string;
      cookie?: string;
      fingerprint?: string;
      username?: string;
      appid?: string;
      accounts?: Array<{
        username?: string;
        appid?: string;
        acctType?: number;
        kind?: string;
      }>;
      currentUsername?: string;
    }) => Promise<{
      ok: boolean;
      token?: string;
      cookies?: string;
      lastRefresh?: string;
      currentUsername?: string;
      appid?: string;
      error?: string;
    }>;
    platformVerify: (payload: {
      platform: "wechat" | "toutiao" | "baijiahao";
      cookie?: string;
      token?: string;
    }) => Promise<{
      ok: boolean;
      valid?: boolean;
      error?: string;
    }>;
  };
}
