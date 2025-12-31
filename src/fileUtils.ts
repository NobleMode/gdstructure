import * as vscode from 'vscode';

/**
 * Moves a file or folder to a new location, ensuring that any associated .import file
 * (used by Godot to store UIDs and import settings) is also moved.
 * 
 * @param source The source Uri of the file/folder to move.
 * @param dest The destination Uri.
 * @param options Options for the move operation (e.g. overwrite).
 */
export async function smartMove(source: vscode.Uri, dest: vscode.Uri, options: { overwrite: boolean } = { overwrite: false }): Promise<void> {
    // 1. Move the main file/folder
    await vscode.workspace.fs.rename(source, dest, options);

    // 2. Check for sidecar files (.import and .uid)
    // - .import: Used for imported assets (Godot 3, 4)
    // - .uid: Used for scripts/text resources (Godot 4.4+)
    const sidecars = ['.import', '.uid'];
    
    for (const ext of sidecars) {
        const sourceSidecar = vscode.Uri.file(source.fsPath + ext);
        const destSidecar = vscode.Uri.file(dest.fsPath + ext);

        try {
             await vscode.workspace.fs.stat(sourceSidecar);
             // If stat succeeds, file exists
             try {
                await vscode.workspace.fs.rename(sourceSidecar, destSidecar, options);
             } catch (e) {
                console.error(`Failed to move ${ext} file: ${e}`);
             }
        } catch {
            // Sidecar doesn't exist, ignore
        }
    }
}
