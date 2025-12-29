# Godot Project Explorer for VS Code 🤖

An advanced "Godot-Native" file explorer for Visual Studio Code. View your project exactly as you see it in the Godot Editor (cleaned, sorted, and focused), with powerful integration features.

## Features ✨

### 1. The `res://` Tree View
A dedicated **Activity Bar** icon (Godot logo) that shows your project structure:
*   **Clean**: Auto-hides `.import` files, `.godot/` folders, and build artifacts.
*   **Sorted**: Follows Godot's logic (Folders first -> Scenes -> Scripts -> Resources).
*   **Smart Icons**: Custom icons for Scenes (`.tscn`), Scripts (`.zgd`), and Resources (`.tres`).

### 2. Godot Editor Sync 🔌
Direct TCP connection to the running Godot Editor (Port 6005).
*   **Open in Godot**: Right-click any file -> `Open in Godot Editor`.
*   **Auto-Sync**: Click a file in VS Code -> It instantly highlights/focuses in the Godot FileSystem dock.
    *   *Toggle via Status Bar*: `$(sync) Sync: On/Off`.
*   **Status Bar**: `$(plug) Godot: On` indicates a live connection.

### 3. Favorites ⭐
Pin your most-used assets to the top of the tree.
*   Right-click -> `Pin to Favorites`.
*   Access them instantly from the **⭐ Favorites** group at the top.

### 4. Git & Diagnostics 🟢🔴
Full integration with VS Code's SCM and Error decoration system.
*   **Git**: Files show Green (Added), Yellow (Modified), or Red (Deleted) status.
*   **Errors**: Files with script errors are highlighted in Red/Yellow.

## Setup ⚙️

1.  Open your Godot Project folder in VS Code.
2.  The extension activates automatically when it detects `project.godot`.
3.  **For Sync**: Ensure Godot Editor is running!
    *   Godot Default Port is `6005` (Settings -> Editor -> Network -> Language Server).
    *   VS Code uses `6005` by default (Configurable).

## Configuration 🔧

| Setting | Default | Description |
| :--- | :--- | :--- |
| `gdstructure.autoSyncSelection` | `false` | Automatically select files in Godot when clicked in VS Code. |
| `gdstructure.showGodotInternal` | `false` | Show hidden files like `.import`, `.godot` folder, etc. |
| `gdstructure.sortOrder` | `godot` | Sort files like Godot (Scenes > Scripts) or simply `alphabetical`. |
| `gdstructure.ignore` | `[]` | Array of glob patterns to hide specific files/folders. |
| `gdstructure.lspPort` | `6005` | Port for connecting to the Godot Editor. |

## Troubleshooting ❓

**"Godot: Off" in Status Bar?**
*   Is Godot Open?
*   Is the Language Server enabled in Godot Editor Settings?
*   Are you using a custom port? Check `gdstructure.lspPort`.

**"WebSocket Closed" / "Handshake Timeout"?**
*   The extension uses raw TCP (Standard LSP). Ensure Godot is listening on `127.0.0.1` or `localhost`.
*   Try clicking the Status Bar item to force a reconnect.

---
*Created with ❤️ for the Godot Community.*
