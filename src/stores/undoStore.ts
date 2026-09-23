import { createSignal } from "solid-js";
import type { Project } from "../types/project";

export interface UndoSnapshot {
  timestamp: number;
  projectData: string; // JSON string of Project
  description: string;
}

const MAX_HISTORY = 100;

class UndoManager {
  private past: Record<string, UndoSnapshot[]> = {};
  private future: Record<string, UndoSnapshot[]> = {};

  // Reactive signals for active project
  public canUndoSignal = createSignal(false);
  public canRedoSignal = createSignal(false);

  public initProject(projectId: string, initialProject: Project) {
    if (!this.past[projectId]) {
      this.past[projectId] = [];
      this.future[projectId] = [];
    }
    this.updateSignals(projectId);
  }

  public recordSnapshot(
    projectId: string,
    project: Project,
    description: string,
  ) {
    if (!this.past[projectId]) {
      this.past[projectId] = [];
      this.future[projectId] = [];
    }

    const snapshot: UndoSnapshot = {
      timestamp: Date.now(),
      projectData: JSON.stringify(project),
      description,
    };

    this.past[projectId].push(snapshot);
    if (this.past[projectId].length > MAX_HISTORY) {
      this.past[projectId].shift(); // Evict oldest
    }

    // Any new action clears redo future
    this.future[projectId] = [];
    this.updateSignals(projectId);
  }

  public undo(projectId: string, currentProject: Project): Project | null {
    const history = this.past[projectId];
    if (!history || history.length === 0) return null;

    const previousSnapshot = history.pop()!;

    if (!this.future[projectId]) {
      this.future[projectId] = [];
    }

    // Save current to future
    this.future[projectId].push({
      timestamp: Date.now(),
      projectData: JSON.stringify(currentProject),
      description: previousSnapshot.description,
    });

    this.updateSignals(projectId);

    try {
      return JSON.parse(previousSnapshot.projectData) as Project;
    } catch {
      return null;
    }
  }

  public redo(projectId: string, currentProject: Project): Project | null {
    const future = this.future[projectId];
    if (!future || future.length === 0) return null;

    const nextSnapshot = future.pop()!;

    // Save current to past
    this.past[projectId].push({
      timestamp: Date.now(),
      projectData: JSON.stringify(currentProject),
      description: nextSnapshot.description,
    });

    this.updateSignals(projectId);

    try {
      return JSON.parse(nextSnapshot.projectData) as Project;
    } catch {
      return null;
    }
  }

  public updateSignals(projectId: string) {
    const [, setCanUndo] = this.canUndoSignal;
    const [, setCanRedo] = this.canRedoSignal;

    setCanUndo((this.past[projectId]?.length || 0) > 0);
    setCanRedo((this.future[projectId]?.length || 0) > 0);
  }

  public serialize(): {
    past: Record<string, UndoSnapshot[]>;
    future: Record<string, UndoSnapshot[]>;
  } {
    return {
      past: this.past,
      future: this.future,
    };
  }

  public hydrate(data?: {
    past?: Record<string, UndoSnapshot[]>;
    future?: Record<string, UndoSnapshot[]>;
  }) {
    if (data) {
      this.past = data.past || {};
      this.future = data.future || {};
    }
  }
}

export const undoManager = new UndoManager();
