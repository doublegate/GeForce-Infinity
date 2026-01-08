# GeForce Infinity

<p align="center">
  <img src="src/assets/resources/infinity_promoimg.png" alt="Logo" />
</p>

**GeForce Infinity** is a next-generation application designed to enhance the GeForce NOW experience. Originally created to address the lack of native GeForce NOW support on Linux, this app also provides functionality for macOS and Windows users. Built with modern TypeScript, React, and Electron technologies with full ES module support, our goal is to refine the user interface and offer custom features for an improved gaming experience.

## **Screenshots**

![Screenshot](src/assets/resources/Screenshot1.png)

<p align="center">
  <img src="src/assets/resources/Screenshot3.png" width="49%">
  <img src="src/assets/resources/Screenshot4.png" width="49%">
</p>

## **Features**

- **System Diagnostics** - Comprehensive codec and GPU diagnostics panel to verify hardware acceleration support
- **Up to 120 FPS support (GFN ultimate required)**
- **4K/5K resolution support** - Full support for 3840x2160 (4K) and 5120x2880 (5K) resolutions
- **Ultrawide monitor support** - Native 3440x1440 (21:9 aspect ratio) ultrawide gaming
- **Advanced codec selection** - Choose between H.264, H.265/HEVC, and AV1 for optimal streaming quality
- **Up to 2K resolution support (GFN performance or up required)**
- **30FPS support (GFN performance or up required for some reason)**
- **720p resolution support (GFN performance or up required for some reason)**
- **Account system:** Users can now register and log in. After logging in, they are able to sync settings to and from the cloud.
- **User dropdown menu in the header.**
- **Inactivity notification:** Alerts you when you're about to be kicked due to inactivity.
- **Automute:** Mutes the game when the window is not in focus.
- **Auto refocus:** Alt-tabs you back into the game if you're unfocused when inactivity timer starts (both autofocus and inactivity notifications must be enabled).
- **Button to reset all settings to their default values.**
- **Support for smaller screens:** added scrollable areas.
- **Info tooltips added in the settings section.**
- **Enhanced UI**: GeForce Infinity aims to improve the user interface of GeForce NOW, providing a more intuitive and enjoyable experience.
- **Custom Discord Rich Presence**: Show off your gaming status with personalized Discord Rich Presence. Display game details and status updates directly in your Discord profile.
- **Instant App Switch**: Automatically switch to GeForce Infinity once your gaming rig is ready for action!
- **Notifications**: Get notified once your gaming rig is ready for action!

## 🛠️ **Planned Features**

We have several exciting features planned to further enhance your experience:

- **HDR support**
- **Surround sound support**
- **Ability to open sidebar during gameplay**
- **Account Switching**: Easily switch between different connected accounts within GeForce NOW.
- **Automatic Game Startup**: Customize which game starts automatically when the app launches.

## ⚠️ **Disclaimer**

GeForce Infinity is an independent project and is not affiliated with, sponsored by, or endorsed by Nvidia or GeForce NOW. All trademarks and logos used are the property of their respective owners. The app is provided as-is, and the developers are not responsible for any issues or damages that may arise from its use.

## 📦 **Installation**

