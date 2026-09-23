import { createMemo, createSignal } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { type GcodeOutput, generateGcode } from "../lib/gcodeGen";
import type {
  GlobalSettings,
  Operation,
  OpType,
  Project,
} from "../types/project";
import {
  createDefaultOperation,
  createDefaultProject,
} from "../utils/defaults";
import { loadStoredData, scheduleSave } from "./persistence";
import { undoManager } from "./undoStore";

// Initialize state from localStorage
const initialData = loadStoredData();

export const [projects, setProjects] = createStore<Record<string, Project>>(
  initialData.projects,
);
export const [currentProjectId, setCurrentProjectId] = createSignal<string>(
  initialData.currentProject.id,
);

export const [selectedOpId, setSelectedOpId] = createSignal<string | null>(
  initialData.currentProject.operations[0]?.id || null,
);

export const [previewMode, setPreviewMode] = createSignal<"selected" | "full">(
  "selected",
);
export const [showToolpathsIn3D, setShowToolpathsIn3D] = createSignal(true);
export const [isSettingsOpen, setIsSettingsOpen] = createSignal(false);
export const [isProjectDialogOpen, setIsProjectDialogOpen] =
  createSignal(false);
export const [isGcodeModalOpen, setIsGcodeModalOpen] = createSignal(false);

export const currentProject = createMemo((): Project => {
  const id = currentProjectId();
  return projects[id] || Object.values(projects)[0] || createDefaultProject();
});

export const selectedOperation = createMemo((): Operation | null => {
  const proj = currentProject();
  const id = selectedOpId();
  if (!id) return proj.operations[0] || null;
  return (
    proj.operations.find((op) => op.id === id) || proj.operations[0] || null
  );
});

export const currentGcode = createMemo((): GcodeOutput => {
  const proj = currentProject();
  return generateGcode(proj);
});

// Helper to record undo before mutation
function beforeChange(description: string) {
  const proj = currentProject();
  undoManager.recordSnapshot(
    proj.id,
    JSON.parse(JSON.stringify(proj)),
    description,
  );
}

function persist() {
  const id = currentProjectId();
  scheduleSave(id, projects);
}

// ──────────────── Project Actions ────────────────

export function createNewProject(name = "New Project"): Project {
  const newProj = createDefaultProject(name);
  setProjects(newProj.id, newProj);
  setCurrentProjectId(newProj.id);
  setSelectedOpId(newProj.operations[0]?.id || null);
  undoManager.initProject(newProj.id, newProj);
  persist();
  return newProj;
}

export function switchProject(id: string) {
  if (projects[id]) {
    setCurrentProjectId(id);
    setSelectedOpId(projects[id].operations[0]?.id || null);
    undoManager.updateSignals(id);
    persist();
  }
}

export function renameProject(id: string, newName: string) {
  const trimmed = newName.trim();
  if (!trimmed || !projects[id]) return;
  beforeChange(`Rename project to "${trimmed}"`);

  setProjects(id, "name", trimmed);
  setProjects(id, "updatedAt", Date.now());
  persist();
}

export function renameCurrentProject(newName: string) {
  renameProject(currentProjectId(), newName);
}

export function deleteProject(id: string) {
  const keys = Object.keys(projects);
  if (keys.length <= 1) {
    alert("Cannot delete the only project. Create a new one first.");
    return;
  }

  const nextId = keys.find((k) => k !== id) || "";
  setProjects(id, undefined as unknown as Project);
  setCurrentProjectId(nextId);
  setSelectedOpId(projects[nextId]?.operations[0]?.id || null);
  persist();
}

