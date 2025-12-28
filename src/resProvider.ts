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
      if (label.endsWith(".tscn")) {
        this.iconPath = new vscode.ThemeIcon("symbol-event");
      } else if (label.endsWith(".gd")) {
        this.iconPath = new vscode.ThemeIcon("symbol-class");
      } else if (label.endsWith(".tres") || label.endsWith(".res")) {
        this.iconPath = new vscode.ThemeIcon("symbol-variable");
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
    const showHidden = vscode.workspace.getConfiguration('gdstructure').get('showGodotInternal', false);

    // Fake "res://" root
    if (!item) {
      return [new GodotItem("res://", rootPath, true)];
    }

    try {
      return fs
        .readdirSync(item.fullPath, { withFileTypes: true })
        .filter((e) => {
          if (showHidden) return true; // Show everything if setting is on
          if (IGNORE_EXACT.has(e.name)) return false;
          if (e.name.endsWith(".import")) return false; // Strict filtering
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
          // 1. Directories first
          if (a.isDir !== b.isDir) {
            return a.isDir ? -1 : 1;
          }
          // 2. Sort by type (Scene > Script > Resource > Other)
          const typeA = this.getFileTypePriority(a.label);
          const typeB = this.getFileTypePriority(b.label);
          if (typeA !== typeB) {
            return typeA - typeB;
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
