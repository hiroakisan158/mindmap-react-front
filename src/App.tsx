import { useEffect, useState } from "react";
import { generateClient } from "aws-amplify/data";
import { useAuthenticator } from "@aws-amplify/ui-react";
import type { Schema } from "../amplify/data/resource";
import type { MindMapProject } from "./types";
import MindMapEditor from "./MindMapEditor";

const client = generateClient<Schema>();

export default function App() {
  const { user, signOut } = useAuthenticator();
  const [projects, setProjects] = useState<MindMapProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  useEffect(() => {
    client.models.MindMapProject.list().then(({ data }) => {
      const sorted = [...data].sort(
        (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
      );
      setProjects(sorted);
      if (sorted.length > 0) {
        const latest = [...sorted].sort(
          (a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")
        )[0];
        setSelectedProjectId(latest.id);
      }
    });
  }, []);

  async function createProject() {
    if (!projectName.trim()) return;
    const { data: proj } = await client.models.MindMapProject.create({
      name: projectName.trim(),
      displayOrder: projects.length,
    });
    if (!proj) return;
    await client.models.MindMapNode.create({
      projectId: proj.id,
      label: projectName.trim(),
      x: 300,
      y: 200,
    });
    setProjects((prev) => [...prev, proj]);
    setSelectedProjectId(proj.id);
    setProjectName("");
    setShowModal(false);
    if (isMobile) setSidebarOpen(false);
  }

  async function deleteProject(id: string) {
    if (!confirm("このマインドマップを削除しますか？")) return;
    const { data: nodes } = await client.models.MindMapNode.listByProject({
      projectId: id,
    });
    await Promise.all(nodes.map((n) => client.models.MindMapNode.delete({ id: n.id })));
    await client.models.MindMapProject.delete({ id });
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (selectedProjectId === id) setSelectedProjectId(null);
  }

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* モバイル用バックドロップ */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 99,
          }}
        />
      )}

      {/* サイドバー */}
      <aside
        style={{
          width: 220,
          background: "#1e1e2e",
          color: "#cdd6f4",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          ...(isMobile && {
            position: "fixed",
            top: 0,
            left: 0,
            height: "100vh",
            zIndex: 100,
            transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
            transition: "transform 0.25s ease",
          }),
        }}
      >
        <div
          style={{
            padding: "16px 12px 10px",
            borderBottom: "1px solid #313244",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: "1.1em", marginBottom: 4 }}>
            Mind Map
          </div>
          <div
            style={{
              fontSize: "0.72em",
              color: "#a6adc8",
              wordBreak: "break-all",
            }}
          >
            {user?.signInDetails?.loginId}
          </div>
        </div>

        <div
          style={{
            padding: "10px 12px 4px",
            fontSize: "0.7em",
            color: "#6c7086",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Projects
        </div>

        <ul
          style={{
            flex: 1,
            overflowY: "auto",
            listStyle: "none",
            padding: "0 8px",
          }}
        >
          {projects.map((p) => (
            <li
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                borderRadius: 6,
                padding: "7px 8px",
                marginBottom: 2,
                background:
                  p.id === selectedProjectId ? "#313244" : "transparent",
                cursor: "pointer",
                transition: "background 0.15s",
              }}
            >
              <span
                style={{
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontSize: "0.9em",
                }}
                onClick={() => {
                  setSelectedProjectId(p.id);
                  if (isMobile) setSidebarOpen(false);
                }}
              >
                {p.name}
              </span>
              <button
                onClick={() => deleteProject(p.id)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#585b70",
                  fontSize: "0.85em",
                  padding: "0 2px",
                  lineHeight: 1,
                  flexShrink: 0,
                }}
                title="削除"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>

        <div style={{ padding: "8px" }}>
          <button
            onClick={() => setShowModal(true)}
            style={{
              width: "100%",
              padding: "9px",
              background: "#89b4fa",
              color: "#1e1e2e",
              border: "none",
              borderRadius: 6,
              fontWeight: 700,
              fontSize: "0.9em",
            }}
          >
            + New Map
          </button>
        </div>

        <div style={{ padding: "8px", borderTop: "1px solid #313244" }}>
          <button
            onClick={signOut}
            style={{
              width: "100%",
              padding: "7px",
              background: "transparent",
              color: "#a6adc8",
              border: "1px solid #45475a",
              borderRadius: 6,
              fontSize: "0.82em",
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* メインエリア */}
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          background: "#f8fafc",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* モバイルメニューボタン */}
        {isMobile && (
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            style={{
              position: "fixed",
              top: 12,
              left: 12,
              zIndex: 50,
              background: "#1e1e2e",
              border: "none",
              borderRadius: 6,
              padding: "8px 10px",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
            aria-label="メニュー"
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  display: "block",
                  width: 20,
                  height: 2,
                  background: "#cdd6f4",
                  borderRadius: 1,
                }}
              />
            ))}
          </button>
        )}

        {selectedProject ? (
          <MindMapEditor
            key={selectedProject.id}
            projectId={selectedProject.id}
            projectName={selectedProject.name}
            onBack={isMobile ? () => setSelectedProjectId(null) : undefined}
          />
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#94a3b8",
              textAlign: "center",
              padding: 24,
            }}
          >
            {projects.length === 0 ? (
              <div>
                <div style={{ fontSize: "2.5em", marginBottom: 12 }}>🗺️</div>
                <div
                  style={{
                    fontSize: "1.1em",
                    marginBottom: 8,
                    color: "#64748b",
                  }}
                >
                  マインドマップを作成しましょう
                </div>
                <div style={{ fontSize: "0.85em" }}>
                  左のサイドバーの「+ New Map」から始めてください
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: "2em", marginBottom: 8 }}>👈</div>
                <div style={{ fontSize: "1em", color: "#64748b" }}>
                  左のサイドバーからプロジェクトを選択してください
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* プロジェクト作成モーダル */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 28,
              width: 400,
              maxWidth: "90vw",
              boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
            }}
          >
            <h3
              style={{
                marginBottom: 16,
                fontSize: "1.1em",
                fontWeight: 700,
                color: "#1e293b",
              }}
            >
              新規マインドマップ
            </h3>
            <input
              autoFocus
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createProject()}
              placeholder="マインドマップ名"
              style={{
                width: "100%",
                padding: "9px 12px",
                border: "1px solid #cbd5e1",
                borderRadius: 7,
                fontSize: "0.95em",
                outline: "none",
              }}
            />
            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "flex-end",
                marginTop: 18,
              }}
            >
              <button
                onClick={() => {
                  setShowModal(false);
                  setProjectName("");
                }}
                style={{
                  padding: "8px 20px",
                  background: "#f1f5f9",
                  color: "#475569",
                  border: "1px solid #cbd5e1",
                  borderRadius: 7,
                  fontSize: "0.9em",
                }}
              >
                キャンセル
              </button>
              <button
                onClick={createProject}
                style={{
                  padding: "8px 20px",
                  background: "#3b82f6",
                  color: "#fff",
                  border: "none",
                  borderRadius: 7,
                  fontWeight: 700,
                  fontSize: "0.9em",
                }}
              >
                作成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
