import * as vscode from 'vscode';
import * as path from 'path';
import { GodotResProvider, GodotItem } from './resProvider';
import { GodotClient } from './godotClient';
import { GodotDragAndDropController } from './dragAndDropController';
import { smartMove } from './fileUtils';

export function activate(context: vscode.ExtensionContext) {
  const provider = new GodotResProvider(context);
  const client = new GodotClient(context);

  // 1. Register Tree Data Provider
  // We use createTreeView to enable Drag & Drop
  const treeView = vscode.window.createTreeView('gdstructure', {
      treeDataProvider: provider,
      dragAndDropController: new GodotDragAndDropController(provider)
  });
  context.subscriptions.push(treeView);
  
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
            
            try {
                await smartMove(oldUri, newUri);
                provider.refresh();
            } catch (e) {
                vscode.window.showErrorMessage(`Rename failed: ${e}`);
            }
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
           provider.refresh();
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
           provider.refresh();
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
            provider.refresh();
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
            provider.refresh();
        }
    })
  );

  // 5. Clipboard Support (Global state)
  let clipboard: { op: 'copy' | 'cut', item: GodotItem } | null = null;

  context.subscriptions.push(
      vscode.commands.registerCommand('gdstructure.copy', (item: GodotItem) => {
          if (item) {
              clipboard = { op: 'copy', item };
              vscode.window.setStatusBarMessage(`Copied ${item.label}`, 3000);
          }
      }),
      vscode.commands.registerCommand('gdstructure.cut', (item: GodotItem) => {
          if (item) {
              clipboard = { op: 'cut', item };
              vscode.window.setStatusBarMessage(`Cut ${item.label}`, 3000);
          }
      }),
      vscode.commands.registerCommand('gdstructure.paste', async (target: GodotItem | undefined) => {
          if (!clipboard) {
              vscode.window.showInformationMessage('Clipboard is empty');
              return;
          }

          const workspace = vscode.workspace.workspaceFolders?.[0];
          if (!workspace) { return; }
          
          // Determine Destination Directory
          let destDir = workspace.uri.fsPath;
          if (target) {
              destDir = target.isDir ? target.fullPath : path.dirname(target.fullPath);
          } else {
              // Paste into root if no target selected (via keybinding on empty space? hard to target)
              // Actually context menu usually provides target. Keybinding passes the *selected* item.
              // If we pressed Ctrl+V with a file selected, we probably want to paste into its parent dir.
              // But 'target' argument comes from the command invocation. 
              // If invoked via keybinding, target is likely the currently selected item in tree.
          }

          const sourceUri = vscode.Uri.file(clipboard.item.fullPath);
          const fileName = path.basename(clipboard.item.fullPath);
          const destUri = vscode.Uri.file(path.join(destDir, fileName));

          if (sourceUri.fsPath === destUri.fsPath && clipboard.op === 'cut') {
              return; // Move to same place = no-op
          }

          try {
              if (clipboard.op === 'copy') {
                  // If copying to same location, auto-rename
                  let finalDestUri = destUri;
                  if (sourceUri.fsPath === destUri.fsPath) {
                       const ext = path.extname(fileName);
                       const nameBody = path.basename(fileName, ext);
                       finalDestUri = vscode.Uri.file(path.join(destDir, `${nameBody}_copy${ext}`));
                  }
                  await vscode.workspace.fs.copy(sourceUri, finalDestUri, { overwrite: false });
              } else {
                  // Cut = Move
                  await vscode.workspace.fs.rename(sourceUri, destUri, { overwrite: false });
                  clipboard = null; // Clear after cut
              }
              provider.refresh();
          } catch (e) {
              vscode.window.showErrorMessage(`Paste failed: ${e}`);
          }
      })
  );

  // 6. Auto-refresh on FS changes
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

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0];
  const pattern = workspaceRoot ? new vscode.RelativePattern(workspaceRoot, '**/*') : '**/*';
  const watcher = vscode.workspace.createFileSystemWatcher(pattern);
  context.subscriptions.push(watcher);
      
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
