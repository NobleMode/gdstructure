import * as vscode from 'vscode';
import { GodotResProvider } from './resProvider';

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

  // 3. Auto-refresh on FS changes
  const watcher = vscode.workspace.createFileSystemWatcher('**/*');
  context.subscriptions.push(watcher);

  const refresh = () => provider.refresh();
  
  // Debounce could be added here if performance is an issue
  context.subscriptions.push(watcher.onDidCreate(refresh));
  context.subscriptions.push(watcher.onDidDelete(refresh));
  context.subscriptions.push(watcher.onDidChange(refresh));

  vscode.window.showInformationMessage('Godot Structure Active');
}

export function deactivate() {}
