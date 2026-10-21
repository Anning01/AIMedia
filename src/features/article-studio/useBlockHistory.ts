import { useCallback, useRef, useState, type SetStateAction } from "react";
import type { Block } from "./model";

const LIMIT = 100;

export function sameBlocks(left: Block[], right: Block[]) {
  return left === right || (
    left.length === right.length && left.every((a, i) => {
      const b = right[i];
      const sameItems = a.items === b.items || (
        !!a.items && !!b.items && a.items.length === b.items.length &&
        a.items.every((item, j) => item === b.items![j])
      );
      return a === b || (
        a.id === b.id && a.type === b.type && a.text === b.text &&
        a.src === b.src && a.cover === b.cover && a.card === b.card && sameItems
      );
    })
  );
}

export function useBlockHistory() {
  const [history, setHistory] = useState<{
    past: Block[][];
    present: Block[];
    future: Block[][];
  }>({ past: [], present: [], future: [] });
  const current = useRef(history);
  const publish = useCallback((next: typeof history) => {
    current.current = next;
    setHistory(next);
  }, []);
  const setBlocks = useCallback((update: SetStateAction<Block[]>) => {
    const state = current.current;
    const next = typeof update === "function" ? update(state.present) : update;
    if (sameBlocks(state.present, next)) return;
    publish({
      past: [...state.past, state.present].slice(-LIMIT),
      present: next,
      future: [],
    });
  }, [publish]);
  const resetBlocks = useCallback((blocks: Block[]) => publish({past: [], present: blocks, future: []}), [publish]);
  const undoBlocks = useCallback(() => {
    const state = current.current;
    if (!state.past.length) return false;
    publish({
      past: state.past.slice(0, -1),
      present: state.past[state.past.length - 1],
      future: [state.present, ...state.future],
    });
    return true;
  }, [publish]);
  const redoBlocks = useCallback(() => {
    const state = current.current;
    if (!state.future.length) return false;
    publish({
      past: [...state.past, state.present],
      present: state.future[0],
      future: state.future.slice(1),
    });
    return true;
  }, [publish]);
  return {
    blocks: history.present,
    setBlocks,
    resetBlocks,
    undoBlocks,
    redoBlocks,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
