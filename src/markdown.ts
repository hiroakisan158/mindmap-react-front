import type { MindMapNodeRecord } from "./types";

/**
 * 兄弟ノードの並び順コンパレータ。
 * y 昇順（画面の上→下）で並べ、同値は createdAt→id でタイブレークする。
 * MindMapEditor の layoutTree と同じ順序に揃えるため共有ロジック。
 */
function byY(a: MindMapNodeRecord, b: MindMapNodeRecord): number {
  const dy = a.y - b.y;
  return dy !== 0 ? dy : (a.createdAt ?? a.id).localeCompare(b.createdAt ?? b.id);
}

/**
 * マインドマップのノード群を階層 Markdown 文字列に変換する。
 * - root（parentId なし）は見出し（# ＝タイトル）
 * - 大項目（階層2）で子を持つものは見出し（##）。前に `---` の区切り線を入れ、
 *   タイトルに `1-` `2-` の連番を振る
 * - 階層3 以降はすべて箇条書き（-）にし、インデントで階層を表現する
 * - 末端の大項目（子を持たない階層2）も箇条書きにする
 * - 兄弟は画面の上下順（y 昇順）で並べる
 */
export function recordsToMarkdown(records: MindMapNodeRecord[]): string {
  const childMap = new Map<string, MindMapNodeRecord[]>();
  records.forEach((r) => {
    if (r.parentId) {
      const list = childMap.get(r.parentId) ?? [];
      list.push(r);
      childMap.set(r.parentId, list);
    }
  });
  childMap.forEach((children) => children.sort(byY));

  const roots = records.filter((r) => !r.parentId).sort(byY);

  // 大項目（## 見出しになるノード＝子を持つ depth1）に連番を振る。
  // 箇条書きになる末端の depth1 はスキップし、番号が飛ばないようにする。
  const headerNumber = new Map<string, number>();
  roots.forEach((root) => {
    let n = 0;
    (childMap.get(root.id) ?? []).forEach((child) => {
      if ((childMap.get(child.id)?.length ?? 0) > 0) {
        n += 1;
        headerNumber.set(child.id, n);
      }
    });
  });

  const lines: string[] = [];

  // depth: root からの距離（0 始まり）／ bulletDepth: 直近の見出しからの箇条書きネスト段数
  const emit = (node: MindMapNodeRecord, depth: number, bulletDepth: number) => {
    const level = depth + 1; // root を階層1とする
    const label = node.label ?? "";
    const children = childMap.get(node.id) ?? [];
    const isRoot = depth === 0;
    // 見出しにするのは タイトル（階層1）と、子を持つ大項目（階層2）のみ。
    // 階層3 以降と、末端の大項目は箇条書きにする。
    const isHeader = isRoot || (level === 2 && children.length > 0);

    if (isHeader) {
      const num = headerNumber.get(node.id);
      if (level === 2) {
        // 大項目の境界を明確にするため区切り線を入れる
        lines.push("", "---", "");
      } else if (lines.length > 0) {
        lines.push(""); // 見出しの前に空行
      }
      const heading = num !== undefined ? `${num}- ${label}` : label;
      lines.push("#".repeat(level) + " " + heading);
      children.forEach((child) => emit(child, depth + 1, 0));
    } else {
      lines.push("  ".repeat(bulletDepth) + "- " + label);
      children.forEach((child) => emit(child, depth + 1, bulletDepth + 1));
    }
  };

  roots.forEach((root) => emit(root, 0, 0));

  return lines.join("\n") + "\n";
}
