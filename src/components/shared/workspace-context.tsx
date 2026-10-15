import { createContext,useContext } from "react";

// A feature owns one state instance; its panels consume that instance without duplicating effects.
export function createWorkspaceContext<T>(name: string) {
  const Context = createContext<T | null>(null);
  function useWorkspace() {
    const value = useContext(Context);
    if (!value)
      throw new Error(`${name} must be rendered inside its workspace`);
    return value;
  }
  return [Context.Provider, useWorkspace] as const;
}
