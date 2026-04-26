import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Position,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../amplify/data/resource";
import type { MindMapNodeRecord, NodeData } from "./types";
import MindMapNodeComponent from "./MindMapNode";

const client = generateClient<Schema>();

const NODE_TYPES = { mindmap: MindMapNodeComponent };

const HORIZONTAL_SPACING = 280;
const VERTICAL_SPACING = 70;

const COLORS = [
  "#89dceb",
  "#a6e3a1",
  "#fab387",
  "#f9e2af",
  "#cba6f7",
  "#89b4fa",
  "#f38ba8",
];

function colorForDepth(depth: number): string {
  return COLORS[depth % COLORS.length];
}

/**
 * 横方向のツリーレイアウトを計算する。
 * - 深さ（root からの距離）で x を決定
 * - 各サブツリーを縦に積み上げ、親は子の中央に配置
 */
function layoutTree(
  records: MindMapNodeRecord[]
): Map<string, { x: number; y: number }> {
  const childMap = new Map<string, MindMapNodeRecord[]>();
  records.forEach((r) => {
    if (r.parentId) {
      const list = childMap.get(r.parentId) ?? [];
      list.push(r);
      childMap.set(r.parentId, list);
    }
  });

  // y 座標でソート（同じ y の場合は createdAt でタイブレーク）
  const byY = (a: MindMapNodeRecord, b: MindMapNodeRecord) => {
    const dy = a.y - b.y;
    return dy !== 0 ? dy : (a.createdAt ?? a.id).localeCompare(b.createdAt ?? b.id);
  };
  childMap.forEach((children) => children.sort(byY));

  const positions = new Map<string, { x: number; y: number }>();
  let yCursor = 0;

  function layout(node: MindMapNodeRecord, depth: number): number {
    const x = depth * HORIZONTAL_SPACING;
    const children = childMap.get(node.id) ?? [];

    if (children.length === 0) {
      const y = yCursor * VERTICAL_SPACING;
      positions.set(node.id, { x, y });
      yCursor++;
      return y;
    }

    const childYs = children.map((child) => layout(child, depth + 1));
    const centerY = (childYs[0] + childYs[childYs.length - 1]) / 2;
    positions.set(node.id, { x, y: centerY });
    return centerY;
  }

  const roots = records
    .filter((r) => !r.parentId)
    .sort(byY);

  roots.forEach((root, i) => {
    if (i > 0) yCursor++; // ルートツリー間に余白
    layout(root, 0);
  });

  return positions;
}

/**
 * レイアウト計算結果を records に適用した新しい配列を返す。
 */
function applyLayout(records: MindMapNodeRecord[]): MindMapNodeRecord[] {
  const positions = layoutTree(records);
  return records.map((r) => {
    const pos = positions.get(r.id);
    if (!pos) return r;
    return { ...r, x: pos.x, y: pos.y };
  });
}

/**
 * 位置に変更があったレコードのみを抽出する。
 */
function diffPositions(
  oldRecords: MindMapNodeRecord[],
  newRecords: MindMapNodeRecord[]
): MindMapNodeRecord[] {
  const oldMap = new Map(oldRecords.map((r) => [r.id, r]));
  return newRecords.filter((r) => {
    const old = oldMap.get(r.id);
    if (!old) return true;
    return old.x !== r.x || old.y !== r.y;
  });
}

