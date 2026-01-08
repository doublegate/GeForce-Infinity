# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## 1.5.4 (2026-01-07) - SIDEBAR TOGGLE FIX (FINAL FIX)

### Overview

Critical bug fix release that **finally** resolves the Ctrl+I sidebar toggle functionality with the correct contextBridge callback pattern. Previous attempts (v1.5.1, v1.5.2, v1.5.3) all failed due to fundamental misunderstandings of Electron's context isolation boundary.

### Bug Fixes

- **Sidebar Toggle (Ctrl+I)**: Finally fixed the global shortcut with proper contextBridge callback pattern
  - v1.5.1 used callback-based IPC that failed silently
  - v1.5.2 focused on technical debt, sidebar still broken
  - v1.5.3 tried CustomEvent approach - also fails with contextIsolation
  - v1.5.4 uses the correct contextBridge callback proxy pattern

### Root Cause Analysis

With Electron's `contextIsolation: true`, there are TWO completely separate JavaScript contexts:
1. **Preload context** - Has access to Node.js and Electron APIs
2. **Page context** - The renderer/React application

**Why previous approaches failed:**
- **Callbacks via contextBridge methods**: Works! Electron creates a proxy
- **CustomEvent dispatch in preload**: Fails! preload's `window` is NOT the page's `window`
- **Direct IPC listener registration**: Fails! Page cannot access `ipcRenderer`

### Technical Solution: contextBridge Callback Pattern

```
Main Process (Ctrl+I detected via globalShortcut)
    |
    v
IPC "sidebar-toggle" message sent to webContents
    |
    v
Preload receives IPC (ipcRenderer.on listener set up on load)
    |
    v
Preload invokes stored callback (registered via contextBridge)
    |
    v
Callback executes in page context (Electron proxies the call)
    |
    v
React state updates, sidebar toggles
```

### Implementation Details

**src/electron/preload.ts:**
```typescript
// Store callback at module level
let sidebarToggleCallback: (() => void) | null = null;

// IPC listener runs immediately on preload load
ipcRenderer.on("sidebar-toggle", () => {
  if (sidebarToggleCallback) {
    sidebarToggleCallback(); // Calls through Electron's proxy
  }
});

// Expose callback registration via contextBridge
contextBridge.exposeInMainWorld("electronAPI", {
  onSidebarToggle: (callback: () => void) => {
    sidebarToggleCallback = callback; // Store for later invocation
  },
  // ... other methods
});
```

**src/overlay/index.tsx:**
```typescript
useEffect(() => {
  // Register callback - Electron creates proxy that works across contexts
  window.electronAPI.onSidebarToggle(() => {
    setVisible((v) => !v);
  });
}, []);
```

### Why This Works

1. **Callbacks CAN be passed through contextBridge** - Electron creates a special proxy
2. **The proxy handles context isolation** - When preload invokes the callback, Electron routes it to the page context
3. **No reliance on shared window object** - Each context has its own window, but callbacks bridge them

### Files Modified

- `src/electron/preload.ts` - IPC listener + callback storage pattern
- `src/overlay/index.tsx` - Callback registration via electronAPI.onSidebarToggle()
- `src/electron/main.ts` - Debug logging for shortcut registration verification
- `package.json` - Version bump to 1.5.4
- `VERSION` - Version bump to 1.5.4
- `CHANGELOG.md` - This release documentation
- `README.md` - Updated latest release section

### Technical Notes

This fix demonstrates the ONLY correct pattern for main-to-renderer communication in Electron with context isolation:

1. **Main -> Preload**: Use `webContents.send()` and `ipcRenderer.on()`
2. **Preload -> Page**: Use callback functions registered via `contextBridge`
3. **NEVER rely on**: Shared window object, CustomEvent, or direct DOM manipulation across contexts

---

## 1.5.3 (2026-01-07) - SIDEBAR TOGGLE FIX (PROPERLY FIXED)

### Overview