export function duplicateCurrentProject() {
  const current = currentProject();
  const newId = `proj-${Date.now()}`;
  const copy: Project = {
    ...JSON.parse(JSON.stringify(current)),
    id: newId,
    name: `${current.name} (Copy)`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  setProjects(newId, copy);
  setCurrentProjectId(newId);
  setSelectedOpId(copy.operations[0]?.id || null);
  persist();
}

// ──────────────── Operation Actions ────────────────

export function addOperation(type: OpType) {
  beforeChange(`Add ${type} operation`);
  const proj = currentProject();
  const count = proj.operations.filter((o) => o.type === type).length + 1;
  const newOp = createDefaultOperation(type, count);

  setProjects(proj.id, "operations", (ops) => [...ops, newOp]);
  setProjects(proj.id, "updatedAt", Date.now());
  setSelectedOpId(newOp.id);
  persist();
}

export function updateOperation(
  opId: string,
  updates: Partial<Operation>,
  recordUndo = true,
) {
  if (recordUndo) {
    beforeChange(`Update operation`);
  }
  const proj = currentProject();
  const idx = proj.operations.findIndex((o) => o.id === opId);
  if (idx === -1) return;

  const currentOp = proj.operations[idx];
  const updatedOp = { ...currentOp, ...updates } as Operation;
  setProjects(proj.id, "operations", idx, updatedOp);
  setProjects(proj.id, "updatedAt", Date.now());
  persist();
}

export function removeOperation(opId: string) {
  beforeChange(`Delete operation`);
  const proj = currentProject();
  const nextOps = proj.operations.filter((o) => o.id !== opId);

  setProjects(proj.id, "operations", nextOps);
  setProjects(proj.id, "updatedAt", Date.now());

  if (selectedOpId() === opId) {
    setSelectedOpId(nextOps[0]?.id || null);
  }
  persist();
}

export function toggleOperation(opId: string) {
  const proj = currentProject();
  const op = proj.operations.find((o) => o.id === opId);
  if (!op) return;

  beforeChange(`${op.enabled ? "Disable" : "Enable"} ${op.name}`);
  updateOperation(opId, { enabled: !op.enabled }, false);
}

export function reorderOperations(fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex) return;
  beforeChange(`Reorder operations`);

  const proj = currentProject();
  const ops = [...proj.operations];
  const [removed] = ops.splice(fromIndex, 1);
  ops.splice(toIndex, 0, removed);

  setProjects(proj.id, "operations", ops);
  setProjects(proj.id, "updatedAt", Date.now());
  persist();
}

export function duplicateOperation(opId: string) {
  beforeChange(`Duplicate operation`);
  const proj = currentProject();
  const op = proj.operations.find((o) => o.id === opId);
  if (!op) return;

  const copy: Operation = {
    ...JSON.parse(JSON.stringify(op)),
    id: `op-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: `${op.name} (Copy)`,
  };

  const idx = proj.operations.findIndex((o) => o.id === opId);
  const nextOps = [...proj.operations];
  nextOps.splice(idx + 1, 0, copy);

  setProjects(proj.id, "operations", nextOps);
  setProjects(proj.id, "updatedAt", Date.now());
  setSelectedOpId(copy.id);
  persist();
}

// ──────────────── Settings Actions ────────────────

export function updateGlobalSettings(updates: Partial<GlobalSettings>) {
  beforeChange(`Update stock settings`);
  const proj = currentProject();
  setProjects(proj.id, "settings", (prev) => ({ ...prev, ...updates }));
  setProjects(proj.id, "updatedAt", Date.now());
  persist();
}

// ──────────────── Undo / Redo Actions ────────────────

export function performUndo() {
  const proj = currentProject();
  const restored = undoManager.undo(proj.id, JSON.parse(JSON.stringify(proj)));
  if (restored) {
    setProjects(proj.id, reconcile(restored));
    if (!restored.operations.some((o) => o.id === selectedOpId())) {
      setSelectedOpId(restored.operations[0]?.id || null);
    }
    persist();
  }
}

export function performRedo() {
  const proj = currentProject();
  const restored = undoManager.redo(proj.id, JSON.parse(JSON.stringify(proj)));
  if (restored) {
    setProjects(proj.id, reconcile(restored));
    if (!restored.operations.some((o) => o.id === selectedOpId())) {
      setSelectedOpId(restored.operations[0]?.id || null);
    }
    persist();
  }
}

export const canUndo = () => undoManager.canUndoSignal[0]();
export const canRedo = () => undoManager.canRedoSignal[0]();
