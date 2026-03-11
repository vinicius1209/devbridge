import type { AdapterName, PermissionLevel } from '../types.js';

interface PermissionConfig {
  allowedTools: string;
  skipPermissions: boolean;
}

const CLAUDE_TOOLS: Record<PermissionLevel, PermissionConfig> = {
  readonly: {
    allowedTools: 'Read,Glob,Grep',
    skipPermissions: false,
  },
  'read-write': {
    allowedTools: 'Read,Glob,Grep,Write,Edit,MultiEdit',
    skipPermissions: true,
  },
  full: {
    allowedTools: 'Read,Glob,Grep,Write,Edit,MultiEdit,Bash,WebFetch,WebSearch,Agent,NotebookEdit',
    skipPermissions: true,
  },
};

const GEMINI_TOOLS: Record<PermissionLevel, PermissionConfig> = {
  readonly: {
    allowedTools: 'ReadFileTool,ReadManyFilesTool,GlobTool,GrepTool',
    skipPermissions: false,
  },
  'read-write': {
    allowedTools: 'ReadFileTool,ReadManyFilesTool,GlobTool,GrepTool,WriteFileTool,EditTool',
    skipPermissions: true,
  },
  full: {
    allowedTools:
      'ReadFileTool,ReadManyFilesTool,GlobTool,GrepTool,WriteFileTool,EditTool,ShellTool,WebFetchTool,WebSearchTool',
    skipPermissions: true,
  },
};

const ADAPTER_TOOLS: Record<AdapterName, Record<PermissionLevel, PermissionConfig>> = {
  claude: CLAUDE_TOOLS,
  gemini: GEMINI_TOOLS,
};

export function resolvePermissions(
  adapter: AdapterName,
  permissionLevel?: PermissionLevel,
  allowedToolsOverride?: string,
  skipPermissionsOverride?: boolean,
): PermissionConfig {
  const level = permissionLevel ?? 'readonly';
  const defaults = ADAPTER_TOOLS[adapter][level];

  return {
    allowedTools: allowedToolsOverride ?? defaults.allowedTools,
    skipPermissions: skipPermissionsOverride ?? defaults.skipPermissions,
  };
}