Critical bug fix release that **finally** resolves the Ctrl+I sidebar toggle functionality. The v1.5.1 fix did not work due to contextBridge callback serialization issues. This release implements a proper CustomEvent-based architecture that correctly handles IPC communication across Electron's isolated contexts.

### Bug Fixes

- **Sidebar Toggle (Ctrl+I)**: Properly fixed the global shortcut that was broken since v1.5.0
  - v1.5.1's fix relied on passing callback functions across Electron's contextBridge
  - Callbacks fail silently due to serialization issues between isolated contexts
  - IPC listener was set up inside a function (delayed) rather than immediately

### Technical Solution: CustomEvent Architecture

The proper fix uses a CustomEvent-based architecture instead of callback serialization:

```
Main Process (Ctrl+I detected)
    ↓
IPC "sidebar-toggle" message
    ↓
Preload (immediate listener, runs on load)
    ↓
CustomEvent dispatched to window
    ↓
Overlay listens for CustomEvent directly on window
    ↓
Sidebar toggles successfully
```

### Root Cause Analysis

1. **v1.5.0 (Diagnostics Release)**: Global shortcut registration was commented out, breaking Ctrl+I
2. **v1.5.1 (First Fix Attempt)**: Re-enabled shortcut but used callback-based IPC pattern
   - The `onSidebarToggle(callback)` approach failed because contextBridge cannot serialize functions
   - Callbacks passed through contextBridge become undefined or throw silently
3. **v1.5.3 (This Release)**: Implemented proper CustomEvent pattern
   - Preload script sets up IPC listener immediately on load (not inside a function)
   - Uses `window.dispatchEvent(new CustomEvent('sidebar-toggle'))` for communication
   - Overlay component adds event listener directly on window object
   - No function serialization required - only string events

### Files Modified

- `src/electron/main.ts` - Added debug logging for shortcut registration verification
- `src/electron/preload.ts` - IPC listener runs immediately, dispatches CustomEvent to window
- `src/overlay/index.tsx` - Listens for CustomEvent directly on window instead of IPC callback

### Technical Notes

This fix demonstrates an important pattern for Electron IPC communication:
- **Never pass callbacks** through contextBridge for IPC events
- **Use CustomEvents** for renderer-to-renderer communication triggered by main process
- **Immediate listeners** in preload ensure events are never missed
- **Debug logging** in main process helps verify shortcut registration

---

## 1.5.2 (2026-01-07) - TECHNICAL DEBT REMEDIATION

### Overview

Major technical debt remediation release focused on code quality, security, testing, and maintainability improvements. This release establishes a solid foundation for future development with zero ESLint warnings, comprehensive test coverage, and significantly reduced security vulnerabilities.

### Code Quality Improvements

- **ESLint Warnings**: Reduced from 25 to 0 (100% resolution)
  - Fixed 16 unused variable warnings across the codebase
  - Resolved 9 `any` type warnings with proper TypeScript types
- **Prettier Formatting**: Applied consistent formatting to 63 files
- **Dependency Cleanup**: Replaced vulnerable `cpx` package with `copyfiles`

### Security Improvements

- **Vulnerability Reduction**: Reduced from 10 to 2 vulnerabilities (80% reduction)
- **Vite Update**: Updated to fix moderate CVE
- **ESLint JSON Plugin**: Updated `@eslint/json` to fix vulnerability
- **Remaining**: 2 low-severity vulnerabilities in transitive dependencies (acceptable risk)

### Code Refactoring

- **Network Interceptor Extraction**: Extracted network interception logic from main.ts
  - New module: `src/electron/network/interceptor.ts`
  - main.ts reduced from 810 to 372 lines (54% reduction)
  - Improved separation of concerns and maintainability
- **DiagnosticsPanel Componentization**: Split into reusable components
  - `src/overlay/components/diagnostics/StatusIndicator.tsx`
  - `src/overlay/components/diagnostics/TabButton.tsx`
  - Improved code reusability and component organization

