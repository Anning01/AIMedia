import { countThisMonth, countToday } from "@/data/localStore";
import {
  ArchiveIcon,
  CalendarIcon,
  CheckCircledIcon,
  ExclamationTriangleIcon,
} from "@radix-ui/react-icons";
import { usePublishWorkspace } from "../workspace-context";
export function PublishStats() {
  const { pendingArticles, queue } = usePublishWorkspace();
  const stats = [
    {
      label: "待发布",
      value: pendingArticles.length,
      unit: "篇",
      Icon: ArchiveIcon,
      tone: "primary",
    },
    {
      label: "今日已发布",
      value: countToday("发布"),
      unit: "次",
      Icon: CheckCircledIcon,
      tone: "success",
    },
    {
      label: "发布失败",
      value: queue.filter((item) => item.status === "失败").length,
      unit: "次",
      Icon: ExclamationTriangleIcon,
      tone: "error",
    },
    {
      label: "本月已发布",
      value: countThisMonth("发布"),
      unit: "次",
      Icon: CalendarIcon,
      tone: "neutral",
    },
  ];
  return (
    <div className="publish-stats">
      {stats.map(({ label, value, unit, Icon, tone }) => (
        <div className="publish-stat" key={label} data-tone={tone}>
          <div>
            <span>{label}</span>
            <strong>
              {value}
              <small>{unit}</small>
            </strong>
          </div>
          <Icon aria-hidden="true" />
        </div>
      ))}
    </div>
  );
}
