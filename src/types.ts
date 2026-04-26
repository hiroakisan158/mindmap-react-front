import type { Schema } from "../amplify/data/resource";

export type MindMapProject = Schema["MindMapProject"]["type"];
export type MindMapNodeRecord = Schema["MindMapNode"]["type"];

export type NodeData = {
  label: string;
  color: string;
  isEditing: boolean;
  onLabelChange: (id: string, label: string) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (id: string) => void;
  onStartEdit: (id: string) => void;
  onStopEdit: (id: string) => void;
  [key: string]: unknown;
};