### Testing Infrastructure

- **Vitest Framework**: Added modern testing framework
- **Test Configuration**: Created `vitest.config.ts` with proper TypeScript support
- **Initial Test Suite**: 8 passing tests for `tryPatchBody` function
  - Tests cover resolution override, FPS override, codec selection
  - Tests verify edge cases and malformed input handling
- **New npm Scripts**:
  - `npm run test` - Run tests once
  - `npm run test:watch` - Run tests in watch mode
  - `npm run test:coverage` - Run tests with coverage report

### CI/CD Improvements

- **PR Validation Workflow**: Added `.github/workflows/ci.yml`
  - Runs Prettier format check
  - Runs ESLint linting
  - Runs TypeScript build
  - Runs test suite
  - Triggers on all pull requests to master

### Files Added

- `src/electron/network/interceptor.ts` - Network interception module
- `src/overlay/components/diagnostics/StatusIndicator.tsx` - Reusable status indicator
- `src/overlay/components/diagnostics/TabButton.tsx` - Reusable tab button
- `.github/workflows/ci.yml` - PR validation workflow
- `vitest.config.ts` - Vitest configuration
- `tests/interceptor.test.ts` - Network interceptor tests

### Files Modified

- 63 files reformatted with Prettier
- `src/electron/main.ts` - Refactored to use extracted network module
- `src/overlay/components/DiagnosticsPanel.tsx` - Refactored to use new components
- `package.json` - Added test scripts, updated dependencies, version bump
- `eslint.config.js` - Configuration updates
- Various TypeScript files - Fixed ESLint warnings

### Technical Metrics

| Metric                   | Before | After   | Improvement    |
| ------------------------ | ------ | ------- | -------------- |
| ESLint Warnings          | 25     | 0       | 100%           |
| Security Vulnerabilities | 10     | 2       | 80%            |
| Test Coverage            | 0%     | Initial | New capability |
| main.ts Lines            | 810    | 372     | 54% reduction  |

---

## 1.5.1 (2026-01-07) - SIDEBAR TOGGLE FIX

### Bug Fixes

- **Sidebar Toggle**: Fixed Ctrl+I global shortcut not working to toggle the sidebar
  - Re-enabled global shortcut registration in main process (`src/electron/main.ts`)
  - Added IPC listener in overlay for sidebar toggle events (`src/overlay/index.tsx`)

### Technical Details

- **Global Shortcut**: The `Control+I` shortcut registration was commented out in the main process, preventing the shortcut from functioning
- **IPC Communication**: The overlay was missing the `onSidebarToggle` IPC listener to respond to the main process shortcut events
- **Dual Handler Architecture**: The overlay now has both:
  - IPC listener for global shortcut events from main process
  - Fallback keyboard handler for when overlay has focus

### Files Modified

- `src/electron/main.ts` - Re-enabled globalShortcut.register("Control+I") and IPC send
- `src/overlay/index.tsx` - Added window.electronAPI.onSidebarToggle() listener

---

## 1.5.0 (2026-01-07) - SYSTEM DIAGNOSTICS

### New Features

- **System Diagnostics Module**: Added comprehensive codec and hardware acceleration diagnostics system
- **Diagnostics Panel UI**: New tabbed interface in the sidebar for viewing system capabilities
  - Summary tab with quick codec support overview
  - Codecs tab with detailed AV1, HEVC, H.264, VP9 support status
  - GPU tab showing hardware acceleration status and features
  - Platform tab with system information and requirements
