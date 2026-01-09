# Sidebar Toggle Design Document

**Version:** 1.5.7
**Date:** 2026-01-08
**Status:** Research-Based Implementation

---

## Executive Summary

This document outlines a fresh approach for implementing the sidebar toggle functionality in GeForce Infinity, based on comprehensive research of modern Electron patterns (2024-2025). The solution uses Electron's built-in `before-input-event` API combined with secure IPC communication via `contextBridge`.

---

## Problem Statement

### Previous Approaches That Failed (v1.5.1 - v1.5.6)

| Version | Approach | Why It Failed |
|---------|----------|---------------|
| v1.5.1-v1.5.3 | `executeJavaScript` + CustomEvent | Security restrictions with contextIsolation |
| v1.5.4 | contextBridge callback patterns | Timing issues with iframe context |
| v1.5.5-v1.5.6 | globalShortcut with IPC | globalShortcut steals shortcuts from other apps |

### Current v1.4.0 Implementation

The current implementation uses a DOM `keydown` event listener in the overlay:

```javascript
// src/overlay/index.tsx (lines 47-55)
const handler = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === "i") {
        e.preventDefault();
        setVisible((v) => !v);
    }
};
window.addEventListener("keydown", handler);
```

**Problem:** When focus is on the GeForce NOW iframe (the game streaming area), keyboard events may not bubble to the overlay's event listener, making the sidebar toggle unreliable.

---

## Research Findings

### Sources Consulted

