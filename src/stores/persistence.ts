import type { Project } from "../types/project";
import { createDefaultProject } from "../utils/defaults";
import { undoManager } from "./undoStore";

const STORAGE_KEY = "gcoder_data_v1";

export interface StoredData {
  currentProjectId: string;
  projects: Record<string, Project>;
  undoData?: ReturnType<typeof undoManager.serialize>;
}

export function loadStoredData(): {
  currentProject: Project;
  projects: Record<string, Project>;
} {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: StoredData = JSON.parse(raw);
      if (parsed.projects && Object.keys(parsed.projects).length > 0) {
        let active = parsed.projects[parsed.currentProjectId];
        if (!active) {
          active = Object.values(parsed.projects)[0];
        }

        if (parsed.undoData) {
          undoManager.hydrate(parsed.undoData);
        }

        return { currentProject: active, projects: parsed.projects };
      }
    }
  } catch (err) {
    console.warn("Failed to load projects from localStorage:", err);
  }

  // Default initial project
  const initial = createDefaultProject("Default Project");
  return {
    currentProject: initial,
    projects: { [initial.id]: initial },
  };
}

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

export function scheduleSave(
  currentProjectId: string,
  projects: Record<string, Project>,
) {
  if (saveTimeout) clearTimeout(saveTimeout);

  saveTimeout = setTimeout(() => {
    try {
      const data: StoredData = {
        currentProjectId,
        projects,
        undoData: undoManager.serialize(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      console.error("Failed to save project data to localStorage:", err);
    }
  }, 300);
}
