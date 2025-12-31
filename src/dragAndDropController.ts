import * as vscode from 'vscode';
import * as path from 'path';
import { GodotItem } from './resProvider';
import { smartMove } from './fileUtils';

export class GodotDragAndDropController implements vscode.TreeDragAndDropController<GodotItem> {
    public readonly dragMimeTypes = ['application/vnd.code.tree.gdstructure'];
    public readonly dropMimeTypes = ['application/vnd.code.tree.gdstructure'];

    constructor(private provider: { refresh: () => void }) {}

    public handleDrag(source: readonly GodotItem[], dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): void | Thenable<void> {
        const item = source[0];
        if (!item) return;

        dataTransfer.set('application/vnd.code.tree.gdstructure', new vscode.DataTransferItem(item));
    }

    public async handleDrop(target: GodotItem | undefined, dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): Promise<void> {
        const transferItem = dataTransfer.get('application/vnd.code.tree.gdstructure');
        if (!transferItem) return;

        const sourceItem = transferItem.value as GodotItem;
        if (!sourceItem) return;

        // Determine Destination
        const workspace = vscode.workspace.workspaceFolders?.[0];
        if (!workspace) return;

        let destDir = workspace.uri.fsPath; // Default to root
        if (target) {
            // If target is valid
             // If target is a directory, drop INTO it.
             // If target is a file, drop INTO its parent directory.
            if (target.isDir) {
                destDir = target.fullPath;
            } else {
                destDir = path.dirname(target.fullPath);
            }
        }

        const sourceUri = vscode.Uri.file(sourceItem.fullPath);
        const fileName = path.basename(sourceItem.fullPath);
        const destUri = vscode.Uri.file(path.join(destDir, fileName));

        // Prevent moving to self
        if (sourceUri.fsPath === destUri.fsPath) return;

        try {
            await smartMove(sourceUri, destUri, { overwrite: false });
            this.provider.refresh();
        } catch (e) {
            vscode.window.showErrorMessage(`Failed to move file: ${e}`);
        }
    }
}
