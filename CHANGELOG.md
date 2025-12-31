# Change Log

All notable changes to the "gdstructure" extension will be documented in this file.

## [0.3.2]

- **New Feature**: Added File Creation context menus (`New File` / `New Folder`).
- **Smart Templates**: `.gd`, `.gdshader`, and `.tscn` files are created with valid boilerplate code.
- **Duplicate**: Added capability to duplicate files via right-click.
- **Improved**: File list now auto-refreshes reliably when files are created or modified.

## [0.3.1]

- **Fix**: Resolved context menu visibility issues for folders and pinned items.
- **Fix**: Updated `when` clauses to support broader selection types.

## [0.3.0] - 2025-12-29
### Added
- **Auto-Sync Selection**: Clicking files in VS Code now selects them in the Godot Editor (TCP).
- **Git & Diagnostics**: Added native SVG decorations for Git status (Green/Yellow) and Errors (Red).
- **Performance**: Added debounce to file system watchers to prevent flickering during bulk changes.
- **Documentation**: Comprehensive README with setup and configuration guides.

### Changed
- Replaced custom icon logic for generic files with VS Code's native `ThemeIcon` to support file themes.
- Updated `package.json` with new configuration (`gdstructure.autoSyncSelection`).

## [0.2.0] - 2025-12-29
### Added
- **Godot Editor Connection**: Implemented robust TCP client (Port 6005) to communicate with Godot.
- **Status Bar**: Added `Godot: On/Off` indicator with reconnection commands.
- **Commands**:
    - `Open in Godot Editor`: Right-click header/context menu.
    - `Reconnect`: Manual retry for connection.

### Fixed
- Migrated from WebSocket (WS) to raw TCP (`net`) to comply with Godot 4.x LSP standards.
- Added Content-Length header framing for LSP messages.

## [0.1.0] - 2025-12-28
### Added
- **File Operations**:
    - Rename and Delete files directly from the Godot View.
    - Copy `res://` path to clipboard.
- **Favorites System**:
    - Pin/Unpin resources to a dedicated "⭐ Favorites" group at the top.
- **Godot Sort Order**: Configuration to sort by type (Scene > Script > Resource) or alphabetically.

## [0.0.1] - 2025-12-28
### Added
- **Initial Release**:
    - Custom "Godot Files" view container in Activity Bar.
    - Filters invisible Godot files (`.import`, `.godot/`) automatically.
    - Custom icons for `.tscn`, `.gd`, and `.tres` files.