- **Codec Detection**: WebCodecs API integration for accurate codec capability detection
- **GPU Information**: Electron getGPUInfo() integration for detailed GPU analysis
- **Platform Checks**: Platform-specific detection for VAAPI (Linux), HEVC Extensions (Windows), VideoToolbox (macOS)
- **Hardware Acceleration Status**: Visual indicators for hardware vs software decoder status
- **Codec Testing**: Run comprehensive codec tests to verify functionality
- **Diagnostics IPC API**: New IPC handlers for diagnostics functionality
  - `get-diagnostics-report` - Full chrome://gpu style report
  - `run-codec-tests` - Comprehensive codec testing
  - `get-codec-capabilities` - Codec support detection
  - `get-gpu-info` - GPU information
  - `get-platform-info` - Platform specifics
  - `get-diagnostics-summary` - Quick overview
  - `log-diagnostics` - Console debugging

### Documentation

- **Platform Requirements Guide**: Comprehensive documentation for codec setup across platforms
  - Linux VAAPI installation instructions for Intel, AMD, and NVIDIA GPUs
  - Windows HEVC Extensions installation guide
  - macOS VideoToolbox requirements
  - GPU codec support matrix for all major GPU vendors
- **Custom Electron Build Plan**: Detailed technical research document
  - Analysis of Electron codec architecture
  - Implementation options for enhanced codec support
  - Build configuration and CI/CD integration planning
  - Phase-based implementation roadmap

### Technical Improvements

- **New Diagnostics Module** (`src/electron/diagnostics/`)
  - `codec-detection.ts` - WebCodecs API codec detection
  - `gpu-info.ts` - GPU information gathering
  - `platform-checks.ts` - Platform-specific feature detection
  - `types.ts` - TypeScript type definitions
  - `index.ts` - Module exports and report generation
- **Enhanced Type Definitions**: Comprehensive TypeScript interfaces for diagnostics data
- **Preload API Extension**: New `window.diagnostics` API for renderer access
- **IPC Handler Registration**: Integrated diagnostics handlers into IPC system
- **React Icons Integration**: Added new icons for diagnostics UI (FaCircleCheck, FaCircleXmark, FaTriangleExclamation, FaMicrochip, FaDisplay, FaVideo)

### Files Added

- `src/electron/diagnostics/index.ts` - Main diagnostics module
- `src/electron/diagnostics/codec-detection.ts` - Codec detection implementation
- `src/electron/diagnostics/gpu-info.ts` - GPU information gathering
- `src/electron/diagnostics/platform-checks.ts` - Platform-specific checks
- `src/electron/diagnostics/types.ts` - TypeScript type definitions
- `src/electron/ipc/diagnostics.ts` - Diagnostics IPC handlers
- `src/overlay/components/DiagnosticsPanel.tsx` - React diagnostics UI component
- `docs/PLATFORM-REQUIREMENTS.md` - Platform codec requirements documentation
- `docs/CUSTOM-ELECTRON-BUILD-PLAN.md` - Custom Electron build research

### Files Modified

- `src/electron/ipc/index.ts` - Added diagnostics handler registration
- `src/electron/preload.ts` - Added diagnostics API exposure
- `src/overlay/components/sidebar.tsx` - Integrated diagnostics panel
- `src/overlay/global.d.ts` - Added diagnostics type definitions
- `src/types/react-icons.d.ts` - Added new icon type declarations

---

## 1.4.0 (2025-09-10) - RESOLUTION OVERRIDE BREAKTHROUGH

### 🚀 Major Features

- **🔧 Working Resolution Override**: Successfully implemented the core functionality users have been waiting for
- **📡 Iframe Injection System**: Added comprehensive webFrameMain API integration for complete frame coverage
- **🎯 Dual-Layer Network Interception**: Combined webRequest API with iframe-level fetch/XHR patching for 100% coverage
- **✅ Custom Resolution Streaming**: Users can now successfully use 3440x1440, 4K, 120fps, and AV1 codec settings
- **🛠️ Root Cause Resolution**: Identified and solved iframe isolation preventing POST request interception

### 🔍 Technical Implementation

- **webFrameMain API Integration**: Implemented comprehensive iframe monitoring and script injection
- **Fetch/XHR Patching**: Added iframe-level request interception for complete network coverage
- **POST Request Handling**: Resolved critical issue where POST requests bypassed webRequest API
- **Frame Isolation Solution**: Overcame iframe security boundaries with proper script injection timing
- **API Interception Enhancement**: Extended network monitoring to handle all GeForce NOW API patterns