function buildFlowGraph(
  records: MindMapNodeRecord[],
  editingId: string | null,
  handlers: {
    onLabelChange: (id: string, label: string) => void;
    onAddChild: (parentId: string) => void;
    onAddSibling: (nodeId: string) => void;
    onDelete: (id: string) => void;
    onStartEdit: (id: string) => void;
    onStopEdit: (id: string) => void;
  }
): { nodes: Node<NodeData>[]; edges: Edge[] } {
  const depthMap = new Map<string, number>();
  const childMap = new Map<string, string[]>();

  records.forEach((r) => {
    if (r.parentId) {
      const siblings = childMap.get(r.parentId) ?? [];
      siblings.push(r.id);
      childMap.set(r.parentId, siblings);
    } else {
      depthMap.set(r.id, 0);
    }
  });

  const queue = records.filter((r) => !r.parentId).map((r) => r.id);
  while (queue.length > 0) {
    const id = queue.shift()!;
    const depth = depthMap.get(id) ?? 0;
    (childMap.get(id) ?? []).forEach((childId) => {
      depthMap.set(childId, depth + 1);
      queue.push(childId);
    });
  }

  const nodes: Node<NodeData>[] = records.map((r) => ({
    id: r.id,
    type: "mindmap",
    position: { x: r.x, y: r.y },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    data: {
      label: r.label,
      color: r.color ?? colorForDepth(depthMap.get(r.id) ?? 0),
      isEditing: editingId === r.id,
      isRoot: !r.parentId,
      ...handlers,
    },
    dragHandle: ".mind-map-node",
  }));

  const edges: Edge[] = records
    .filter((r) => r.parentId)
    .map((r) => ({
      id: `e-${r.parentId}-${r.id}`,
      source: r.parentId!,
      target: r.id,
      type: "smoothstep",
      style: { stroke: "#94a3b8", strokeWidth: 2 },
    }));

  return { nodes, edges };
}

interface Props {
  projectId: string;
  projectName: string;
  onBack?: () => void;
}

