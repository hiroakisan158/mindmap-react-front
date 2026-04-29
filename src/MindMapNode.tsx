import { useEffect, useRef, useCallback } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { NodeData } from "./types";

const BTN_BASE: React.CSSProperties = {
  position: "absolute",
  borderRadius: "50%",
  border: "2px solid #fff",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 10,
  padding: 0,
  boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
};

export default function MindMapNodeComponent({
  id,
  data,
  selected,
}: NodeProps) {
  const nodeData = data as NodeData;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (nodeData.isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [nodeData.isEditing]);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      nodeData.onStartEdit(id);
    },
    [id, nodeData]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" || e.key === "Escape") {
        nodeData.onStopEdit(id);
      }
    },
    [id, nodeData]
  );

  return (
    <div
      style={{
        position: "relative",
        padding: "8px 14px",
        borderRadius: 20,
        background: nodeData.color,
        border: nodeData.isEditing
          ? "2px dashed #3b82f6"
          : selected
          ? "2px solid #3b82f6"
          : "2px solid rgba(0,0,0,0.08)",
        minWidth: nodeData.isEditing ? 400 : 80,
        maxWidth: 400,
        textAlign: "center",
        cursor: "grab",
        boxShadow: nodeData.isEditing
          ? "0 0 0 3px rgba(59,130,246,0.25), 0 2px 8px rgba(0,0,0,0.12)"
          : "0 2px 8px rgba(0,0,0,0.12)",
        filter: nodeData.isEditing ? "brightness(1.12)" : undefined,
        userSelect: "none",
      }}
      onDoubleClick={handleDoubleClick}
      className="mind-map-node"
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />

      {nodeData.isEditing ? (
        <input
          ref={inputRef}
          defaultValue={nodeData.label}
          onChange={(e) => nodeData.onLabelChange(id, e.target.value)}
          onBlur={() => nodeData.onStopEdit(id)}
          onKeyDown={handleKeyDown}
          style={{
            background: "transparent",
            border: "none",
            outline: "none",
            textAlign: "center",
            width: "100%",
            fontSize: "0.9em",
            color: "#1e1e2e",
            fontWeight: 600,
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          style={{
            fontSize: "0.9em",
            fontWeight: 600,
            color: "#1e1e2e",
            wordBreak: "break-word",
          }}
        >
          {nodeData.label}
        </span>
      )}

      {/* 子ノード追加ボタン（右下） */}
      <button
        className="nodrag nopan node-action-btn"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          nodeData.onAddChild(id);
        }}
        title="子ノードを追加"
        style={{
          ...BTN_BASE,
          bottom: -12,
          right: -12,
          width: 24,
          height: 24,
          background: "#3b82f6",
          color: "#fff",
          fontSize: "1em",
          lineHeight: 1,
        }}
      >
        +
      </button>

      {/* 上に兄弟ノード追加ボタン（上中央）— 同グループ最上位のみ表示 */}
      {nodeData.isFirstSibling && (
        <button
          className="nodrag nopan node-action-btn"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            nodeData.onAddAbove(id);
          }}
          title="上に並列ノードを追加"
          style={{
            ...BTN_BASE,
            top: -12,
            left: "50%",
            transform: "translateX(-50%)",
            width: 24,
            height: 24,
            background: "#22c55e",
            color: "#fff",
            fontSize: "0.85em",
            lineHeight: 1,
          }}
        >
          ↑
        </button>
      )}

      {/* 兄弟ノード追加ボタン（下中央）— ルート以外のみ表示 */}
      {!nodeData.isRoot && (
        <button
          className="nodrag nopan node-action-btn"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            nodeData.onAddSibling(id);
          }}
          title="下に並列ノードを追加"
          style={{
            ...BTN_BASE,
            bottom: -12,
            left: "50%",
            transform: "translateX(-50%)",
            width: 24,
            height: 24,
            background: "#22c55e",
            color: "#fff",
            fontSize: "0.85em",
            lineHeight: 1,
          }}
        >
          ↓
        </button>
      )}

      {/* 削除ボタン（右上） */}
      <button
        className="nodrag nopan node-action-btn"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          nodeData.onDelete(id);
        }}
        title="削除"
        style={{
          ...BTN_BASE,
          top: -10,
          right: -10,
          width: 20,
          height: 20,
          background: "#f38ba8",
          color: "#1e1e2e",
          fontSize: "0.75em",
        }}
      >
        ×
      </button>

      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
}