1. [Electron Keyboard Shortcuts Documentation](https://www.electronjs.org/docs/latest/tutorial/keyboard-shortcuts)
2. [Electron IPC Tutorial](https://www.electronjs.org/docs/latest/tutorial/ipc)
3. [Electron Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
4. [electron-localshortcut npm package](https://www.npmjs.com/package/electron-localshortcut) (reviewed but not used)
5. [VS Code Architecture Analysis](https://dev.to/ninglo/vscode-architecture-analysis-electron-project-cross-platform-best-practices-g2j)

### Key Insights

#### 1. `before-input-event` API (Recommended)

The `before-input-event` is emitted **before** dispatching `keydown` and `keyup` events in the renderer process. This means:

- It intercepts input at the main process level
- It fires regardless of which frame/iframe has focus
- It can prevent the event from reaching the page with `event.preventDefault()`

```javascript
win.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.key.toLowerCase() === 'i') {
        console.log('Pressed Control+I');
        event.preventDefault();
    }
});
```

#### 2. Avoid `globalShortcut`

> "Electron will override shortcuts of other applications... you won't be able to open the console using that shortcut, as long as the electron app is running."
> - [electron-localshortcut documentation](https://www.npmjs.com/package/electron-localshortcut)

This is why `globalShortcut` is commented out in v1.4.0.

#### 3. Secure Main-to-Renderer Communication

With `contextIsolation: true`, the proper pattern is:

**Preload Script:**
```javascript
contextBridge.exposeInMainWorld('electronAPI', {
    onSidebarToggle: (callback) => ipcRenderer.on('sidebar-toggle',
        (_event) => callback())
});
```

**Main Process:**
```javascript
mainWindow.webContents.send('sidebar-toggle');
```

**Renderer:**
```javascript
window.electronAPI.onSidebarToggle(() => {
    setVisible(v => !v);
});
```

#### 4. electron-localshortcut Status

- Last updated: 6+ years ago
- Maintenance: Inactive
- Verdict: **Avoid** due to maintenance concerns

---

## Recommended Solution

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Main Process                           │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ webContents.on('before-input-event', ...)            │   │
│  │                                                      │   │
│  │ if (Ctrl+I detected) {                               │   │
│  │     event.preventDefault();                          │   │
│  │     mainWindow.webContents.send('sidebar-toggle');   │   │
│  │ }                                                    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ IPC: 'sidebar-toggle'
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Preload Script                          │
│                                                             │
│  contextBridge.exposeInMainWorld('electronAPI', {           │
│      onSidebarToggle: (callback) =>                         │
│          ipcRenderer.on('sidebar-toggle', callback)         │
│  });                                                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ callback()
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Renderer (React)                         │
│                                                             │
│  useEffect(() => {                                          │
│      window.electronAPI?.onSidebarToggle(() => {            │
│          setVisible(v => !v);                               │
│      });                                                    │
│  }, []);                                                    │
└─────────────────────────────────────────────────────────────┘
```

### Why This Approach Works

1. **Intercepts at Main Process Level**: `before-input-event` catches keyboard input before any iframe or frame can consume it.

2. **Works with contextIsolation**: Uses secure `contextBridge` pattern, compliant with Electron security best practices.

3. **No External Dependencies**: Uses only built-in Electron APIs.

4. **Doesn't Steal Global Shortcuts**: Unlike `globalShortcut`, this only captures input when the application window has focus.

5. **Already Partially Implemented**: The preload script already exposes `onSidebarToggle` via contextBridge!

---

## Implementation Plan

### Step 1: Update Main Process (main.ts)

Add `before-input-event` listener in the `setupWindowEvents` function:

```typescript
// Add keyboard shortcut handling via before-input-event
mainWindow.webContents.on('before-input-event', (event, input) => {
    // Handle Ctrl+I (or Cmd+I on macOS) for sidebar toggle
    const isSidebarToggle =
        (input.control || input.meta) &&
        input.key.toLowerCase() === 'i';

    if (isSidebarToggle && input.type === 'keyDown') {
        console.log('[Shortcuts] Sidebar toggle triggered via before-input-event');
        mainWindow.webContents.send('sidebar-toggle');
        event.preventDefault();
    }
});
```

### Step 2: Verify Preload Script (preload.ts)

The preload script already has the correct implementation:

```typescript
// Already present at lines 57-60
onSidebarToggle: (callback: () => void) => {
    ipcRenderer.on("sidebar-toggle", (_event, ...args) => {
        callback();
    });
},
```

**Status:** No changes needed.

### Step 3: Update Overlay (index.tsx)

Add IPC-based toggle alongside the existing DOM handler:

```typescript
useEffect(() => {
    // Primary: IPC-based toggle from main process
    if (window.electronAPI?.onSidebarToggle) {
        window.electronAPI.onSidebarToggle(() => {
            setVisible((v) => !v);
        });
    }

    // Fallback: DOM event handler for direct overlay interactions
    const handler = (e: KeyboardEvent) => {
        if (e.ctrlKey && e.key === "i") {
            e.preventDefault();
            setVisible((v) => !v);
        }
    };
    window.addEventListener("keydown", handler);

    return () => window.removeEventListener("keydown", handler);
}, []);
```

### Step 4: Remove Commented globalShortcut Code

Clean up the commented `globalShortcut` code in `registerShortcuts`:

```typescript
function registerShortcuts(mainWindow: BrowserWindow) {
    // Removed: globalShortcut approach (steals shortcuts from other apps)
    // Now using before-input-event instead (see setupWindowEvents)

    if (!getConfig().informed) {
        // ... notification code ...
    }
}
```

---

## Verification Strategy

### Test Cases

| Test Case | Expected Result |
|-----------|-----------------|
| Ctrl+I when overlay is focused | Sidebar toggles |
| Ctrl+I when GeForce NOW iframe is focused | Sidebar toggles |
| Ctrl+I when any input field is focused | Sidebar toggles, input not affected |
| Rapid Ctrl+I presses | Sidebar toggles reliably without lag |
| Cmd+I on macOS | Sidebar toggles (if input.meta is supported) |

### Verification Commands

```bash
# Build the application
bun run build

# Run ESLint
bun run lint

# Start the application
bun run start

# Test: Press Ctrl+I in various contexts
# - On main page
# - While streaming a game
# - In settings dialogs
```

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| `before-input-event` might not fire in all contexts | Keep DOM handler as fallback |
| Event might fire twice (main + DOM) | Track toggle state, debounce if needed |
| macOS Cmd key handling | Test input.meta in addition to input.control |
| Performance impact | Event is lightweight, minimal overhead |

---

## Alternative Approaches Considered

### 1. Menu Accelerator

```javascript
Menu.buildFromTemplate([{
    label: 'View',
    submenu: [{
        label: 'Toggle Sidebar',
        accelerator: 'CmdOrCtrl+I',
        click: () => mainWindow.webContents.send('sidebar-toggle')
    }]
}]);
```

**Verdict:** Not used because application uses `autoHideMenuBar: true` and menu-less interface.

### 2. electron-localshortcut Package

**Verdict:** Not used due to inactive maintenance (6+ years without updates).

### 3. webContents.sendInputEvent

```javascript
webContents.sendInputEvent({ type: 'keyDown', keyCode: 'I', modifiers: ['control'] });
```

**Verdict:** This injects events rather than intercepting them - wrong direction for our use case.

---

## Conclusion

The `before-input-event` approach is the recommended solution because:

1. It's a built-in Electron API with active maintenance
2. It intercepts keyboard input at the main process level, before any iframe can consume it
3. It works with `contextIsolation: true` and `sandbox: true`
4. It doesn't steal shortcuts from other applications
5. The preload script is already correctly configured for this pattern

This approach addresses the core issue where keyboard events weren't reaching the overlay when focus was on the GeForce NOW streaming iframe.

---

## References

- [Electron Keyboard Shortcuts](https://www.electronjs.org/docs/latest/tutorial/keyboard-shortcuts)
- [Electron IPC Communication](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Electron Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
- [LogRocket: Handling IPC in Electron](https://blog.logrocket.com/handling-interprocess-communications-in-electron-applications-like-a-pro/)
- [electron-localshortcut npm](https://www.npmjs.com/package/electron-localshortcut)
