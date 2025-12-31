import * as vscode from 'vscode';
import * as path from 'path';
import { GodotResProvider, GodotItem } from './resProvider';
import { GodotClient } from './godotClient';

export function activate(context: vscode.ExtensionContext) {
  const provider = new GodotResProvider(context);
  const client = new GodotClient(context);

  // 1. Register Tree Data Provider
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(
      'gdstructure',
      provider
    )
  );
  
  // Cleanup client on deactivate
  context.subscriptions.push(client);

  // Status Bar for Connection
  // context.subscriptions.push(client); // Handled inside client constructor
  
  // Status Bar for Sync
  const syncStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 101);
  const updateSyncStatus = () => {
      const config = vscode.workspace.getConfiguration('gdstructure');
      const autoSync = config.get('autoSyncSelection', false);
      syncStatusBar.text = autoSync ? "$(sync) Sync: On" : "$(sync-ignored) Sync: Off";
      syncStatusBar.tooltip = "Toggle Godot Selection Sync (Auto-open in Godot when clicked)";
      syncStatusBar.command = "gdstructure.toggleAutoSync";
      syncStatusBar.show();
  };
  updateSyncStatus();
  context.subscriptions.push(syncStatusBar);

  // 2. Register Manual Command (for testing/diagnostics)
  context.subscriptions.push(
    vscode.commands.registerCommand('gdstructure.helloWorld', () => {
      vscode.window.showInformationMessage('Godot Structure Active');
    }),
    vscode.commands.registerCommand('gdstructure.reconnect', () => {
        client.manualReconnect();
    }),
    vscode.commands.registerCommand('gdstructure.toggleAutoSync', async () => {
        const config = vscode.workspace.getConfiguration('gdstructure');
        const current = config.get('autoSyncSelection', false);
        await config.update('autoSyncSelection', !current, vscode.ConfigurationTarget.Global);
        updateSyncStatus();
    }),
    vscode.commands.registerCommand('gdstructure.clickFile', async (fullPath: string) => {
        // 1. Open in VS Code
        vscode.commands.executeCommand('vscode.open', vscode.Uri.file(fullPath));
        
        // 2. Sync to Godot (if enabled)
        const config = vscode.workspace.getConfiguration('gdstructure');
        if (config.get('autoSyncSelection', false)) {
            client.openFile(fullPath);
        }
    })
  );

  // 3. Register Context Menu Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('gdstructure.copyResPath', (item: GodotItem) => {
        const workspace = vscode.workspace.workspaceFolders?.[0];
        if (!workspace) { return; }
        const relative = path.relative(workspace.uri.fsPath, item.fullPath);
        const resPath = 'res://' + relative.replace(/\\/g, '/');
        vscode.env.clipboard.writeText(resPath);
    }),
    vscode.commands.registerCommand('gdstructure.revealInExplorer', (item: GodotItem) => {
        vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(item.fullPath));
    }),
    vscode.commands.registerCommand('gdstructure.openInGodot', (item: GodotItem) => {
        client.openFile(item.fullPath);
    }),
    vscode.commands.registerCommand('gdstructure.delete', async (item: GodotItem) => {
        const confirm = await vscode.window.showWarningMessage(
            `Delete ${item.label}?`,
            { modal: true },
            'Delete'
        );
        if (confirm === 'Delete') {
            await vscode.workspace.fs.delete(vscode.Uri.file(item.fullPath), { recursive: true });
        }
    }),
    vscode.commands.registerCommand('gdstructure.rename', async (item: GodotItem) => {
        const newName = await vscode.window.showInputBox({
            value: item.label,
            placeHolder: 'New Name'
        });
        if (newName) {
            const oldUri = vscode.Uri.file(item.fullPath);
            const newUri = vscode.Uri.file(path.join(path.dirname(item.fullPath), newName));
            await vscode.workspace.fs.rename(oldUri, newUri);
        }
    }),
    vscode.commands.registerCommand('gdstructure.pinResource', async (item: GodotItem) => {
        await provider.pinResource(item);
    }),
    vscode.commands.registerCommand('gdstructure.unpinResource', async (item: GodotItem) => {
        await provider.unpinResource(item);
    }),
    vscode.commands.registerCommand('gdstructure.createFolder', async (item?: GodotItem) => {
        const workspace = vscode.workspace.workspaceFolders?.[0];
        if (!workspace) { return; }
        
        let targetPath = workspace.uri.fsPath;
        if (item) {
             // If clicked on a file, create sibling. If folder, create child.
             // Actually, the 'when' clause usually limits this, but safely fallback:
            targetPath = item.isDir ? item.fullPath : path.dirname(item.fullPath);
        }

        const folderName = await vscode.window.showInputBox({
            placeHolder: 'Folder Name',
            prompt: `Create folder in ${path.basename(targetPath)}`
        });
        
        if (folderName) {
           const newUri = vscode.Uri.file(path.join(targetPath, folderName));
           await vscode.workspace.fs.createDirectory(newUri);
        }
    }),
    vscode.commands.registerCommand('gdstructure.createFile', async (item?: GodotItem) => {
        const workspace = vscode.workspace.workspaceFolders?.[0];
        if (!workspace) { return; }
        
        let targetPath = workspace.uri.fsPath;
        if (item) {
            targetPath = item.isDir ? item.fullPath : path.dirname(item.fullPath);
        }

        const fileName = await vscode.window.showInputBox({
            placeHolder: 'File Name (e.g. script.gd, shader.gdshader)',
            prompt: `Create file in ${path.basename(targetPath)}`
        });
        
        if (fileName) {
           const newUri = vscode.Uri.file(path.join(targetPath, fileName));
           let content = "";
           
           if (fileName.endsWith(".gd")) {
               content = "extends Node\n\nfunc _ready():\n\tpass\n";
           } else if (fileName.endsWith(".gdshader")) {
               content = "shader_type canvas_item;\n\nvoid fragment() {\n\t\n}\n";
           } else if (fileName.endsWith(".tscn")) {
               // Minimal valid scene
               content = '[gd_scene format=3 uid="uid://' + Math.random().toString(36).substring(2, 10) + '"]\n\n[node name="Node" type="Node"]\n';
           }

           await vscode.workspace.fs.writeFile(newUri, Buffer.from(content, 'utf8'));
           vscode.commands.executeCommand('vscode.open', newUri);
        }
    }),
    vscode.commands.registerCommand('gdstructure.duplicate', async (item: GodotItem) => {
        const workspace = vscode.workspace.workspaceFolders?.[0];
        if (!workspace) { return; }
        
        const oldName = path.basename(item.fullPath);
        const ext = path.extname(oldName);
        const nameBody = path.basename(oldName, ext);
        const defaultName = `${nameBody}_copy${ext}`;

        const newName = await vscode.window.showInputBox({
            value: defaultName,
            placeHolder: 'New Name',
            prompt: `Duplicate ${oldName} to:`
        });
        
        if (newName) {
            const oldUri = vscode.Uri.file(item.fullPath);
            const newUri = vscode.Uri.file(path.join(path.dirname(item.fullPath), newName));
            await vscode.workspace.fs.copy(oldUri, newUri);
        }
    }),
    vscode.commands.registerCommand('gdstructure.delete', async (item: GodotItem) => {
        const confirm = await vscode.window.showWarningMessage(
            `Delete ${item.label}?`,
            { modal: true },
            'Delete'
        );
        if (confirm === 'Delete') {
            await vscode.workspace.fs.delete(vscode.Uri.file(item.fullPath), { recursive: true });
        }
    })
  );

  // 4. Auto-refresh on FS changes
  const watcher = vscode.workspace.createFileSystemWatcher('**/*');
  context.subscriptions.push(watcher);
  
  let refreshTimer: NodeJS.Timeout | null = null;
  const refresh = () => {
      if (refreshTimer) {
          clearTimeout(refreshTimer);
      }
      refreshTimer = setTimeout(() => {
          provider.refresh();
          refreshTimer = null;
      }, 100);
  };
  
  context.subscriptions.push(watcher.onDidCreate(refresh));
  context.subscriptions.push(watcher.onDidDelete(refresh));
  context.subscriptions.push(watcher.onDidChange(refresh));
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('gdstructure')) {
          refresh();
          updateSyncStatus();
      }
      if (e.affectsConfiguration('gdstructure.lspPort')) {
          client.manualReconnect();
      }
  }));


  vscode.window.showInformationMessage('Godot Structure Active');
}

export function deactivate() {}
