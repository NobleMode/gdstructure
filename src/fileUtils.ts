import * as vscode from 'vscode';
import * as path from 'path';

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
    const sidecars = ['.import', '.uid'];
    
    // Helper to calculate res:// path
    const getResPath = (uri: vscode.Uri): string | null => {
        const workspace = vscode.workspace.workspaceFolders?.[0];
        if (!workspace) return null;
        const relative = path.relative(workspace.uri.fsPath, uri.fsPath);
        return 'res://' + relative.replace(/\\/g, '/');
    };

    const sourceResPath = getResPath(source);
    const destResPath = getResPath(dest);
    
    for (const ext of sidecars) {
        const sourceSidecar = vscode.Uri.file(source.fsPath + ext);
        const destSidecar = vscode.Uri.file(dest.fsPath + ext);

        try {
             const sidecarStat = await vscode.workspace.fs.stat(sourceSidecar);
             // If stat succeeds, file exists
             
             // Reset logic: Read, Patch, Write, Delete Old
             try {
                const contentBytes = await vscode.workspace.fs.readFile(sourceSidecar);
                let content = contentBytes.toString();

                // If we have valid res:// paths, patch the content
                if (sourceResPath && destResPath) {
                    // Simple string replacement might be dangerous if path is substring of another
                    // But for full paths in .import files [deps] source_file="...", it's usually safe.
                    // We simply replace all occurrences.
                    content = content.split(sourceResPath).join(destResPath);
                }

                await vscode.workspace.fs.writeFile(destSidecar, Buffer.from(content));
                await vscode.workspace.fs.delete(sourceSidecar);
                
             } catch (e) {
                console.error(`Failed to patch/move ${ext} file: ${e}`);
                // Fallback to simple rename if read/write fails
                await vscode.workspace.fs.rename(sourceSidecar, destSidecar, options);
             }
        } catch {
            // Sidecar doesn't exist, ignore
        }
    }
}
