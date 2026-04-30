# Architecture

Stack: Vite + React 18 + TypeScript, AWS Amplify Gen2 (AppSync + DynamoDB), Cognito email auth (owner-based).

## Components

- `App.tsx` — project list sidebar, create/delete projects
- `MindMapEditor.tsx` — node CRUD, layout calculation, ReactFlow control (most logic lives here)
- `MindMapNode.tsx` — single node rendering with action buttons (+, ↓, ↑, ×)
- `amplify/data/resource.ts` — data schema (`MindMapProject`, `MindMapNode`)

## Data Model

`MindMapNode` fields: `projectId` (GSI → use `listByProject()`), `parentId` (null = root), `label`, `x`, `y`, `color`.
