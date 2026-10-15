export const WECHAT_DECLARATIONS = [
  { label: '无需声明', type: 0, noClaim: true },
  { label: '内容由AI生成', type: 1 },
  { label: '素材来源官方媒体/网络新闻', type: 2 },
  { label: '内容剧情演绎，仅供娱乐', type: 3 },
  { label: '个人观点，仅供参考', type: 4 },
  { label: '健康医疗分享，仅供参考', type: 5 },
  { label: '投资观点，仅供参考', type: 6 },
];

export function wechatClaimConfig(declaration?: string) {
  const item =
    WECHAT_DECLARATIONS.find((d) => d.label === declaration) || WECHAT_DECLARATIONS[4];
  return {
    claimSourceType: item.type,
    isUserNoClaim: item.noClaim ? 1 : 0,
  };
}
