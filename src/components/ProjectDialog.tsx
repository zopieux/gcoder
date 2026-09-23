import { createSignal, For, Show } from "solid-js";
import {
  createNewProject,
  currentProjectId,
  deleteProject,
  duplicateCurrentProject,
  isProjectDialogOpen,
  projects,
  renameProject,
  setIsProjectDialogOpen,
  switchProject,
} from "../stores/projectStore";
import { IconCopy, IconFolder, IconPlus, IconX } from "./Icons";

export function ProjectDialog() {
  const [newProjectName, setNewProjectName] = createSignal("");
  const [isCreating, setIsCreating] = createSignal(false);
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [editingName, setEditingName] = createSignal("");

  let lastTapTime = 0;

  const projectList = () => Object.values(projects);

  const handleCreate = (e: Event) => {
    e.preventDefault();
    const name = newProjectName().trim() || "New CNC Project";
    createNewProject(name);
    setNewProjectName("");
    setIsCreating(false);
    setIsProjectDialogOpen(false);
  };

  const handleSelect = (id: string) => {
    switchProject(id);
    setIsProjectDialogOpen(false);
  };

  const startRename = (id: string, currentName: string) => {
    setEditingId(id);
    setEditingName(currentName);
  };

  const saveRename = () => {
    const id = editingId();
    if (id) {
      const trimmed = editingName().trim();
      if (trimmed) {
        renameProject(id, trimmed);
      }
      setEditingId(null);
    }
  };

  const cancelRename = () => {
    setEditingId(null);
  };

  const handleNameTap = (id: string, name: string) => {
    const now = Date.now();
    if (now - lastTapTime < 350) {
      startRename(id, name);
      lastTapTime = 0;
    } else {
      lastTapTime = now;
    }
  };

  return (
    <Show when={isProjectDialogOpen()}>
      <div class="modal-overlay" onClick={() => setIsProjectDialogOpen(false)}>
        <div
          class="modal-card project-modal"
          onClick={(e) => e.stopPropagation()}
        >
          <div class="modal-header">
            <h3>Projects</h3>
            <button
              class="modal-close-btn"
              onClick={() => setIsProjectDialogOpen(false)}
              title="Close dialog"
            >
              <IconX size={14} />
            </button>
          </div>

          <div class="modal-body">
            <div class="project-actions-bar">
              <Show
                when={isCreating()}
                fallback={
                  <button
                    class="btn-primary"
                    onClick={() => setIsCreating(true)}
                  >
                    <IconPlus size={13} />
                    <span>Create New Project</span>
                  </button>
                }
              >
                <form class="create-project-form" onSubmit={handleCreate}>
                  <input
                    type="text"
                    class="project-input"
                    placeholder="Project Name..."
                    value={newProjectName()}
                    autofocus
                    onInput={(e) => setNewProjectName(e.currentTarget.value)}
                  />
                  <button type="submit" class="btn-primary">
                    Create
                  </button>
                  <button
                    type="button"
                    class="btn-secondary"
                    onClick={() => setIsCreating(false)}
                  >
                    Cancel
                  </button>
                </form>
              </Show>

              <button
                class="btn-secondary"
                onClick={duplicateCurrentProject}
                title="Duplicate active project"
              >
                <IconCopy size={13} />
                <span>Duplicate Current</span>
              </button>
            </div>

            <div class="projects-table-wrapper">
              <table class="projects-table">
                <thead>
                  <tr>
                    <th>Project Name</th>
                    <th>Operations</th>
                    <th>Last Modified</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <For each={projectList()}>
                    {(p) => {
                      const isCurrent = () => p.id === currentProjectId();
                      const isEditingThis = () => editingId() === p.id;

                      return (
                        <tr class={isCurrent() ? "active-row" : ""}>
                          <td class="proj-name-cell">
                            <div class="proj-name-wrapper">
                              <span class="proj-icon">
                                <IconFolder size={14} />
                              </span>

                              <Show
                                when={isEditingThis()}
                                fallback={
                                  <span
                                    class="proj-name"
                                    onClick={() => handleNameTap(p.id, p.name)}
                                    onDblClick={(e) => {
                                      e.stopPropagation();
                                      startRename(p.id, p.name);
                                    }}
                                    title="Double-click or double-tap to rename"
                                  >
                                    {p.name}
                                  </span>
                                }
                              >
                                <input
                                  type="text"
                                  class="proj-rename-inline-input"
                                  value={editingName()}
                                  autofocus
                                  onInput={(e) =>
                                    setEditingName(e.currentTarget.value)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") saveRename();
                                    else if (e.key === "Escape") cancelRename();
                                  }}
                                  onBlur={saveRename}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </Show>

                              {isCurrent() && (
                                <span class="active-badge">ACTIVE</span>
                              )}
                            </div>
                          </td>
                          <td>{p.operations.length} ops</td>
                          <td class="proj-date">
                            {new Date(p.updatedAt).toLocaleDateString()}
                          </td>
                          <td class="proj-actions">
                            <div class="proj-actions-group">
                              {!isCurrent() && (
                                <button
                                  class="btn-sm btn-primary"
                                  onClick={() => handleSelect(p.id)}
                                >
                                  Open
                                </button>
                              )}
                              {projectList().length > 1 && (
                                <button
                                  class="btn-sm btn-danger"
                                  onClick={() => {
                                    if (
                                      confirm(`Delete project "${p.name}"?`)
                                    ) {
                                      deleteProject(p.id);
                                    }
                                  }}
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    }}
                  </For>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}
