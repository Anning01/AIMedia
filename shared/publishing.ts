export const WECHAT_PLATFORM = "微信公众号";
export const WECHAT_ENTRY_URL = "https://mp.weixin.qq.com/";
export const isWechatPlatform = (value: string) => /^(微信公众号|微信公众平台|wechat\s*(official\s*)?account)$/i.test(value.trim());
export const isWechatEntryUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "mp.weixin.qq.com";
  } catch {
    return false;
  }
};
