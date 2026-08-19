import type { ActionEngine } from "../types/action.js";

export type ActionDefinition = {
  name: string;
  category: string;
  engines: readonly Exclude<ActionEngine, "auto">[];
  readOnly: boolean;
  description: string;
};
