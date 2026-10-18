import * as A from "@/components/ui/alert-dialog";
import * as D from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import React,{ useEffect,useRef,useState } from "react";
import { message } from "./feedback";
import { Button } from "./layout";
import { Base } from "./types";

type ModalProps = Base & {
  open?: boolean;
  onCancel?: () => void;
  onOk?: () => void | Promise<void>;
};

function ModalView({
  open,
  title,
  children,
  onCancel,
  onOk,
  footer,
  okText = "确定",
  cancelText = "取消",
  confirmLoading,
  width = 520,
  styles,
  destroyOnClose,
  maskClosable = true,
  ...p
}: ModalProps) {
  const opener = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  if (open && !wasOpen.current)
    opener.current = document.activeElement as HTMLElement;
  wasOpen.current = !!open;
  return (
    <D.Dialog
      open={!!open}
      onOpenChange={(v) => {
        if (!v) onCancel?.();
      }}
    >
      <D.DialogContent
        onKeyDown={p.onKeyDown}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          if (opener.current?.isConnected) opener.current.focus();
        }}
        className={cn("ui-dialog", p.className)}
        style={{ width, maxWidth: "calc(100vw - 40px)", ...p.style }}
        onPointerDownOutside={(e) => {
          if (!maskClosable) e.preventDefault();
        }}
        aria-describedby={undefined}
      >
        <D.DialogHeader>
          <D.DialogTitle>{title || "详情"}</D.DialogTitle>
        </D.DialogHeader>
        <div className="ui-dialog-body" style={styles?.body}>
          {children}
        </div>
        {footer !== null && (
          <D.DialogFooter>
            {footer === undefined ? (
              <>
                <Button onClick={onCancel}>{cancelText}</Button>
                <Button type="primary" loading={confirmLoading} onClick={onOk}>
                  {okText}
                </Button>
              </>
            ) : (
              footer
            )}
          </D.DialogFooter>
        )}
      </D.DialogContent>
    </D.Dialog>
  );
}

let confirmDispatch: ((p: Base) => void) | undefined;

export function ConfirmationHost() {
  const [request, setRequest] = useState<Base | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    confirmDispatch = setRequest;
    return () => {
      confirmDispatch = undefined;
    };
  }, []);
  return (
    <A.AlertDialog
      open={!!request}
      onOpenChange={(v) => {
        if (!v && !busy) setRequest(null);
      }}
    >
      <A.AlertDialogContent className="ui-dialog">
        <A.AlertDialogHeader>
          <A.AlertDialogTitle>{request?.title}</A.AlertDialogTitle>
          <A.AlertDialogDescription asChild>
            <div>{request?.content}</div>
          </A.AlertDialogDescription>
        </A.AlertDialogHeader>
        <A.AlertDialogFooter>
          <A.AlertDialogCancel
            disabled={busy}
            onClick={() => request?.onCancel?.()}
          >
            {request?.cancelText || "取消"}
          </A.AlertDialogCancel>
          <Button
            type="primary"
            danger={request?.okType === "danger"}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await request?.onOk?.();
                setRequest(null);
              } catch (e) {
                message.error(e instanceof Error ? e.message : "操作失败");
              } finally {
                setBusy(false);
              }
            }}
          >
            {request?.okText || "确定"}
          </Button>
        </A.AlertDialogFooter>
      </A.AlertDialogContent>
    </A.AlertDialog>
  );
}

export const Modal = Object.assign(ModalView, {
  confirm: (p: Base) => confirmDispatch?.(p),
});

export function Drawer(p: ModalProps) {
  return (
    <ModalView
      {...p}
      onCancel={p.onClose || p.onCancel}
      styles={{ body: p.bodyStyle }}
      className={cn("ui-drawer", p.className)}
      footer={p.footer ?? null}
    />
  );
}

export function Popconfirm({
  children,
  title,
  description,
  onConfirm,
  okText,
  cancelText,
  ...p
}: Base & {
  onConfirm?: (e?: React.MouseEvent) => void | Promise<void>;
  onCancel?: (e?: React.MouseEvent) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <A.AlertDialog open={open} onOpenChange={setOpen}>
      <A.AlertDialogTrigger asChild>{children}</A.AlertDialogTrigger>
      <A.AlertDialogContent>
        <A.AlertDialogHeader>
          <A.AlertDialogTitle>{title}</A.AlertDialogTitle>
          <A.AlertDialogDescription>
            {description || "此操作需要确认"}
          </A.AlertDialogDescription>
        </A.AlertDialogHeader>
        <A.AlertDialogFooter>
          <A.AlertDialogCancel onClick={(e) => p.onCancel?.(e)}>
            {cancelText || "取消"}
          </A.AlertDialogCancel>
          <Button
            type="primary"
            onClick={async (e) => {
              try {
                await onConfirm?.(e);
                setOpen(false);
              } catch (e) {
                message.error("操作失败");
              }
            }}
          >
            {okText || "确定"}
          </Button>
        </A.AlertDialogFooter>
      </A.AlertDialogContent>
    </A.AlertDialog>
  );
}
