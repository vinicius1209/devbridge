import { describe, it, expect, beforeEach } from 'vitest';
import { StateManager } from '../../src/state.js';

describe('StateManager', () => {
  let stateManager: StateManager;

  beforeEach(() => {
    stateManager = new StateManager();
  });

  it('should return null for unknown chat ID', () => {
    expect(stateManager.getActiveProject('unknown-id')).toBeNull();
  });

  it('should set and get active project', () => {
    stateManager.setActiveProject('12345', 'my-project');
    expect(stateManager.getActiveProject('12345')).toBe('my-project');
  });

  it('should overwrite active project', () => {
    stateManager.setActiveProject('12345', 'project-a');
    stateManager.setActiveProject('12345', 'project-b');
    expect(stateManager.getActiveProject('12345')).toBe('project-b');
  });

  it('should handle multiple users independently', () => {
    stateManager.setActiveProject('user1', 'project-a');
    stateManager.setActiveProject('user2', 'project-b');

    expect(stateManager.getActiveProject('user1')).toBe('project-a');
    expect(stateManager.getActiveProject('user2')).toBe('project-b');
  });

  it('should return null for chat ID that was never set', () => {
    stateManager.setActiveProject('user1', 'project-a');
    expect(stateManager.getActiveProject('user2')).toBeNull();
  });
});