Visit our [Release](https://github.com/doublegate/GeForce-Infinity/releases) page, where you can find newest builds of GeForce Infinity in packages like: **zip** (binary version), **deb**, **AppImage**, **rpm** and **exe**.

You can also download it from our [website](https://geforce-infinity.xyz/).

We also provide installation via **Flatpak** (hosted at Flathub) and **AUR**.

[![Get it from the AUR](src/assets/resources/aur.png)](https://aur.archlinux.org/packages?O=0&K=geforce-infinity) [![Get it from FlatHub](src/assets/resources/flathub.png)](https://flathub.org/apps/io.github.astralvixen.geforce-infinity)

## 🎮 **Usage**

Press `Ctrl+I` to open sidebar to access GeForce Infinity features.

## 💻 **How to use 4K/Ultrawide & 120 FPS streaming**

Press `Ctrl+I` to open sidebar and configure your preferred settings:

### **Resolution Settings**

- **1440p**: 2560x1440 standard QHD
- **Ultrawide**: 3440x1440 for 21:9 ultrawide monitors
- **4K**: 3840x2160 for 4K displays
- **5K**: 5120x2880 for high-end displays

### **Codec Selection**

- **Auto (Recommended)**: Automatically selects best codec for your connection
- **H.264 (Legacy)**: Wide compatibility, lower bandwidth
- **H.265/HEVC**: Better compression, improved quality
- **AV1 (4K Optimized)**: Latest codec, optimal for 4K streaming

### **Frame Rate Options**

- **30 FPS**: Standard streaming
- **60 FPS**: Smooth gaming (Performance plan or higher)
- **120 FPS**: Ultra-smooth gaming (Ultimate plan required)

**IMPORTANT**: Do **NOT** use native GeForce NOW settings for resolution and FPS. GeForce Infinity overrides these values. The native GeForce NOW interface will still show 1080p max resolution and 60 FPS, but GeForce Infinity applies your custom settings.

## **System Diagnostics**

GeForce Infinity v1.5.0 includes a comprehensive System Diagnostics panel to help verify your system's codec and hardware acceleration capabilities:

1. Press `Ctrl+I` to open the sidebar
2. Expand the "System Diagnostics" section
3. Use the tabbed interface to explore:
   - **Summary**: Quick overview of codec support and GPU information
   - **Codecs**: Detailed AV1, HEVC, H.264, VP9 support with hardware/software indicators
   - **GPU**: Hardware acceleration status, driver information, and WebGL details
   - **Platform**: System information, Electron/Chromium versions, and platform-specific features

### Diagnostics Features

- **Codec Detection**: Real-time detection of codec capabilities using WebCodecs API
- **Hardware Acceleration Status**: Visual indicators showing hardware vs software decoding
- **Platform Checks**: Automatic detection of VAAPI (Linux), HEVC Extensions (Windows), VideoToolbox (macOS)
- **Codec Testing**: Run comprehensive tests to verify codec functionality
- **Recommendations**: Platform-specific setup recommendations

For detailed platform requirements and setup instructions, see [Platform Requirements](docs/PLATFORM-REQUIREMENTS.md).

## **Technical Architecture**

GeForce Infinity is built with modern web technologies and follows best practices for cross-platform development:

- **ES Module Architecture**: Full ES module support with modern import/export syntax
- **TypeScript**: Strict type checking and modern language features
- **Electron**: Cross-platform desktop application framework with secure IPC
- **React**: Component-based UI for the overlay interface
- **Build System**: Modern build pipeline with esbuild, TypeScript compiler, and Tailwind CSS

### **Latest Release (v1.5.5) - January 2026**

**DEVELOPMENT EXPERIENCE IMPROVEMENTS** - Better developer workflow and cleaner code

- **Automatic DevTools**: DevTools now opens automatically in development mode (`!app.isPackaged`)
- **Detached Mode**: DevTools opens in detached mode for better debugging experience
- **Simplified IPC Pattern**: Streamlined sidebar toggle callback registration in preload.ts
- **Cleaner Code**: Reduced code complexity while maintaining identical functionality

### **Previous Release (v1.5.4) - January 2026**

**SIDEBAR TOGGLE FIX (FINAL FIX)** - Ctrl+I finally works correctly with proper contextBridge pattern

- **Bug Fix**: Finally fixed Ctrl+I sidebar toggle with correct contextBridge callback pattern
- **Root Cause**: With `contextIsolation: true`, preload's window is separate from page's window
- **Why Previous Fixes Failed**: CustomEvent and direct IPC approaches cannot cross the isolation boundary
- **Solution**: contextBridge callback proxy pattern - callbacks CAN be proxied across contexts
- **Technical Details**: Preload stores callback, invokes when IPC received; Electron proxies the call

### **Previous Release (v1.5.2) - January 2026**

**TECHNICAL DEBT REMEDIATION** - Major code quality and security improvements

- **Code Quality**: Fixed all 25 ESLint warnings (100% resolution)
- **Security**: Reduced vulnerabilities from 10 to 2 (80% reduction)
- **Testing**: Added Vitest framework with 8 passing tests
- **Refactoring**: Extracted network interceptor (main.ts reduced 54%)
- **CI/CD**: Added PR validation workflow for automated quality checks
- **Formatting**: Applied Prettier to 63 files for consistent code style

### **Previous Release (v1.5.0) - January 2026**

**SYSTEM DIAGNOSTICS** - Comprehensive codec and hardware verification

- **Diagnostics Module**: Complete system diagnostics for codec and GPU capability detection
- **Visual Diagnostics Panel**: Tabbed interface showing codec support, GPU info, and platform details
- **WebCodecs Integration**: Accurate codec capability detection using modern browser APIs
- **Platform-Specific Detection**: VAAPI (Linux), HEVC Extensions (Windows), VideoToolbox (macOS)
- **Hardware Acceleration Status**: Visual indicators distinguishing hardware vs software decoders
- **Documentation**: Comprehensive platform requirements guide and custom Electron build research

### **Major Breakthrough (v1.4.0) - September 2025**

**RESOLUTION OVERRIDE NOW WORKING** - The core functionality is finally here!

- **Root Cause Resolution**: Identified and solved the iframe isolation issue preventing POST request interception
- **Iframe Injection System**: Implemented comprehensive webFrameMain API integration for complete frame coverage
- **Dual-Layer Interception**: Combined webRequest API with iframe-level fetch/XHR patching for 100% coverage
- **Working Custom Resolutions**: Users can now successfully stream at 3440x1440, 4K, 120fps, and AV1 codec
- **Complete Functionality**: Resolution override system now works as originally designed
- **Enhanced Build System**: Fixed TypeScript compilation errors and npm configuration warnings
- **Technical Excellence**: Systematic debugging led to breakthrough iframe injection implementation

### **Previous Improvements (v1.3.0)**

- **ES Module Compatibility**: Complete migration to ES modules with proper directory imports and extensions
- **4K/AV1 Support**: Advanced codec selection with AV1 optimization for 4K streaming performance
- **TypeScript Modernization**: Enhanced type safety with modern import/export syntax throughout codebase
- **Repository Migration**: Complete transition from AstralVixen to doublegate GitHub account

## 🛠️ **Build**

To get started with GeForce Infinity, follow these steps:

1. Clone the repository:

   ```bash
   git clone https://github.com/doublegate/GeForce-Infinity.git
   ```

2. Navigate to the project directory:

   ```bash
   cd GeForce-Infinity
   ```

3. Install dependencies:

   ```bash
   yarn install
   ```

4. Run the application:

   ```bash
   yarn start
   ```

## **Testing**

GeForce Infinity includes a comprehensive test suite using Vitest:

```bash
# Run tests once
yarn test

# Run tests in watch mode
yarn test:watch

# Run tests with coverage report
yarn test:coverage
```

## **Contributing**

We welcome contributions from the community! For the contribution guide please see: [Contributing](CONTRIBUTING.md)

## 📜 **License**

GeForce Infinity is licensed under the [MIT License](LICENSE). See the [LICENSE](LICENSE) file for more details.

## 📫 **Contact**

For questions, feedback, or suggestions, feel free to reach out to me:

- [GitHub Issues](https://github.com/doublegate/GeForce-Infinity/issues)
- Email: [doublegate@users.noreply.github.com](mailto:doublegate@users.noreply.github.com)
- Discord: [Join my discord](https://discord.gg/p5vRgQwZ9K)
