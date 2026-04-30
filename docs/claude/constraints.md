# Layout Algorithm & Constraints

`layoutTree` in `MindMapEditor.tsx` computes a horizontal tree layout:

- Leaf node: `y = yCursor * VERTICAL_SPACING`, then increment yCursor
- Internal node: `y = (firstChild.y + lastChild.y) / 2`

## Critical Constraint

**`HORIZONTAL_SPACING` must be ≥ node `maxWidth` (CSS).** If the gap is too small, chain nodes overlap visually.

Current values:
```ts
// MindMapEditor.tsx
const HORIZONTAL_SPACING = 280;

// MindMapNode.tsx
maxWidth: 240,
minWidth: nodeData.isEditing ? 240 : 80,
```

If you increase `maxWidth`, increase `HORIZONTAL_SPACING` by the same amount to maintain the 40px gap.
