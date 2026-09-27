import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { Workflow } from "../shared/schema";
const fingerprint = (w: Workflow) =>
  JSON.stringify({
    ...w,
    nodes: w.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data,
    })),
    edges: w.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      label: e.label,
    })),
  });
export function useWorkflowHistory(
  workflow: Workflow,
  setWorkflow: Dispatch<SetStateAction<Workflow>>,
  disabled: boolean,
) {
  const committed = useRef(structuredClone(workflow)),
    past = useRef<Workflow[]>([]),
    future = useRef<Workflow[]>([]),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    current = useRef(workflow),
    restoring = useRef(false);
  const [, render] = useState(0);
  current.current = workflow;
  const refresh = () => render((v) => v + 1);
  useEffect(() => {
    clearTimeout(timer.current);
    if (committed.current.id !== workflow.id) {
      past.current = [];
      future.current = [];
      committed.current = structuredClone(workflow);
      refresh();
      return;
    }
    if (restoring.current) {
      restoring.current = false;
      return;
    }
    if (fingerprint(workflow) === fingerprint(committed.current)) return;
    timer.current = setTimeout(() => {
      past.current = [...past.current.slice(-39), committed.current];
      future.current = [];
      committed.current = structuredClone(workflow);
      refresh();
    }, 450);
    return () => clearTimeout(timer.current);
  }, [workflow]);
  function undo() {
    if (disabled) return;
    clearTimeout(timer.current);
    const now = current.current;
    let target: Workflow | undefined;
    if (fingerprint(now) !== fingerprint(committed.current))
      target = committed.current;
    else target = past.current.pop();
    if (!target) return;
    future.current.push(structuredClone(now));
    committed.current = structuredClone(target);
    restoring.current = true;
    setWorkflow(structuredClone(target));
    refresh();
  }
  function redo() {
    if (disabled) return;
    clearTimeout(timer.current);
    const target = future.current.pop();
    if (!target) return;
    past.current.push(structuredClone(current.current));
    committed.current = structuredClone(target);
    restoring.current = true;
    setWorkflow(structuredClone(target));
    refresh();
  }
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const element = event.target as HTMLElement;
      if (
        element.closest('input,textarea,select,[contenteditable="true"]') ||
        disabled
      )
        return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  return {
    undo,
    redo,
    canUndo:
      past.current.length > 0 ||
      fingerprint(workflow) !== fingerprint(committed.current),
    canRedo: future.current.length > 0,
  };
}
