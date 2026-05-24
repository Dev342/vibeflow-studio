export type VibeDocument = {
  workflow: {
    id: string;
    name: string;
    description?: string;
    steps: VibeStep[];
  };
};

export type VibeStep = {
  id: string;
  function: string;
  input?: Record<string, any>;
};

export type VibeIssue = {
  severity: "error" | "warning" | "info";
  stepId?: string;
  message: string;
  lineNumber?: number;
  column?: number;
};

export type VibeGraphNodeData = {
  stepId: string;
  functionName: string;
  label: string;
  summary: string;
  risk: "read" | "write" | "danger" | "unknown";
  issues: VibeIssue[];
  rawStep: VibeStep;
};

export type VibeGraph = {
  nodes: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    data: VibeGraphNodeData;
  }>;
  edges: Array<{
  id: string;
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
  type?: string;
  data?: Record<string, any>;
  markerEnd?: any;
}>;
};