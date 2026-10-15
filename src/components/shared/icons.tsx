import * as Icons from "@radix-ui/react-icons";
import React from "react";
function icon(Component: React.ComponentType<any>) {
  return function Icon({
    spin,
    ...props
  }: React.SVGProps<SVGSVGElement> & { spin?: boolean }) {
    return (
      <Component
        {...props}
        className={[props.className, spin ? "animate-spin" : ""]
          .filter(Boolean)
          .join(" ")}
      />
    );
  };
}
export const BarsOutlined = icon(Icons.HamburgerMenuIcon);
export const CheckCircleFilled = icon(Icons.CheckCircledIcon);
export const CheckOutlined = icon(Icons.CheckIcon);
export const ChevronLeftOutlined = icon(Icons.ChevronLeftIcon);
export const ChevronRightOutlined = icon(Icons.ChevronRightIcon);
export const ClockCircleOutlined = icon(Icons.ClockIcon);
export const CloudDownloadOutlined = icon(Icons.DownloadIcon);
export const CloudUploadOutlined = icon(Icons.UploadIcon);
export const CopyOutlined = icon(Icons.CopyIcon);
export const CrownOutlined = icon(Icons.BadgeIcon);
export const DatabaseOutlined = icon(Icons.ArchiveIcon);
export const DeleteOutlined = icon(Icons.TrashIcon);
export const DownloadOutlined = icon(Icons.DownloadIcon);
export const EditOutlined = icon(Icons.Pencil1Icon);
export const EyeOutlined = icon(Icons.EyeOpenIcon);
export const FileSearchOutlined = icon(Icons.MagnifyingGlassIcon);
export const FileTextOutlined = icon(Icons.FileTextIcon);
export const FireOutlined = icon(Icons.ActivityLogIcon);
export const FolderOpenOutlined = icon(Icons.OpenInNewWindowIcon);
export const HeartOutlined = icon(Icons.HeartIcon);
export const HistoryOutlined = icon(Icons.CounterClockwiseClockIcon);
export const LayoutOutlined = icon(Icons.DashboardIcon);
export const LoadingOutlined = icon(Icons.ReloadIcon);
export const LockOutlined = icon(Icons.LockClosedIcon);
export const LogoutOutlined = icon(Icons.ExitIcon);
export const MessageOutlined = icon(Icons.ChatBubbleIcon);
export const PauseCircleOutlined = icon(Icons.PauseIcon);
export const PictureOutlined = icon(Icons.ImageIcon);
export const PlayCircleOutlined = icon(Icons.PlayIcon);
export const PlusOutlined = icon(Icons.PlusIcon);
export const QuestionCircleOutlined = icon(Icons.QuestionMarkCircledIcon);
export const ReloadOutlined = icon(Icons.ReloadIcon);
export const SaveOutlined = icon(Icons.DownloadIcon);
export const ScheduleOutlined = icon(Icons.CalendarIcon);
export const SendOutlined = icon(Icons.PaperPlaneIcon);
export const SettingOutlined = icon(Icons.GearIcon);
export const ShareAltOutlined = icon(Icons.Share1Icon);
export const ShoppingCartOutlined = icon(Icons.BackpackIcon);
export const StarFilled = icon(Icons.StarFilledIcon);
export const StarOutlined = icon(Icons.StarIcon);
export const SyncOutlined = icon(Icons.UpdateIcon);
export const TagsOutlined = icon(Icons.BookmarkIcon);
export const TeamOutlined = icon(Icons.PersonIcon);
export const ThunderboltOutlined = icon(Icons.LightningBoltIcon);
export const UploadOutlined = icon(Icons.UploadIcon);
export const UserOutlined = icon(Icons.PersonIcon);
