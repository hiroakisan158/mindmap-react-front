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
    <div
      style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
        background: "var(--color-app-bg)",
      }}
    >
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            zIndex: 99,
          }}
        />
      )}

      <aside
        style={{
          width: 220,
          background: "var(--color-surface)",
          color: "var(--color-text)",
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
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: "1.1em", marginBottom: 4 }}>
            Mind Map
          </div>
          <div
            style={{
              fontSize: "0.72em",
              color: "var(--color-text-muted)",
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
            color: "var(--color-text-subtle)",
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
                  p.id === selectedProjectId ? "var(--color-surface-muted)" : "transparent",
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
                  color: "var(--color-text-subtle)",
                  fontSize: "0.85em",
                  padding: "0 2px",
                  lineHeight: 1,
                  flexShrink: 0,
                }}
                title="削除"
              >
                ×
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
              background: "var(--color-primary)",
              color: "var(--color-primary-contrast)",
              border: "none",
              borderRadius: 6,
              fontWeight: 700,
              fontSize: "0.9em",
            }}
          >
            + New Map
          </button>
        </div>

        <div style={{ padding: "8px", borderTop: "1px solid var(--color-border)" }}>
          <button
            onClick={signOut}
            style={{
              width: "100%",
              padding: "7px",
              background: "transparent",
              color: "var(--color-text-muted)",
              border: "1px solid var(--color-border-strong)",
              borderRadius: 6,
              fontSize: "0.82em",
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          background: "var(--color-app-bg)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {isMobile && (
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            style={{
              position: "fixed",
              top: 12,
              left: 12,
              zIndex: 50,
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
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
                  background: "var(--color-text)",
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
              color: "var(--color-text-muted)",
              textAlign: "center",
              padding: 24,
            }}
          >
            {projects.length === 0 ? (
              <div>
                <div style={{ fontSize: "2.5em", marginBottom: 12 }}>Mind Map</div>
                <div
                  style={{
                    fontSize: "1.1em",
                    marginBottom: 8,
                    color: "var(--color-text)",
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
                <div style={{ fontSize: "2em", marginBottom: 8 }}>Select a map</div>
                <div style={{ fontSize: "1em", color: "var(--color-text)" }}>
                  左のサイドバーからプロジェクトを選択してください
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.72)",
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
              background: "var(--color-surface-elevated)",
              border: "1px solid var(--color-border)",
              borderRadius: 12,
              padding: 28,
              width: 400,
              maxWidth: "90vw",
              boxShadow: "var(--shadow-panel)",
            }}
          >
            <h3
              style={{
                marginBottom: 16,
                fontSize: "1.1em",
                fontWeight: 700,
                color: "var(--color-text)",
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
                border: "1px solid var(--color-border-strong)",
                borderRadius: 7,
                fontSize: "0.95em",
                outline: "none",
                background: "var(--color-surface)",
                color: "var(--color-text)",
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
                  background: "var(--color-surface-muted)",
                  color: "var(--color-text)",
                  border: "1px solid var(--color-border-strong)",
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
                  background: "var(--color-primary)",
                  color: "var(--color-primary-contrast)",
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
