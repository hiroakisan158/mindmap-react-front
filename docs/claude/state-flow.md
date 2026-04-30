# State Flow

`records` (useState) is the single source of truth for node data.

On node add/delete: `persistLayout()` recalculates layout → bulk DB update → `setRecords()`.
ReactFlow's `flowNodes/flowEdges` are derived from `records` via useMemo and synced via useEffect.

## y-value dual role

The DB `y` field serves two purposes: pixel coordinate and sibling ordering. On node creation, `insertY = max(siblings.y) + 1` is a placeholder value; `persistLayout()` immediately normalizes it to `yCursor * VERTICAL_SPACING`.