export default function MindMapEditor({ projectId, projectName, onBack }: Props) {
  const [records, setRecords] = useState<MindMapNodeRecord[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const pendingLabelRef = useRef<Map<string, string>>(new Map());

  /**
   * レイアウトを再計算して、変更があったレコードのみ DB に保存する。
   */
  const persistLayout = useCallback(
    async (
      sourceRecords: MindMapNodeRecord[]
    ): Promise<MindMapNodeRecord[]> => {
      const laidOut = applyLayout(sourceRecords);
      const changed = diffPositions(sourceRecords, laidOut);
      await Promise.all(
        changed.map((r) =>
          client.models.MindMapNode.update({ id: r.id, x: r.x, y: r.y })
        )
      );
      return laidOut;
    },
    []
  );

  const handlers = useMemo(
    () => ({
      onLabelChange: (id: string, label: string) => {
        pendingLabelRef.current.set(id, label);
      },
      onAddChild: async (parentId: string) => {
        const parent = records.find((r) => r.id === parentId);
        if (!parent) return;
        // 既存の子の最大 y より大きい値を設定 → レイアウト時に末尾に並ぶ
        const children = records.filter((r) => r.parentId === parentId);
        const insertY =
          children.length > 0
            ? Math.max(...children.map((c) => c.y)) + 1
            : parent.y;
        const { data } = await client.models.MindMapNode.create({
          projectId,
          parentId,
          label: "新しいノード",
          x: parent.x,
          y: insertY,
        });
        if (!data) return;
        const next = await persistLayout([...records, data]);
        setRecords(next);
        setEditingId(data.id);
      },
      onAddSibling: async (nodeId: string) => {
        const node = records.find((r) => r.id === nodeId);
        if (!node || !node.parentId) return;
        // 同じ親の兄弟を y でソートし、現在ノードの直後に挿入
        const siblings = records
          .filter((r) => r.parentId === node.parentId)
          .sort((a, b) => a.y - b.y);
        const idx = siblings.findIndex((r) => r.id === nodeId);
        const next = siblings[idx + 1];
        // 現在ノードと次の兄弟の中間 y を設定（最後尾なら +1）
        const insertY = next ? (node.y + next.y) / 2 : node.y + 1;
        const { data } = await client.models.MindMapNode.create({
          projectId,
          parentId: node.parentId,
          label: "新しいノード",
          x: node.x,
          y: insertY,
        });
        if (!data) return;
        const laid = await persistLayout([...records, data]);
        setRecords(laid);
        setEditingId(data.id);
      },
      onDelete: async (id: string) => {
        const toDelete: string[] = [];
        const collect = (nodeId: string) => {
          toDelete.push(nodeId);
          records
            .filter((r) => r.parentId === nodeId)
            .forEach((child) => collect(child.id));
        };
        collect(id);
        await Promise.all(
          toDelete.map((nid) => client.models.MindMapNode.delete({ id: nid }))
        );
        const remaining = records.filter((r) => !toDelete.includes(r.id));
        const next = await persistLayout(remaining);
        setRecords(next);
      },
      onStartEdit: (id: string) => setEditingId(id),
      onStopEdit: async (id: string) => {
        const newLabel = pendingLabelRef.current.get(id);
        if (newLabel !== undefined) {
          await client.models.MindMapNode.update({ id, label: newLabel });
          setRecords((prev) =>
            prev.map((r) => (r.id === id ? { ...r, label: newLabel } : r))
          );
          pendingLabelRef.current.delete(id);
        }
        setEditingId(null);
      },
    }),
    [projectId, records, persistLayout]
  );

  const { nodes, edges } = useMemo(
    () => buildFlowGraph(records, editingId, handlers),
    [records, editingId, handlers]
  );

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(nodes);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(edges);

  useEffect(() => {
    setFlowNodes(nodes);
  }, [nodes, setFlowNodes]);

  useEffect(() => {
    setFlowEdges(edges);
  }, [edges, setFlowEdges]);

  useEffect(() => {
    client.models.MindMapNode.listByProject({ projectId }).then(({ data }) => {
      setRecords(data);
    });
  }, [projectId]);

  const onNodeDragStop: NodeMouseHandler = useCallback(
    async (_event, node) => {
      await client.models.MindMapNode.update({
        id: node.id,
        x: node.position.x,
        y: node.position.y,
      });
      setRecords((prev) =>
        prev.map((r) =>
          r.id === node.id
            ? { ...r, x: node.position.x, y: node.position.y }
            : r
        )
      );
    },
    []
  );

  const handleAutoLayout = useCallback(async () => {
    const next = await persistLayout(records);
    setRecords(next);
  }, [records, persistLayout]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        flex: 1,
        minHeight: 0,
      }}
    >
      <div
        style={{
          padding: "10px 16px",
          background: "#fff",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        {onBack && (
          <button
            onClick={onBack}
            style={{
              background: "none",
              border: "none",
              fontSize: "1.3em",
              lineHeight: 1,
              color: "#64748b",
              padding: "4px 8px",
              borderRadius: 6,
            }}
            title="プロジェクト一覧に戻る"
          >
            ←
          </button>
        )}
        <h2
          style={{
            fontWeight: 700,
            fontSize: "1.1em",
            flex: 1,
            color: "#1e293b",
            paddingLeft: onBack ? 0 : 40,
          }}
        >
          {projectName}
        </h2>
        <button
          onClick={handleAutoLayout}
          style={{
            background: "#f1f5f9",
            color: "#475569",
            border: "1px solid #cbd5e1",
            borderRadius: 6,
            padding: "5px 12px",
            fontSize: "0.82em",
            fontWeight: 600,
          }}
          title="ノード配置を自動整列"
        >
          ⤢ 自動整列
        </button>
        <span style={{ fontSize: "0.75em", color: "#94a3b8" }}>
          ダブルクリック: 編集
        </span>
      </div>

      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={NODE_TYPES}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={onNodeDragStop}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.2}
          maxZoom={2}
        >
          <Background color="#e2e8f0" gap={20} />
          <Controls />
          <MiniMap
            nodeColor={(n) => (n.data as NodeData).color as string}
            maskColor="rgba(0,0,0,0.05)"
          />
        </ReactFlow>
      </div>
    </div>
  );
}
