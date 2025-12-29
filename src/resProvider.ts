import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export class GodotItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly fullPath: string,
    public readonly isDir: boolean,
    public readonly isPinned: boolean = false,
    collapsibleState?: vscode.TreeItemCollapsibleState
  ) {
    super(
      label,
      collapsibleState !== undefined ? collapsibleState : (isDir
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None)
    );

    // This enables Git decorations (S, M, U) and Error/Warning decorations
    this.resourceUri = vscode.Uri.file(fullPath);
    
    // Tooltip (Power User Feature)
    this.tooltip = fullPath;

    if (!isDir) {
      this.command = {
        command: "gdstructure.clickFile",
        title: "Open File",
        arguments: [fullPath],
      };
      
      this.contextValue = isPinned ? 'pinned-file' : 'file';

      // Icons
      // We keep custom icons for Godot types, but let VS Code handle specific media/code icons if we want.
      // Actually, standard File Icon Integration works best if we use ThemeIcon.File or just don't set iconPath?
      // If we set resourceUri, VS Code provides a default file icon based on file extension.
      // BUT we want our specific Godot icons (Scene, Script, Res).
      const ext = path.extname(label).toLowerCase();
      if (ext === '.tscn' || ext === '.scn') {
        this.iconPath = new vscode.ThemeIcon('layout-sidebar-left-off');
      } else if (ext === '.gd' || ext === '.cs') {
         // Let VS Code theme handle .cs? 
         // For consistency we keep our "script" icon for .gd
        this.iconPath = new vscode.ThemeIcon('file-code');
      } else if (ext === '.tres' || ext === '.res') {
        this.iconPath = new vscode.ThemeIcon('symbol-variable');
      } else {
        // For other files (png, svg, json), let's defer to the standard File Icon Theme if possible.
        // If we leave iconPath undefined, VS Code uses the Theme icon for the resourceUri!
        // This is BETTER than our manual mapping logic.
        // So we only override for the Godot types we care about.
      }
    } else {
      // For folders, if we don't set iconPath, it uses the Theme Folder icon.
      // VS Code Theme Folder icon corresponds to resourceUri.
      this.contextValue = 'folder';
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

  constructor(private context: vscode.ExtensionContext) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(item: GodotItem): vscode.TreeItem {
    return item;
  }

  getChildren(item?: GodotItem): GodotItem[] {
    const workspace = vscode.workspace.workspaceFolders?.[0];
    if (!workspace) { return []; }

    const rootPath = workspace.uri.fsPath;
    const config = vscode.workspace.getConfiguration('gdstructure');
    const showHidden = config.get('showGodotInternal', false);
    const sortOrder = config.get('sortOrder', 'godot');
    const userIgnore = config.get<string[]>('ignore', []);
    const ignoreRegexes = userIgnore.map(globToRegex);

    // Root Level logic
    if (!item) {
        const items: GodotItem[] = [];
        
        // 1. Favorites (Pinned) Group
        const pinned = this.getPinnedPaths();
        if (pinned.length > 0) {
            const favRoot = new GodotItem("⭐ Favorites", "", true);
            favRoot.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
            favRoot.contextValue = 'favorites-root';
            items.push(favRoot);
        }

        // 2. The actual res:// root
        items.push(new GodotItem("res://", rootPath, true));
        return items;
    }

    // Handle Favorites Group
    if (item.label === "⭐ Favorites") {
        const pinned = this.getPinnedPaths();
        return pinned.map(p => {
             // For favorites, we probably don't want nesting logic yet, just show the flat file.
             // Or do we? If a favorite is a scene, expanding it could show the script.
             // Let's treat favorites as flat files for now (isDir=false if it's a file).
             // Actually, if we pass isDir=false, it won't expand. 
             // Logic below handles normal files.
            const name = path.basename(p);
            // Check if directory
            const isDir = fs.statSync(p).isDirectory();
            return new GodotItem(name, p, isDir, true);
        });
    }

    // Normal Filesystem handling (Directory)
    if (!fs.existsSync(item.fullPath) || !fs.statSync(item.fullPath).isDirectory()) {
         return [];
    }

    try {
      return fs
        .readdirSync(item.fullPath, { withFileTypes: true })
        .filter((e) => {
          if (showHidden) { return true; }
          
          if (IGNORE_EXACT.has(e.name)) { return false; }
          if (e.name.endsWith(".import")) { return false; }
          if (e.name.endsWith(".uid")) { return false; }
          
          if (ignoreRegexes.some(r => r.test(e.name))) { return false; }

          return true;
        })
        .map(
          (e) => {
             const fullPath = path.join(item.fullPath, e.name);
             const isDir = e.isDirectory();
             return new GodotItem(e.name, fullPath, isDir);
          }
        )
        .sort((a, b) => {
          if (a.isDir !== b.isDir) {
            return a.isDir ? -1 : 1;
          }
          
          if (sortOrder === 'godot') {
            const typeA = this.getFileTypePriority(a.label);
            const typeB = this.getFileTypePriority(b.label);
            if (typeA !== typeB) {
              return typeA - typeB;
            }
          }
          
          return a.label.localeCompare(b.label);
        });
    } catch {
      return [];
    }
  }

  private getFileTypePriority(name: string): number {
    if (name.endsWith(".tscn")) { return 1; }
    if (name.endsWith(".gd")) { return 2; }
    if (name.endsWith(".tres") || name.endsWith(".res")) { return 3; }
    return 4;
  }

  // Favorites Logic
  private getPinnedPaths(): string[] {
      return this.context.workspaceState.get<string[]>('pinnedResources', []);
  }

  public async pinResource(item: GodotItem) {
      const current = this.getPinnedPaths();
      if (!current.includes(item.fullPath)) {
          await this.context.workspaceState.update('pinnedResources', [...current, item.fullPath]);
          this.refresh();
      }
  }

  public async unpinResource(item: GodotItem) {
      const current = this.getPinnedPaths();
      const newPath = current.filter(p => p !== item.fullPath);
      await this.context.workspaceState.update('pinnedResources', newPath);
      this.refresh();
  }
}
