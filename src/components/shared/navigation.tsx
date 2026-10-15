import * as M from "@/components/ui/dropdown-menu";
import { Input as UIInput } from "@/components/ui/input";
import * as P from "@/components/ui/popover";
import * as S from "@/components/ui/select";
import * as TabsUI from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
CheckCircledIcon,
ChevronLeftIcon,
ChevronRightIcon,
Cross2Icon,
} from "@radix-ui/react-icons";
import React,{ useState } from "react";
import { Button } from "./layout";
import { Base } from "./types";

type MenuItem = {
  key: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
  type?: string;
};

export function Dropdown({
  menu,
  children,
}: Base & {
  menu?: { items?: MenuItem[]; onClick?: (v: { key: string }) => void };
}) {
  return (
    <M.DropdownMenu>
      <M.DropdownMenuTrigger asChild>{children}</M.DropdownMenuTrigger>
      <M.DropdownMenuContent>
        {menu?.items?.map((item, i) =>
          item.type === "divider" ? (
            <M.DropdownMenuSeparator key={i} />
          ) : (
            <M.DropdownMenuItem
              key={item.key}
              disabled={item.disabled}
              onSelect={() => menu.onClick?.({ key: item.key })}
            >
              {item.icon}
              {item.label}
            </M.DropdownMenuItem>
          ),
        )}
      </M.DropdownMenuContent>
    </M.DropdownMenu>
  );
}

export type Option = {
  value: string | number;
  label: React.ReactNode;
  disabled?: boolean;
};

type ChoiceProps = Base & {
  options?: Option[];
  onChange?: (value: any) => void;
};

