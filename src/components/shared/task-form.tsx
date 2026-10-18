import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import React,{
createContext,
useContext,
useId,
useState,
useSyncExternalStore,
} from "react";

type Values = Record<string, any>;
type Rule = { required?: boolean; message?: string };
export type TaskFormStore = ReturnType<typeof createStore>;
function createStore() {
  let values: Values = {};
  let initial: Values = {};
  let version = 0;
  const listeners = new Set<() => void>();
  const fields = new Map<string, { rules: Rule[]; id: string }>();
  let finish: ((v: Values) => void) | undefined;
  let setErrors: ((e: Record<string, string>) => void) | undefined;
  const emit = () => {
    version++;
    listeners.forEach((f) => f());
  };
  return {
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    snapshot: () => version,
    initialize: (v: Values) => {
      initial = v;
      values = { ...v, ...values };
    },
    connect: (
      f: (v: Values) => void,
      e: (e: Record<string, string>) => void,
    ) => {
      finish = f;
      setErrors = e;
    },
    register: (name: string, rules: Rule[], id: string) => {
      fields.set(name, { rules, id });
      return () => {
        fields.delete(name);
      };
    },
    getFieldValue: (key: string) => values[key],
    getFieldsValue: () => ({ ...values }),
    setFieldsValue: (v: Values) => {
      values = { ...values, ...v };
      emit();
    },
    resetFields: () => {
      values = { ...initial };
      setErrors?.({});
      emit();
    },
    submit: () => {
      const errors: Record<string, string> = {};
      for (const [name, { rules }] of fields) {
        const value = values[name];
        for (const rule of rules) {
          if (
            rule.required &&
            (value == null ||
              value === "" ||
              (Array.isArray(value) && !value.length))
          ) {
            errors[name] = rule.message || "请填写此项";
            break;
          }
        }
      }
      setErrors?.(errors);
      const first = Object.keys(errors)[0];
      if (first) {
        document.getElementById(fields.get(first)!.id)?.focus();
        return;
      }
      finish?.({ ...values });
    },
  };
}
const Context = createContext<{
  store: TaskFormStore;
  errors: Record<string, string>;
} | null>(null);
function TaskForm({
  form,
  initialValues = {},
  onFinish,
  children,
  className,
}: {
  form: TaskFormStore;
  initialValues?: Values;
  onFinish: (v: any) => void;
  children: React.ReactNode;
  layout?: string;
  className?: string;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [ready] = useState(() => {
    form.initialize(initialValues);
    return true;
  });
  form.connect(onFinish, setErrors);
  useSyncExternalStore(form.subscribe, form.snapshot);
  return (
    <Context.Provider value={{ store: form, errors }}>
      <form
        className={cn("ui-form", className)}
        onSubmit={(e) => {
          e.preventDefault();
          form.submit();
        }}
      >
        {children}
      </form>
    </Context.Provider>
  );
}
function Field({
  name,
  label,
  rules = [],
  valuePropName = "value",
  noStyle,
  children,
  style,
}: {
  name?: string;
  label?: React.ReactNode;
  rules?: Rule[];
  valuePropName?: string;
  noStyle?: boolean;
  shouldUpdate?: boolean | ((a: any, b: any) => boolean);
  children: React.ReactNode | ((store: TaskFormStore) => React.ReactNode);
  style?: React.CSSProperties;
}) {
  const ctx = useContext(Context)!;
  const id = useId();
  useSyncExternalStore(ctx.store.subscribe, ctx.store.snapshot);
  React.useEffect(
    () => (name ? ctx.store.register(name, rules, id) : undefined),
    [name, ctx.store, id, JSON.stringify(rules)],
  );
  if (typeof children === "function") return <>{children(ctx.store)}</>;
  if (!name || !React.isValidElement(children)) return <>{children}</>;
  const props = children.props as any;
  const error = ctx.errors[name];
  const input = React.cloneElement(children as React.ReactElement<any>, {
    id,
    [valuePropName]: ctx.store.getFieldValue(name),
    "aria-invalid": !!error,
    "aria-describedby": error ? `${id}-error` : undefined,
    onChange: (...args: any[]) => {
      const e = args[0];
      const v = e?.target
        ? e.target[valuePropName]
        : e?.toHexString
          ? e.toHexString()
          : e;
      ctx.store.setFieldsValue({ [name]: v });
      props.onChange?.(...args);
    },
  });
  return noStyle ? (
    input
  ) : (
    <div className="ui-field" style={style}>
      <Label htmlFor={id}>
        {label}
        {rules.some((r) => r.required) && <span aria-hidden="true"> *</span>}
      </Label>
      {input}
      {error && (
        <p id={`${id}-error`} className="ui-field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
export const Form = Object.assign(TaskForm, {
  Item: Field,
  useForm: () => [useState(createStore)[0]] as const,
});
