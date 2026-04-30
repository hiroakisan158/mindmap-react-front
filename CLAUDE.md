# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # 開発サーバー（事前に ampx sandbox が必要）
npm run build      # 型チェック + ビルド
npm run lint       # ESLint

npx ampx sandbox          # Amplifyバックエンド起動（初回3〜5分）
npx ampx sandbox delete   # AWSリソース削除
```

テストスイートは存在しない。`amplify_outputs.json` は `npx ampx sandbox` で自動生成され、これがないとローカル起動不可。

## Architecture

Vite + React 18 + TypeScript。バックエンドは AWS Amplify Gen2（AppSync + DynamoDB）、認証は Cognito メール認証（owner-based）。

**コンポーネント構成：**
- `App.tsx` — プロジェクト一覧サイドバー、作成・削除
- `MindMapEditor.tsx` — ノード CRUD・レイアウト計算・ReactFlow 制御（ロジックの大半）
- `MindMapNode.tsx` — ノード 1 つの描画と操作ボタン（+, ↓, ↑, ×）
- `amplify/data/resource.ts` — データスキーマ（`MindMapProject`, `MindMapNode`）

**データモデル：** `MindMapNode` は `projectId`（GSI あり、`listByProject()` で取得）、`parentId`（null = ルート）、`label`、`x`、`y`、`color` を持つ。

## Layout Algorithm

`layoutTree`（`MindMapEditor.tsx`）が横方向ツリーレイアウトを計算：

- リーフ → `y = yCursor * VERTICAL_SPACING`（yCursor をインクリメント）
- 内部ノード → `y = (最初の子のy + 最後の子のy) / 2`

**重要制約：`HORIZONTAL_SPACING` ≥ ノードの `maxWidth`（CSS）。** 差が小さいとチェーン状のノードが視覚的に重なる。現在の値：

```ts
// MindMapEditor.tsx
const HORIZONTAL_SPACING = 280;

// MindMapNode.tsx  
maxWidth: 240,
minWidth: nodeData.isEditing ? 240 : 80,
```

## State Flow

`records`（useState）が唯一の正。ノード追加・削除時は `persistLayout()` でレイアウト再計算 → DB 一括更新 → `setRecords()`。ReactFlow の `flowNodes/flowEdges` は `records` から useMemo で導出され、useEffect で同期される。

DB の `y` 値は座標と兄弟順序の両方に使われる。新規ノード作成時は `insertY = max(siblingsのy) + 1` で仮値を入れ、直後の `persistLayout()` で正規化される。
