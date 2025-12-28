import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export class GodotItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly fullPath: string,
    public readonly isDir: boolean
  ) {
    super(
      label,
      isDir
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );

    if (!isDir) {
      this.command = {
        command: "vscode.open",
        title: "Open",
        arguments: [vscode.Uri.file(fullPath)],
      };

      // Icons
      // Icons
      const ext = path.extname(label).toLowerCase();
      if (ext === '.tscn' || ext === '.scn') {
        this.iconPath = new vscode.ThemeIcon('layout-sidebar-left-off');
      } else if (ext === '.gd' || ext === '.cs') {
        this.iconPath = new vscode.ThemeIcon('file-code');
      } else if (ext === '.tres' || ext === '.res') {
        this.iconPath = new vscode.ThemeIcon('symbol-variable');
      } else if (['.png', '.svg', '.jpg', '.jpeg', '.bmp', '.tga', '.webp'].includes(ext)) {
        this.iconPath = new vscode.ThemeIcon('file-media');
      } else if (['.wav', '.ogg', '.mp3'].includes(ext)) {
        this.iconPath = new vscode.ThemeIcon('radio-tower');
      } else if (['.txt', '.md', '.json', '.cfg', '.ini'].includes(ext)) {
        this.iconPath = new vscode.ThemeIcon('file-text');
      } else {
        this.iconPath = vscode.ThemeIcon.File;
      }
    } else {
      this.iconPath = vscode.ThemeIcon.Folder;
    }
  }
}

// Godot noise we don't want to see
const IGNORE_EXACT = new Set([
  ".godot",
  ".godot_ide",
  ".vscode",
  ".idea",
  ".git",
  ".vs",
  "node_modules",
]);

// Helper to convert simple glob to regex
function globToRegex(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const pattern = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${pattern}$`);
}

export class GodotResProvider implements vscode.TreeDataProvider<GodotItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    GodotItem | undefined | null | void
  > = new vscode.EventEmitter<GodotItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    GodotItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(item: GodotItem): vscode.TreeItem {
    return item;
  }

  getChildren(item?: GodotItem): GodotItem[] {
    const workspace = vscode.workspace.workspaceFolders?.[0];
    if (!workspace) return [];

    const rootPath = workspace.uri.fsPath;
    const config = vscode.workspace.getConfiguration('gdstructure');
    const showHidden = config.get('showGodotInternal', false);
    const sortOrder = config.get('sortOrder', 'godot');
    const userIgnore = config.get<string[]>('ignore', []);
    
    // Convert user ignore globs to regex
    const ignoreRegexes = userIgnore.map(globToRegex);

    // Fake "res://" root
    if (!item) {
      return [new GodotItem("res://", rootPath, true)];
    }

    try {
      return fs
        .readdirSync(item.fullPath, { withFileTypes: true })
        .filter((e) => {
          if (showHidden) return true; // Show everything if setting is on
          
          // Check standard ignores
          if (IGNORE_EXACT.has(e.name)) return false;
          if (e.name.endsWith(".import")) return false; 
          if (e.name.endsWith(".uid")) return false; // Strict filtering
          
          // Check user ignores
          if (ignoreRegexes.some(r => r.test(e.name))) return false;

          return true;
        })
        .map(
          (e) =>
            new GodotItem(
              e.name,
              path.join(item.fullPath, e.name),
              e.isDirectory()
            )
        )
        .sort((a, b) => {
          // 1. Directories first (always)
          if (a.isDir !== b.isDir) {
            return a.isDir ? -1 : 1;
          }
          
          // 2. Sort Order Strategy
          if (sortOrder === 'godot') {
            const typeA = this.getFileTypePriority(a.label);
            const typeB = this.getFileTypePriority(b.label);
            if (typeA !== typeB) {
              return typeA - typeB;
            }
          }
          
          // 3. Alphabetical
          return a.label.localeCompare(b.label);
        });
    } catch {
      return [];
    }
  }

  private getFileTypePriority(name: string): number {
    if (name.endsWith(".tscn")) return 1;
    if (name.endsWith(".gd")) return 2;
    if (name.endsWith(".tres") || name.endsWith(".res")) return 3;
    return 4;
  }
}
