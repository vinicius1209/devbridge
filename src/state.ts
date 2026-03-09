export interface UserState {
  activeProject: string | null;
}

export class StateManager {
  private state = new Map<string, UserState>();

  getActiveProject(chatId: string): string | null {
    return this.state.get(chatId)?.activeProject ?? null;
  }

  setActiveProject(chatId: string, projectName: string): void {
    const current = this.state.get(chatId) ?? { activeProject: null };
    current.activeProject = projectName;
    this.state.set(chatId, current);
  }
}
