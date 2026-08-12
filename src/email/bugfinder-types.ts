/**
 * Types matching @soamee/bugfinder-client envelope format.
 * Inlined here to avoid a runtime dependency — the client sends these
 * via the x-bugfinder header, and the filter parses them server-side.
 */

export type ActionCategory =
  | "navigation"
  | "click"
  | "form"
  | "input"
  | "api"
  | "error"
  | "visibility"
  | "custom";

export interface BugfinderAction {
  action: string;
  category: ActionCategory;
  timestamp: string;
  method?: string;
  path?: string;
  elapsed?: number;
  target?: string;
  formName?: string;
}

export interface PathContext {
  currentPath: string;
  previousPath: string;
}

export interface SessionContext {
  startedAt: string;
  actionCount: number;
  viewport?: { w: number; h: number };
}

export interface BugfinderEnvelope {
  path: PathContext;
  actions: BugfinderAction[];
  session: SessionContext;
}
