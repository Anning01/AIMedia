import {
  AvatarFallback,
  AvatarImage,
  Avatar as UIAvatar,
} from "@/components/ui/avatar";
import {
  CardContent,
  CardHeader,
  CardTitle,
  Card as UICard,
} from "@/components/ui/card";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Table as UITable,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import QR from "qrcode";
import React, { useEffect, useState } from "react";
import { Modal } from "./dialogs";
import { Empty, Spin } from "./feedback";
import { Button, Space } from "./layout";
import { Pagination } from "./navigation";
import { Base } from "./types";

export function Card({
  title,
  extra,
  children,
  bodyStyle,
  styles,
  size,
  bordered,
  ...p
}: Base) {
  return (
    <UICard {...p} className={cn("ui-card", p.className)}>
      {(title || extra) && (
        <CardHeader className="ui-card-header">
          <CardTitle>{title}</CardTitle>
          <div>{extra}</div>
        </CardHeader>
      )}
      <CardContent className="ui-card-body" style={styles?.body || bodyStyle}>
        {children}
      </CardContent>
    </UICard>
  );
}

export function Table<T extends Record<string, any>>({
  dataSource = [],
  columns = [],
  rowKey = "id",
  pagination,
  locale,
  loading,
  scroll,
  ...p
}: Base & {
  dataSource?: T[];
  columns?: {
    title?: React.ReactNode;
    key?: string;
    dataIndex?: string;
    render?: (value: any, record: T, index: number) => React.ReactNode;
    width?: number | string;
  }[];
}) {
  const [page, setPage] = useState(1);
  const size =
    pagination === false ? dataSource.length : pagination?.pageSize || 10;
  const safe = Math.min(
    page,
    Math.max(1, Math.ceil(dataSource.length / Math.max(size, 1))),
  );
  return (
    <div className="ui-table-section">
      <div className="ui-table-scroll" style={{ maxHeight: scroll?.y }}>
        <UITable className="ui-table">
          <TableHeader>
            <TableRow>
              {columns.map((c, i) => (
                <TableHead key={c.key || i} style={{ minWidth: c.width }}>
                  {c.title}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {dataSource
              .slice((safe - 1) * size, safe * size)
              .map((record, i) => (
                <TableRow
                  key={
                    typeof rowKey === "function"
                      ? rowKey(record)
                      : (record[rowKey] ?? i)
                  }
                >
                  {columns.map((c, j) => (
                    <TableCell key={c.key || j}>
                      {c.render
                        ? c.render(
                            c.dataIndex ? record[c.dataIndex] : undefined,
                            record,
                            i,
                          )
                        : c.dataIndex
                          ? record[c.dataIndex]
                          : null}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
          </TableBody>
        </UITable>
        {!dataSource.length && (
          <Empty description={locale?.emptyText || "暂无记录"} />
        )}
      </div>
      {loading && <Spin />}
      {pagination !== false && dataSource.length > size && (
        <Pagination
          total={dataSource.length}
          pageSize={size}
          current={safe}
          onChange={setPage}
        />
      )}
    </div>
  );
}

function ListBase<T>({
  dataSource = [],
  renderItem,
  header,
  footer,
  children,
  ...p
}: Base & {
  dataSource?: T[];
  renderItem?: (item: T, index: number) => React.ReactNode;
}) {
  return (
    <div className="ui-list">
      {header}
      {renderItem
        ? dataSource.map((v, i) => (
            <React.Fragment key={i}>{renderItem(v, i)}</React.Fragment>
          ))
        : children}
      {!dataSource.length && renderItem && <Empty />}
      {footer}
    </div>
  );
}

function ListItem({ children, actions, extra, ...p }: Base) {
  return (
    <div {...p} className="ui-list-item">
      <div className="ui-list-main">{children}</div>
      {extra}
      {actions && <Space>{actions}</Space>}
    </div>
  );
}

export const List = Object.assign(ListBase, {
  Item: Object.assign(ListItem, {
    Meta: ({ title, description, avatar }: Base) => (
      <div className="ui-list-meta">
        {avatar}
        <div>
          <strong>{title}</strong>
          <div className="ui-muted">{description}</div>
        </div>
      </div>
    ),
  }),
});

export function Avatar({ src, children, size = 36, ...p }: Base) {
  return (
    <UIAvatar
      className="ui-avatar"
      style={{ width: size, height: size, ...p.style }}
    >
      <AvatarImage src={src} alt="用户头像" />
      <AvatarFallback>{children || "用户"}</AvatarFallback>
    </UIAvatar>
  );
}
export function Progress({ percent = 0, strokeColor, ...p }: Base) {
  return (
    <div
      className="ui-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <div
        style={{
          width: `${Math.min(100, Math.max(0, percent))}%`,
          background: strokeColor,
        }}
      />
      <span>{Math.round(percent)}%</span>
    </div>
  );
}

export function Statistic({ title, value, suffix, prefix, valueStyle }: Base) {
  return (
    <div>
      <div className="ui-muted">{title}</div>
      <div className="ui-statistic" style={valueStyle}>
        {prefix}
        {value}
        {suffix}
      </div>
    </div>
  );
}

export function QRCode({ value, size = 160 }: Base) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let live = true;
    QR.toDataURL(value || "", { width: size, margin: 1 })
      .then((v) => {
        if (live) setUrl(v);
      })
      .catch(() => {
        if (live) setUrl("");
      });
    return () => {
      live = false;
    };
  }, [value, size]);
  return url ? (
    <img src={url} width={size} height={size} alt="支付二维码" />
  ) : null;
}

function ImageView({ src, alt = "", fallback, preview = true, ...p }: Base) {
  const [open, setOpen] = useState(false);
  const previewSrc =
    typeof preview === "object" && preview.src ? preview.src : src;
  const group = React.useContext(PreviewContext);
  const id = React.useId();
  useEffect(
    () =>
      group && preview
        ? group.register({ id, src: previewSrc, alt })
        : undefined,
    [group, id, previewSrc, alt, !!preview],
  );
  return (
    <>
      <img
        {...p}
        src={src}
        alt={alt}
        role={preview ? "button" : undefined}
        tabIndex={preview ? 0 : undefined}
        aria-label={preview ? `预览${alt || "图片"}` : undefined}
        onKeyDown={(e) => {
          if (preview && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            if (group) group.open(id);
            else setOpen(true);
          }
        }}
        className={cn("ui-image", p.className)}
        onClick={() => {
          if (preview) {
            if (group) group.open(id);
            else setOpen(true);
          }
        }}
        onError={(e) => {
          if (fallback && e.currentTarget.src !== fallback)
            e.currentTarget.src = fallback;
        }}
      />
      {preview && (
        <Modal
          open={open}
          onCancel={() => setOpen(false)}
          title={alt || "图片预览"}
          footer={null}
          width={900}
        >
          <img
            src={previewSrc}
            alt={alt}
            style={{
              maxWidth: "100%",
              maxHeight: "70vh",
              objectFit: "contain",
            }}
          />
        </Modal>
      )}
    </>
  );
}

type PreviewImage = { id: string; src: string; alt: string };
const PreviewContext = React.createContext<{
  register: (item: PreviewImage) => () => void;
  open: (id: string) => void;
} | null>(null);
function ImagePreviewGroup({ children }: Base) {
  const [images, setImages] = useState<PreviewImage[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const register = React.useCallback((item: PreviewImage) => {
    setImages((v) => [...v.filter((i) => i.id !== item.id), item]);
    return () => setImages((v) => v.filter((i) => i.id !== item.id));
  }, []);
  const context = React.useMemo(
    () => ({ register, open: setActive }),
    [register],
  );
  const index = images.findIndex((i) => i.id === active);
  const item = images[index];
  const change = (delta: number) => {
    const next = images[index + delta];
    if (next) setActive(next.id);
  };
  return (
    <PreviewContext.Provider value={context}>
      {children}
      <Modal
        open={!!item}
        title={item?.alt || "图片预览"}
        footer={null}
        width={900}
        onCancel={() => setActive(null)}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === "ArrowLeft") change(-1);
          if (e.key === "ArrowRight") change(1);
        }}
      >
        <img
          src={item?.src}
          alt={item?.alt || ""}
          style={{ maxWidth: "100%", maxHeight: "65vh", objectFit: "contain" }}
        />
        <div className="ui-pagination">
          <Button disabled={index <= 0} onClick={() => change(-1)}>
            上一张
          </Button>
          <span>
            {index + 1} / {images.length}
          </span>
          <Button
            disabled={index >= images.length - 1}
            onClick={() => change(1)}
          >
            下一张
          </Button>
        </div>
      </Modal>
    </PreviewContext.Provider>
  );
}
export const Image = Object.assign(ImageView, {
  PreviewGroup: ImagePreviewGroup,
});
export function Result({ title, subTitle, extra, status }: Base) {
  return (
    <Empty
      description={
        <>
          <strong>{title}</strong>
          <p>{subTitle}</p>
        </>
      }
    >
      {extra}
    </Empty>
  );
}

export function Steps({ current = 0, items = [] }: Base) {
  return (
    <ol className="ui-steps">
      {items.map((i: any, n: number) => (
        <li key={n} aria-current={current === n ? "step" : undefined}>
          <span>{n < current ? "✓" : n + 1}</span>
          {i.title}
        </li>
      ))}
    </ol>
  );
}

export function Timeline({ items = [] }: Base) {
  return (
    <ol className="ui-timeline">
      {items.map((i: any, n: number) => (
        <li key={n}>{i.children}</li>
      ))}
    </ol>
  );
}

export const Descriptions = Object.assign(
  ({ children }: Base) => <dl className="ui-descriptions">{children}</dl>,
  {
    Item: ({ label, children }: Base) => (
      <div>
        <dt>{label}</dt>
        <dd>{children}</dd>
      </div>
    ),
  },
);
