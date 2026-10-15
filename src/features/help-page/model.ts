import type { PageKey } from "@/layout/AppShell";

interface HelpQuestion {
  id: string;
  question: string;
  answer: string;
  target?: PageKey;
  action?: string;
}

export const HELP_QUESTIONS: HelpQuestion[] = [
  {
    id: "start",
    question: "第一次使用，从哪里开始？",
    answer:
      "先配置 AI，再到创作工坊输入主题生成内容。需要发布时，在账号中心添加平台账号。",
    target: "ai",
    action: "去配置 AI",
  },
  {
    id: "ai",
    question: "AI 怎么配置？",
    answer:
      "自定义接口填写 Base URL 或完整接口地址、模型名称和 API Key。使用器灵时，可一键授权或粘贴器灵 Key，验证后选择文本模型。",
  },
  {
    id: "create",
    question: "怎么生成和修改文章？",
    answer:
      "创作工坊第一页输入素材并生成，第二页选择模板、编辑正文和预览。没有选题时，可以先去资源管理找素材。",
    target: "article",
    action: "去创作工坊",
  },
  {
    id: "history",
    question: "以前的作品在哪里找？",
    answer:
      "在创作工坊点击「历史作品」，可以搜索、翻页查看文章和贴图，点击作品即可载入编辑器。",
  },
  {
    id: "publish",
    question: "怎么发布内容？",
    answer:
      "先在账号中心扫码添加账号，再到内容发布选择作品、平台和账号。发布结果可以在发布历史中查看。",
    target: "publish",
    action: "去内容发布",
  },
  {
    id: "remove-ai",
    question: "「去 AI」怎么用，会收费吗？",
    answer:
      "在编辑器点击「去 AI / 降低 AI 痕迹」，确认当前费用后处理，预览满意再采用。费用按器灵当前规则结算，长文会先提示分段次数。",
  },
  {
    id: "hosting",
    question: "自动托管怎么用？",
    answer:
      "新建任务，设置素材来源、目标账号和运行时间后启动。执行情况看任务日志，不需要继续运行时可以暂停。",
    target: "task",
    action: "去自动托管",
  },
  {
    id: "failed",
    question: "生成或发布失败了怎么办？",
    answer:
      "生成失败时检查 AI 配置和网络；发布失败时检查账号登录状态及失败提示。器灵提示「待核对」时，先查看使用记录，避免重复提交。",
  },
];
