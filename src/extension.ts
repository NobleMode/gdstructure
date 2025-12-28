import * as vscode from 'vscode';
import * as path from 'path';
import { GodotResProvider, GodotItem } from './resProvider';

export function activate(context: vscode.ExtensionContext) {
  const provider = new GodotResProvider();

  // 1. Register Tree Data Provider
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(
      'gdstructure',
      provider
    )
  );

  // 2. Register Manual Command (for testing/diagnostics)
  context.subscriptions.push(
    vscode.commands.registerCommand('gdstructure.helloWorld', () => {
      vscode.window.showInformationMessage('Godot Structure Active');
    })
  );

  // 3. Register Context Menu Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('gdstructure.copyResPath', (item: GodotItem) => {
        // label might be a filename, we need the full res:// path?
        // Actually GodotItem doesn't hold res:// path except implicitly (?)
        // Let's implement a helper or just construct it.
        // Wait, GodotItem label is just the name.
        // We need a way to get the res:// path.
        // Let's assume root is res://
        
        // Simpler: Just get workspace relative path and prepend res://
        const workspace = vscode.workspace.workspaceFolders?.[0];
        if (!workspace) return;
        const relative = path.relative(workspace.uri.fsPath, item.fullPath);
        const resPath = 'res://' + relative.replace(/\\/g, '/');
        vscode.env.clipboard.writeText(resPath);
    }),
    vscode.commands.registerCommand('gdstructure.revealInExplorer', (item: GodotItem) => {
        vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(item.fullPath));
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
    })
  );

  // 4. Auto-refresh on FS changes
  const watcher = vscode.workspace.createFileSystemWatcher('**/*');
  context.subscriptions.push(watcher);

  const refresh = () => provider.refresh();
  
  context.subscriptions.push(watcher.onDidCreate(refresh));
  context.subscriptions.push(watcher.onDidDelete(refresh));
  context.subscriptions.push(watcher.onDidChange(refresh));
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('gdstructure.showGodotInternal')) {
          refresh();
      }
  }));

  vscode.window.showInformationMessage('Godot Structure Active');
}

export function deactivate() {}