export function Select(props: ChoiceProps) {
  const {
    options = [],
    value,
    defaultValue,
    mode,
    onChange,
    placeholder = "请选择",
    allowClear,
    showSearch,
    filterOption,
    optionFilterProp,
    size,
    ...p
  } = props;
  const [local, setLocal] = useState(defaultValue);
  const [search, setSearch] = useState("");
  const selected = Object.prototype.hasOwnProperty.call(props, "value")
    ? value
    : local;
  const change = (v: any) => {
    setLocal(v);
    onChange?.(v);
  };
  const multiple = mode === "multiple" || mode === "tags";
  if (multiple || showSearch)
    return (
      <P.Popover>
        <P.PopoverTrigger asChild>
          <Button
            disabled={p.disabled}
            id={p.id}
            aria-invalid={p["aria-invalid"]}
            aria-describedby={p["aria-describedby"]}
            className={cn("ui-select-trigger", p.className)}
            style={p.style}
            aria-label={p["aria-label"] || placeholder}
          >
            {multiple
              ? selected?.length
                ? options
                    .filter((o) => selected.includes(o.value))
                    .map((o) => o.label)
                    .join("、")
                : placeholder
              : options.find((o) => o.value === selected)?.label || placeholder}
          </Button>
        </P.PopoverTrigger>
        <P.PopoverContent className="ui-choice-popover">
          {showSearch && (
            <UIInput
              placeholder="搜索选项"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}
          <div className="ui-choice-list">
            {allowClear && (
              <Button
                type="text"
                onClick={() => change(multiple ? [] : undefined)}
              >
                清空选择
              </Button>
            )}
            {options
              .filter(
                (o) =>
                  !search ||
                  String(o.label).toLowerCase().includes(search.toLowerCase()),
              )
              .map((o) => (
                <button
                  type="button"
                  key={o.value}
                  disabled={o.disabled}
                  className="ui-choice-option"
                  aria-pressed={
                    multiple
                      ? selected?.includes(o.value)
                      : selected === o.value
                  }
                  onClick={() =>
                    change(
                      multiple
                        ? selected?.includes(o.value)
                          ? selected.filter((v: any) => v !== o.value)
                          : [...(selected || []), o.value]
                        : o.value,
                    )
                  }
                >
                  {o.label}
                  {(multiple
                    ? selected?.includes(o.value)
                    : selected === o.value) && <CheckCircledIcon />}
                </button>
              ))}
            {mode === "tags" &&
              search &&
              !options.some((o) => o.value === search) && (
                <Button
                  onClick={() => {
                    change([...(selected || []), search]);
                    setSearch("");
                  }}
                >
                  添加“{search}”
                </Button>
              )}
          </div>
        </P.PopoverContent>
      </P.Popover>
    );
  return (
    <div className="ui-select-wrap" style={p.style}>
      <S.Select
        value={selected == null || selected === "" ? "" : String(selected)}
        disabled={p.disabled}
        onValueChange={(v) =>
          change(options.find((o) => String(o.value) === v)?.value ?? v)
        }
      >
        <S.SelectTrigger className={p.className} aria-label={p["aria-label"] || placeholder}>
          <S.SelectValue placeholder={placeholder} />
        </S.SelectTrigger>
        <S.SelectContent>
          {options
            .filter((o) => o.value !== "")
            .map((o) => (
              <S.SelectItem
                key={o.value}
                value={String(o.value)}
                disabled={o.disabled}
              >
                {o.label}
              </S.SelectItem>
            ))}
        </S.SelectContent>
      </S.Select>
      {allowClear && selected != null && selected !== "" && (
        <Button
          type="text"
          icon={<Cross2Icon />}
          aria-label="清空选择"
          onClick={() => change(undefined)}
        />
      )}
    </div>
  );
}

export function Segmented({
  options = [],
  value,
  onChange,
  ...p
}: ChoiceProps) {
  return (
    <TabsUI.Tabs
      value={String(value)}
      onValueChange={(v) =>
        onChange?.(
          options.find(
            (o: any) => String(typeof o === "object" ? o.value : o) === v,
          )?.value ?? v,
        )
      }
      className={p.className}
    >
      <TabsUI.TabsList>
        {options.map((o: any) => (
          <TabsUI.TabsTrigger key={o.value ?? o} value={String(o.value ?? o)}>
            {o.label ?? o}
          </TabsUI.TabsTrigger>
        ))}
      </TabsUI.TabsList>
    </TabsUI.Tabs>
  );
}

export const Radio = Object.assign(
  ({ children, value, ...p }: Base) => (
    <label className="ui-check">
      <input type="radio" value={value} {...p} />
      {children}
    </label>
  ),
  {
    Group: ({ options, children, value, onChange, ...p }: ChoiceProps) => (
      <Segmented
        {...p}
        options={
          options ||
          React.Children.toArray(children)
            .filter(React.isValidElement)
            .map((child: any) => ({
              value: child.props.value,
              label: child.props.children,
            }))
        }
        value={value}
        onChange={(v) => onChange?.({ target: { value: v } })}
      />
    ),
  },
);

export function Tabs({
  items = [],
  activeKey,
  defaultActiveKey,
  onChange,
  tabBarExtraContent,
  ...p
}: Base & {
  items?: {
    key: string;
    label: React.ReactNode;
    children?: React.ReactNode;
    disabled?: boolean;
  }[];
  onChange?: (v: string) => void;
}) {
  return (
    <TabsUI.Tabs
      {...p}
      value={activeKey}
      defaultValue={defaultActiveKey || items[0]?.key}
      onValueChange={onChange}
    >
      <div className="ui-tabs-heading">
        <TabsUI.TabsList className="ui-tabs-list">
          {items.map((i) => (
            <TabsUI.TabsTrigger disabled={i.disabled} key={i.key} value={i.key}>
              {i.label}
            </TabsUI.TabsTrigger>
          ))}
        </TabsUI.TabsList>
        {tabBarExtraContent}
      </div>
      {items.map((i) => (
        <TabsUI.TabsContent key={i.key} value={i.key}>
          {i.children}
        </TabsUI.TabsContent>
      ))}
    </TabsUI.Tabs>
  );
}

export function Pagination({
  total = 0,
  current = 1,
  pageSize = 10,
  onChange,
  showTotal,
  ...p
}: Base & {
  onChange?: (page: number, pageSize: number) => void;
  showTotal?: (total: number, range: [number, number]) => React.ReactNode;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="ui-pagination">
      {showTotal?.(total, [
        (current - 1) * pageSize + 1,
        Math.min(current * pageSize, total),
      ])}
      <Button
        size="small"
        aria-label="上一页"
        disabled={current <= 1}
        icon={<ChevronLeftIcon />}
        onClick={() => onChange?.(current - 1, pageSize)}
      />
      <span>
        {current} / {pages}
      </span>
      <Button
        size="small"
        aria-label="下一页"
        disabled={current >= pages}
        icon={<ChevronRightIcon />}
        onClick={() => onChange?.(current + 1, pageSize)}
      />
    </div>
  );
}
