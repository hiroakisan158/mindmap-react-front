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
 * - root（parentId なし）は必ず見出し（# ＝タイトル）
 * - 子を持つ中間ノードは見出し（## 〜 ######）
 * - 末端ノード（子を持たない）は見出しにせず箇条書き（-）にする（読みやすさのため）
 * - 見出しの上限（######）を超える 7 階層目以降の親も箇条書きにフォールバック
 * - 箇条書きは、直近の見出し配下を基準にネストしてインデントする
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

  const lines: string[] = [];

  // depth: root からの距離（0 始まり）／ bulletDepth: 直近の見出しからの箇条書きネスト段数
  const emit = (node: MindMapNodeRecord, depth: number, bulletDepth: number) => {
    const level = depth + 1; // root を階層1とする
    const label = node.label ?? "";
    const children = childMap.get(node.id) ?? [];
    const isRoot = depth === 0;
    // root、または「子を持ち かつ 見出し上限内」のノードを見出しにする。末端は箇条書き。
    const isHeader = isRoot || (children.length > 0 && level <= 6);

    if (isHeader) {
      if (lines.length > 0) lines.push(""); // 見出しの前に空行
      lines.push("#".repeat(level) + " " + label);
      children.forEach((child) => emit(child, depth + 1, 0));
    } else {
      lines.push("  ".repeat(bulletDepth) + "- " + label);
      children.forEach((child) => emit(child, depth + 1, bulletDepth + 1));
    }
  };

  const roots = records.filter((r) => !r.parentId).sort(byY);
  roots.forEach((root) => emit(root, 0, 0));

  return lines.join("\n") + "\n";
}

/**
 * プロジェクト名から .md ダウンロード用の安全なファイル名を生成する。
 * 空白は _ に、ファイル名に使えない文字は除去し、末尾に .md を付ける。
 * 空になる場合は mindmap.md にフォールバック。
 */
export function sanitizeFilename(name: string): string {
  const base = (name ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "_");
  return (base || "mindmap") + ".md";
}