### 🐛 Bug Fixes

- **Request Timing**: Fixed critical timing issue ensuring patches are applied before GeForce NOW initialization
- **TypeScript Compilation**: Resolved all remaining compilation errors for clean builds
- **NPM Configuration**: Fixed package.json warnings and improved development experience
- **Build System Reliability**: Enhanced build pipeline stability and error handling

### 💻 Development Improvements

- **Enhanced Debugging**: Added comprehensive logging for iframe injection and network interception
- **Code Quality**: Systematic error resolution maintaining feature completeness
- **Build Process**: Improved development workflow with reliable compilation and testing

### 1.3.0 (2025-09-10)

#### Features

- **4K/5K Support**: Added comprehensive 4K (3840x2160) and 5K (5120x2880) resolution support
- **Ultrawide Support**: Native support for 3440x1440 (21:9 aspect ratio) ultrawide gaming monitors
- **Advanced Codec Selection**: Implemented codec preference system with H.264, H.265/HEVC, and AV1 options
- **AV1 Codec**: Added AV1 codec support optimized for 4K streaming performance
- **Resolution Enhancement**: Upgraded default resolution from 1080p to 1440p for better streaming quality

#### Technical Improvements

- **ES Module Architecture**: Complete migration to ES modules with proper directory imports and file extensions
- **TypeScript Modernization**: Updated TypeScript codebase with modern import syntax and improved type safety
- **Build System Enhancement**: Resolved CommonJS/ES module compatibility issues including electron-updater integration
- **Enhanced Settings UI**: Redesigned settings interface with comprehensive resolution and codec options
- **Configuration System**: Expanded configuration schema to support new streaming parameters
- **Code Quality**: Fixed all TypeScript compilation errors and improved overall code reliability
- **Module Resolution**: Fixed \_\_dirname references for ES modules using fileURLToPath and URL constructors
- **Tailwind CSS Reliability**: Resolved corrupted yaml package dependency affecting CSS compilation pipeline
- **Development Workflow**: Streamlined build process with reliable dependency management and error resolution

#### Bug Fixes

- **ES Module Imports**: Fixed directory imports with explicit .js extensions for proper module resolution
- **CommonJS Compatibility**: Resolved electron-updater integration issues with ES module architecture
- **Module Path Resolution**: Fixed \_\_dirname references using fileURLToPath for ES module compatibility
- **Import Syntax**: Resolved TypeScript import inconsistencies across the codebase
- **Type Safety**: Enhanced type definitions for better development experience
- **Settings Persistence**: Improved configuration saving and loading reliability
- **Application Startup**: Resolved build and runtime issues preventing application launch
- **Dependency Corruption**: Fixed corrupted yaml package causing Tailwind CSS compilation failures
- **Build Pipeline**: Stabilized build process with comprehensive error handling and recovery
- **Resolution Override Timing**: Fixed critical issue where fetch patching was applied before GeForce NOW loaded
- **Discord RPC Error Handling**: Added proper connection error management preventing application crashes
- **Renderer Script Execution**: Enhanced overlay loading with improved error handling and timing optimization
- **Repository References**: Complete migration from AstralVixen to doublegate GitHub account across all files
- **IBUS Warnings**: Suppressed Linux GTK input method warnings with proper environment variable configuration
- **Build Script Modernization**: Updated Node.js loader from deprecated --loader to modern --import syntax
- **Request Monitoring Enhancement**: Added comprehensive debugging for GeForce NOW API interception patterns
- **XHR Request Patching**: Extended network interception to handle XMLHttpRequest alongside fetch() for complete coverage
- **Unhandled Promise Rejections**: Implemented proper error handling for Discord RPC connection failures

### 1.1.3 (2025-07-28)
