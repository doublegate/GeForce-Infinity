# Custom Electron Build Plan for GeForce Infinity

**Document Version:** 1.0.0
**Created:** January 2026
**Project:** GeForce Infinity v1.4.0+
**Current Electron:** 37.2.0 (Chromium 138.0.7204.35)

---

## Executive Summary

This document outlines the research, analysis, and implementation plan for building a custom Electron distribution with enhanced codec support for GeForce Infinity. The goal is to ensure full utilization of AV1, HEVC, and other codecs for optimal GeForce NOW streaming at high resolutions (3440x1440, 4K, 5K+) and frame rates (120fps+).

### Key Findings

1. **AV1 is already supported** in standard Electron/Chromium builds - it's an open, royalty-free codec included by default since Chrome 69
2. **HEVC hardware decoding** is integrated in Electron >= v22.0.0 for macOS, Windows, and Linux (VAAPI)
3. **HEVC hardware encoding** is integrated in Electron >= v33.0.0 for macOS and Windows
4. **GeForce NOW uses multiple codecs**: H.264 (1080p and below), HEVC (1440p+), and AV1 (Ultimate tier with compatible hardware)
5. **The current GeForce Infinity implementation** already has proper hardware acceleration flags enabled
6. **Custom Electron builds** are primarily needed for software HEVC/AC3/E-AC3 decoding, not AV1

### Recommendation

**Option 2 (Enhanced Hardware Acceleration Configuration)** is recommended as the primary approach, with **Option 3 (FFmpeg Library Replacement)** as a fallback for edge cases. A full custom Electron build (Option 1) is only necessary for proprietary codec software decoding (HEVC, AC3, E-AC3) and carries significant maintenance burden.

---

## Current State Analysis

### GeForce Infinity v1.4.0 Architecture

```
Electron 37.2.0
├── Chromium 138.0.7204.35
│   ├── FFmpeg (shared library)
│   │   ├── AV1 (dav1d/libgav1) ✅ Included
│   │   ├── VP8/VP9 ✅ Included
│   │   ├── H.264/AVC ✅ Included (proprietary_codecs=true by default)
│   │   ├── HEVC/H.265 ⚠️ HW only (SW decode requires patches)
│   │   └── AC3/E-AC3 ❌ Not included
│   └── Hardware Decoders
│       ├── VAAPI (Linux) ✅ Enabled via flags
│       ├── DXVA/D3D11 (Windows) ✅ Native
│       └── VideoToolbox (macOS) ✅ Native
├── V8 13.8
└── Node.js 22.16.0
```

### Current Hardware Acceleration Flags (main.ts)

The application already configures these Chromium flags:

```typescript
// Currently enabled in GeForce Infinity
app.commandLine.appendSwitch("enable-media-stream");
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-accelerated-video");
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
app.commandLine.appendSwitch("enable-native-gpu-memory-buffers");
app.commandLine.appendSwitch("enable-gpu-memory-buffer-video-frames");
app.commandLine.appendSwitch("enable-accelerated-video-decode");
app.commandLine.appendSwitch("enable-hardware-overlays");
app.commandLine.appendSwitch(
  "disable-features",
  "UseChromeOSDirectVideoDecoder",
);
app.commandLine.appendSwitch(
  "enable-features",
  [
    "WaylandWindowDecorations",
    "AcceleratedVideoDecodeLinuxGL",
    "VaapiVideoDecoder",
    "AcceleratedVideoDecodeLinuxZeroCopyGL",
    "VaapiIgnoreDriverChecks",
    "Av1Decoder",
    "VaapiAV1Decoder",
    "GlobalVaapiLock",
    "PlatformHEVCDecoderSupport",
  ].join(","),
);
```

### What's Needed vs What's Available

| Codec      | GeForce NOW Usage | Electron 37 Status | Action Needed              |
| ---------- | ----------------- | ------------------ | -------------------------- |
| H.264/AVC  | 1200p and below   | Included           | None                       |
| HEVC/H.265 | 1440p+            | HW decode only     | SW decode requires patches |
| AV1        | Ultimate tier, 4K | Included (HW+SW)   | Verify HW acceleration     |
| VP9        | Fallback          | Included           | None                       |
| Opus       | Audio             | Included           | None                       |

---

## Technical Research Findings

### Electron Codec Architecture

Electron uses Chromium's media stack, which relies on FFmpeg for software decoding and platform-specific APIs for hardware acceleration:

```
Video Playback Pipeline
├── Media Element / WebRTC Stream
├── Demuxer (FFmpeg)
├── Decoder Selection
│   ├── Hardware Path (preferred)
│   │   ├── Windows: DXVA2 / D3D11VA
│   │   ├── Linux: VAAPI / VDPAU
│   │   └── macOS: VideoToolbox
│   └── Software Path (fallback)
│       └── FFmpeg Decoders (dav1d, libaom, libvpx, etc.)
└── Renderer
```

**Key Architecture Points:**

1. FFmpeg is compiled as a shared library (libffmpeg.so/dylib/dll)
2. The `proprietary_codecs=true` flag enables H.264/AAC in the default build
3. HEVC software decoding requires additional FFmpeg patches
4. AV1 uses dav1d (software) or hardware decoders (VAAPI/DXVA/VideoToolbox)
5. Hardware decoders bypass FFmpeg entirely

### AV1 Support Analysis

**AV1 is fully supported in standard Electron builds:**

- **Software Decoder:** libgav1 (Chromium's native implementation) and dav1d
- **Hardware Decoder:** Supported via VAAPI (Linux), DXVA (Windows), VideoToolbox (macOS)
- **WebRTC Encoder:** libaom v3.6.0+ included since Chrome 113

**Hardware AV1 Decode Support:**

| Vendor | GPU Generation               | AV1 Decode | AV1 Encode         |
| ------ | ---------------------------- | ---------- | ------------------ |
| Intel  | Arc A-series, 11th Gen+ iGPU | Yes        | Yes (Arc only)     |
| NVIDIA | RTX 30 series+               | Yes        | Yes (RTX 40 only)  |
| AMD    | RX 6000 series+              | Yes        | Yes (RX 7000 only) |
| Apple  | M1 and newer                 | Yes        | No                 |

**AV1 is NOT the issue** - it's already included by default. The limiting factor is typically:

1. GeForce NOW account tier (Ultimate required for AV1)
2. Client device hardware (must support AV1 decode)
3. GeForce NOW server-side encoding decisions

### HEVC/H.265 Support Analysis

HEVC has a more complex situation due to patent licensing:

**Hardware Decoding (Available in Electron 22+):**

- Windows: Requires HEVC Video Extensions from Microsoft Store (or free from manufacturer)
- Linux: VAAPI only (Intel, AMD with proper drivers)
- macOS: VideoToolbox (Big Sur 11.0+)

**Software Decoding (NOT available by default):**

- Requires custom FFmpeg build with HEVC decoder patches
- Legal gray area due to MPEG-LA licensing
- Available via electron-chromium-codecs patches

**HEVC Hardware Encoding (Available in Electron 33+):**

- Windows and macOS only
- Via WebCodecs, WebRTC, and MediaRecorder APIs

### GeForce NOW Streaming Protocol

GeForce NOW uses a WebRTC-based streaming protocol with the following characteristics:

1. **Codec Selection by Resolution:**
   - 1080p and below: H.264/AVC
   - 1440p and above: HEVC (H.265)
   - 4K with Ultimate tier: AV1 (when client supports it)

2. **Client Requirements for AV1:**
   - Ultimate tier subscription
   - AV1 hardware decode capable device
   - Currently Windows-focused (expanding to other platforms)

3. **Transcoding Behavior:**
   - Non-Shield devices: HEVC may be transcoded to AVC locally
   - This affects quality but maintains compatibility

---

## Implementation Options

### Option 1: Custom Electron Build from Source

Build Electron from source with modified FFmpeg configuration.

**When to Use:**

- Need software HEVC decoding (rare for streaming)
- Need AC3/E-AC3 audio codec support
- Want complete control over media stack

**Pros:**

- Full control over all codecs and configurations
- Can enable any combination of codecs
- Can optimize for specific use cases

**Cons:**

- Extremely complex build process (4-8 hours build time)
- Requires 50-100GB disk space
- Significant maintenance burden (must rebuild for each Electron update)
- Legal considerations for proprietary codecs
- Requires infrastructure for multi-platform builds

**Build Requirements:**

| Platform | Tools Required                     | Disk Space | Build Time |
| -------- | ---------------------------------- | ---------- | ---------- |
| Linux    | depot_tools, clang, ninja, python3 | 100GB+     | 4-8 hours  |
| Windows  | VS 2022, Windows SDK, depot_tools  | 100GB+     | 6-10 hours |
| macOS    | Xcode 14+, depot_tools             | 80GB+      | 4-8 hours  |

**Build Configuration (GN args):**

```gn
# release.gn for full codec support
import("//electron/build/args/release.gn")

is_component_build = false
is_official_build = true
is_debug = false
ffmpeg_branding = "Chrome"
proprietary_codecs = true
enable_hevc_parser_and_hw_decoder = true
media_use_ffmpeg = true

# For HEVC software decoding (requires patches)
enable_platform_hevc = true
```

**Estimated Effort:** 40-80 hours initial setup, 4-8 hours per update

---

### Option 2: Enhanced Hardware Acceleration Configuration (Recommended)

Optimize the existing Electron installation with comprehensive hardware acceleration flags.

**When to Use:**

- AV1 and HEVC hardware decoding are sufficient
- Want to avoid custom build complexity
- Using modern GPUs with codec support

**Pros:**

- No custom builds required
- Works with standard Electron releases
- Easy to maintain and update
- Immediate implementation

**Cons:**

- Limited to hardware-supported codecs
- Software fallback may not be optimal
- Platform-specific behavior differences

**Enhanced Configuration:**

```typescript
// Enhanced hardware acceleration for GeForce Infinity
// Add these to main.ts app.commandLine switches

// Core acceleration
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
app.commandLine.appendSwitch("enable-accelerated-video-decode");
app.commandLine.appendSwitch("enable-accelerated-video-encode");
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-native-gpu-memory-buffers");
app.commandLine.appendSwitch("enable-gpu-memory-buffer-video-frames");

// Enhanced features for modern codecs
app.commandLine.appendSwitch(
  "enable-features",
  [
    // AV1 Support
    "Av1Decoder",
    "VaapiAV1Decoder",
    "D3D11VideoDecodeAcceleration",

    // HEVC Support
    "PlatformHEVCDecoderSupport",
    "PlatformHEVCEncoderSupport",
    "VaapiVideoDecoder",
    "VaapiVideoEncoder",

    // General acceleration
    "AcceleratedVideoDecodeLinuxGL",
    "AcceleratedVideoDecodeLinuxZeroCopyGL",
    "VaapiIgnoreDriverChecks",
    "GlobalVaapiLock",
    "UseSkiaRenderer",

    // WebRTC optimizations
    "WebRtcHideLocalIpsWithMdns",
    "WebRtcUseEchoCanceller3",

    // Platform-specific
    "WaylandWindowDecorations", // Linux Wayland
  ].join(","),
);

// Disable problematic features
app.commandLine.appendSwitch(
  "disable-features",
  [
    "UseChromeOSDirectVideoDecoder",
    "MediaFoundationD3D11VideoCapture", // Can cause issues
  ].join(","),
);

// Linux-specific VAAPI configuration
if (process.platform === "linux") {
  app.commandLine.appendSwitch("use-gl", "egl");
  app.commandLine.appendSwitch("enable-features", "VaapiOnNvidiaGPUs");
  // For NVIDIA proprietary drivers
  // Requires: libva-nvidia-driver package
}

// Windows-specific D3D11 configuration
if (process.platform === "win32") {
  app.commandLine.appendSwitch("enable-d3d11-video-decoder");
  app.commandLine.appendSwitch("enable-dawn-features", "allow_unsafe_apis");
}
```

**Estimated Effort:** 2-4 hours implementation, minimal maintenance

---

### Option 3: FFmpeg Library Replacement

Replace the bundled FFmpeg library with a custom-compiled version.

**When to Use:**

- Need specific codec support without full Electron rebuild
- Want to add HEVC software decoding as fallback
- Have existing FFmpeg build infrastructure

**Pros:**

- Easier than full Electron build
- Can be automated in build pipeline
- Only need to maintain FFmpeg, not entire Chromium

**Cons:**

- May cause compatibility issues
- Must match Electron's FFmpeg ABI
- Platform-specific library locations
- electron-builder may override replacements

**Implementation:**

```javascript
// afterPack hook for electron-builder (package.json)
{
  "build": {
    "afterPack": "./scripts/replace-ffmpeg.js"
  }
}

// scripts/replace-ffmpeg.js
const path = require('path');
const fs = require('fs');

exports.default = async function(context) {
    const platform = context.electronPlatformName;
    const appOutDir = context.appOutDir;

    const ffmpegPaths = {
        linux: path.join(appOutDir, 'libffmpeg.so'),
        win32: path.join(appOutDir, 'ffmpeg.dll'),
        darwin: path.join(appOutDir, 'Frameworks',
                         'Electron Framework.framework',
                         'Libraries', 'libffmpeg.dylib')
    };

    const customFfmpeg = path.join(__dirname,
                                   `ffmpeg-custom-${platform}`,
                                   path.basename(ffmpegPaths[platform]));

    if (fs.existsSync(customFfmpeg)) {
        fs.copyFileSync(customFfmpeg, ffmpegPaths[platform]);
        console.log(`Replaced FFmpeg for ${platform}`);
    }
};
```

**Building Custom FFmpeg:**

```bash
# Clone FFmpeg
git clone https://git.ffmpeg.org/ffmpeg.git
cd ffmpeg

# Configure with HEVC support
./configure \
    --enable-shared \
    --disable-static \
    --enable-gpl \
    --enable-libx264 \
    --enable-libx265 \
    --enable-libdav1d \
    --enable-libsvtav1 \
    --enable-vaapi \
    --enable-vdpau \
    --disable-doc \
    --disable-programs

# Build
make -j$(nproc)
```

**Estimated Effort:** 8-16 hours initial setup, 2-4 hours per update

---

### Option 4: Community Electron Builds (Alternative)

Use pre-built Electron distributions with extended codec support.

**Potential Sources:**

- electron-chromium-codecs patches (community maintained)
- Electron releases with custom FFmpeg (rare)
- Flatpak/Snap packages with codec support

**Pros:**

- No build infrastructure required
- Community maintenance
- Quick to implement

**Cons:**

- Dependency on external maintainers
- May lag behind official Electron releases
- Security update delays
- Limited control over configuration

**Not recommended** for production applications due to supply chain concerns.

---

## Recommended Approach

### Primary Strategy: Option 2 (Enhanced Hardware Acceleration)

The current GeForce Infinity setup already has most hardware acceleration flags configured correctly. The focus should be on:

1. **Verification and Optimization**
   - Verify hardware acceleration is working via `chrome://gpu`
   - Ensure AV1 and HEVC hardware decoders are active
   - Test on target platforms (Linux, Windows, macOS)

2. **Platform-Specific Tuning**
   - Linux: Ensure VAAPI/VDPAU drivers are configured
   - Windows: Verify D3D11 video decoder activation
   - macOS: Confirm VideoToolbox integration

3. **Runtime Detection**
   - Add diagnostics to detect active decoders
   - Log codec selection for debugging
   - Provide user feedback on codec support

### Secondary Strategy: Option 3 (FFmpeg Replacement)

If users report issues with specific codec scenarios:

1. Build custom FFmpeg with HEVC software decoder
2. Implement afterPack hook for library replacement
3. Test across all platforms

### Fallback Strategy: Option 1 (Custom Build)

Only pursue if:

- Critical feature requires it
- Resources available for ongoing maintenance
- Legal counsel approves codec licensing

---

## Implementation Roadmap

### Phase 1: Verification and Diagnostics (Week 1-2)

**Goal:** Confirm current codec support and identify gaps

- [ ] Add codec detection diagnostics to GeForce Infinity
- [ ] Create `chrome://gpu` style report accessible to users
- [ ] Test AV1 playback with various GPU configurations
- [ ] Test HEVC hardware decoding on all platforms
- [ ] Document platform-specific requirements

**Diagnostic Code Addition:**

```typescript
// Add to main.ts or new diagnostics module
async function getCodecCapabilities(webContents: WebContents): Promise<object> {
  return webContents.executeJavaScript(`
        (async () => {
            const codecs = {
                av1: {
                    decode: await VideoDecoder?.isConfigSupported?.({
                        codec: 'av01.0.08M.08',
                        width: 3840,
                        height: 2160,
                    }).then(r => r.supported).catch(() => false),
                    hardware: navigator.gpu ? true : undefined
                },
                hevc: {
                    decode: await VideoDecoder?.isConfigSupported?.({
                        codec: 'hvc1.1.6.L153.B0',
                        width: 3840,
                        height: 2160,
                    }).then(r => r.supported).catch(() => false),
                },
                h264: {
                    decode: await VideoDecoder?.isConfigSupported?.({
                        codec: 'avc1.640028',
                        width: 1920,
                        height: 1080,
                    }).then(r => r.supported).catch(() => false),
                }
            };
            return codecs;
        })()
    `);
}
```

### Phase 2: Configuration Optimization (Week 3-4)

**Goal:** Optimize hardware acceleration for all platforms

- [ ] Update Chromium flags based on testing results
- [ ] Add platform-specific optimizations
- [ ] Implement GPU feature detection
- [ ] Create fallback configurations for older hardware

**Platform Configuration Matrix:**

| Platform       | Configuration                                 |
| -------------- | --------------------------------------------- |
| Linux (Intel)  | VAAPI with iHD driver                         |
| Linux (AMD)    | VAAPI with radeonsi driver                    |
| Linux (NVIDIA) | VAAPI with nvidia-vaapi-driver (experimental) |
| Windows        | D3D11 Video Decoder (native)                  |
| macOS          | VideoToolbox (native)                         |

### Phase 3: FFmpeg Replacement Pipeline (Week 5-8, if needed)

**Goal:** Establish FFmpeg replacement capability for edge cases

- [ ] Set up FFmpeg build infrastructure
- [ ] Create platform-specific build scripts
- [ ] Implement afterPack hook for electron-builder
- [ ] Test compatibility with Electron 37+
- [ ] Document build and replacement process

### Phase 4: Custom Electron Build (Optional, Week 9+)

**Goal:** Full custom Electron capability (only if required)

- [ ] Set up depot_tools and build environment
- [ ] Create reproducible build scripts
- [ ] Implement CI/CD pipeline for multi-platform builds
- [ ] Test and validate custom builds
- [ ] Document maintenance procedures

---

## Build Configuration

### Prerequisites

**All Platforms:**

- Node.js 20+ (LTS)
- Python 3.9+
- Git

**Linux (Ubuntu 22.04+):**

```bash
sudo apt-get install build-essential clang libdbus-1-dev libgtk-3-dev \
    libnotify-dev libasound2-dev libcap-dev libcups2-dev libxtst-dev \
    libxss1 libnss3-dev gcc-multilib g++-multilib curl gperf bison \
    python3-dbusmock

# For VAAPI development
sudo apt-get install libva-dev libva-drm2 libva-x11-2 vainfo

# depot_tools
git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git
export PATH="$PATH:$(pwd)/depot_tools"
```

**Windows:**

- Visual Studio 2022 with C++ workload
- Windows 10/11 SDK
- Debugging Tools for Windows

```powershell
# Set environment variable
[System.Environment]::SetEnvironmentVariable("DEPOT_TOOLS_WIN_TOOLCHAIN", "0", "User")
```

**macOS:**

- Xcode 14+ with Command Line Tools
- macOS 12.0+ (Monterey)

### Build Commands

**Custom Electron Build (Option 1):**

```bash
# Clone and sync
mkdir electron-build && cd electron-build
gclient config --name "src/electron" --unmanaged https://github.com/electron/electron
gclient sync --with_branch_heads --with_tags

# Checkout specific version
cd src/electron
git checkout v37.2.0
cd ..

# Set build tools path
export CHROMIUM_BUILDTOOLS_PATH=$(pwd)/buildtools

# Generate build configuration
gn gen out/Release --args='
    import("//electron/build/args/release.gn")
    is_component_build = false
    is_official_build = true
    is_debug = false
    ffmpeg_branding = "Chrome"
    proprietary_codecs = true
    enable_hevc_parser_and_hw_decoder = true
'

# Build
ninja -C out/Release electron

# Create distribution
ninja -C out/Release electron:electron_dist_zip
```

**FFmpeg Custom Build (Option 3):**

```bash
# Linux example
git clone https://git.ffmpeg.org/ffmpeg.git ffmpeg-custom
cd ffmpeg-custom

./configure \
    --prefix=$(pwd)/build \
    --enable-shared \
    --disable-static \
    --enable-gpl \
    --enable-libx265 \
    --enable-libdav1d \
    --enable-vaapi \
    --disable-doc \
    --disable-programs \
    --disable-debug

make -j$(nproc)
make install

# The library will be in build/lib/libavcodec.so.* etc.
```

### CI/CD Integration

**GitHub Actions Workflow for Custom Builds:**

```yaml
name: Custom Electron Build

on:
  workflow_dispatch:
    inputs:
      electron_version:
        description: "Electron version to build"
        required: true
        default: "v37.2.0"

jobs:
  build:
    strategy:
      matrix:
        os: [ubuntu-22.04, windows-2022, macos-13]

    runs-on: ${{ matrix.os }}

    steps:
      - name: Setup depot_tools
        run: |
          git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git
          echo "$(pwd)/depot_tools" >> $GITHUB_PATH

      - name: Sync Electron
        run: |
          mkdir electron && cd electron
          gclient config --name "src/electron" --unmanaged https://github.com/electron/electron
          gclient sync --with_branch_heads --with_tags
          cd src/electron && git checkout ${{ github.event.inputs.electron_version }}

      - name: Build Electron
        run: |
          cd electron/src
          export CHROMIUM_BUILDTOOLS_PATH=$(pwd)/buildtools
          gn gen out/Release --args='import("//electron/build/args/release.gn") ffmpeg_branding="Chrome" proprietary_codecs=true'
          ninja -C out/Release electron:electron_dist_zip

      - name: Upload Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: electron-custom-${{ matrix.os }}
          path: electron/src/out/Release/dist.zip
```

---

## Testing and Validation

### Codec Support Verification

**Browser-based Test:**

```javascript
// Test in DevTools console or inject via preload
async function testCodecSupport() {
  const tests = [
    { name: "AV1 (4K)", codec: "av01.0.08M.08", width: 3840, height: 2160 },
    { name: "AV1 (1080p)", codec: "av01.0.04M.08", width: 1920, height: 1080 },
    { name: "HEVC (4K)", codec: "hvc1.1.6.L153.B0", width: 3840, height: 2160 },
    {
      name: "HEVC (1080p)",
      codec: "hvc1.1.6.L93.B0",
      width: 1920,
      height: 1080,
    },
    { name: "H.264 (1080p)", codec: "avc1.640028", width: 1920, height: 1080 },
    { name: "VP9 (4K)", codec: "vp09.00.50.08", width: 3840, height: 2160 },
  ];

  console.log("=== Codec Support Test ===");
  for (const test of tests) {
    try {
      const result = await VideoDecoder.isConfigSupported({
        codec: test.codec,
        width: test.width,
        height: test.height,
      });
      console.log(
        `${test.name}: ${result.supported ? "SUPPORTED" : "NOT SUPPORTED"}`,
      );
    } catch (e) {
      console.log(`${test.name}: ERROR - ${e.message}`);
    }
  }
}

testCodecSupport();
```

**GPU Feature Check:**

```javascript
// Access via chrome://gpu or programmatically
const gpuInfo = await app.getGPUInfo("complete");
console.log("GPU Info:", JSON.stringify(gpuInfo, null, 2));
```

### Performance Benchmarks

| Metric             | Baseline | Target | Measurement Method         |
| ------------------ | -------- | ------ | -------------------------- |
| CPU Usage (4K AV1) | 40%+     | <20%   | Task Manager / top         |
| GPU Decode Util    | <50%     | >80%   | nvidia-smi / intel_gpu_top |
| Frame Drop Rate    | >1%      | <0.1%  | DevTools Media panel       |
| Decode Latency     | >20ms    | <10ms  | WebRTC stats               |

### Platform Testing Matrix

| Platform        | GPU           | Driver     | AV1 HW | HEVC HW | Test Status |
| --------------- | ------------- | ---------- | ------ | ------- | ----------- |
| Linux (X11)     | Intel Arc     | i915       |        |         | Pending     |
| Linux (Wayland) | Intel Arc     | i915       |        |         | Pending     |
| Linux (X11)     | AMD RX 6000   | radeonsi   |        |         | Pending     |
| Linux (X11)     | NVIDIA RTX 30 | nvidia     |        |         | Pending     |
| Windows 11      | Intel Arc     | Intel      |        |         | Pending     |
| Windows 11      | NVIDIA RTX 40 | Game Ready |        |         | Pending     |
| Windows 11      | AMD RX 7000   | Adrenalin  |        |         | Pending     |
| macOS 14        | Apple M3      | Native     |        |         | Pending     |

---

## Risk Assessment

### Technical Risks

| Risk                             | Probability | Impact | Mitigation                     |
| -------------------------------- | ----------- | ------ | ------------------------------ |
| Custom build breaks on update    | High        | Medium | Automate builds, pin versions  |
| FFmpeg ABI incompatibility       | Medium      | High   | Version lock, thorough testing |
| Platform-specific failures       | Medium      | Medium | Comprehensive test matrix      |
| Hardware acceleration regression | Low         | High   | Feature flags, fallback paths  |

### Legal Risks

| Risk                      | Probability | Impact | Mitigation                       |
| ------------------------- | ----------- | ------ | -------------------------------- |
| HEVC patent claims        | Low         | High   | Use HW decode only, legal review |
| FFmpeg licensing (GPL)    | Medium      | Medium | Document license compliance      |
| Distribution restrictions | Low         | Medium | Clear licensing documentation    |

### Operational Risks

| Risk                         | Probability | Impact | Mitigation                     |
| ---------------------------- | ----------- | ------ | ------------------------------ |
| Build infrastructure failure | Medium      | Medium | Multiple CI providers          |
| Maintainer burnout           | Medium      | High   | Document processes, bus factor |
| Version lag (security)       | Medium      | High   | Automate updates, alerts       |

---

## Resources and References

### Official Documentation

- [Electron Build Instructions](https://www.electronjs.org/docs/latest/development/build-instructions-gn/)
- [Chromium GN Build System](https://gn.googlesource.com/gn/+/main/docs/)
- [FFmpeg Compilation Guide](https://trac.ffmpeg.org/wiki/CompilationGuide)
- [Chromium Media Documentation](https://chromium.googlesource.com/chromium/src/+/main/media/)
- [VA-API Documentation](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/docs/gpu/vaapi.md)

### Community Resources

- [electron-chromium-codecs](https://github.com/ThaUnknown/electron-chromium-codecs) - HEVC/AC3/E-AC3 patches
- [enable-chromium-hevc-hardware-decoding](https://github.com/StaZhu/enable-chromium-hevc-hardware-decoding) - HEVC HW decode guide
- [Electron Releases](https://releases.electronjs.org/) - Version tracking
- [AV1 Alliance](https://aomedia.org/) - AV1 codec resources

### GeForce NOW Resources

- [GeForce NOW System Requirements](https://www.nvidia.com/en-us/geforce-now/system-reqs/)
- [NVIDIA Video Codec SDK](https://developer.nvidia.com/video-codec-sdk)
- [AV1 Streaming Announcement](https://www.nvidia.com/en-us/geforce/news/gfecnt/20235/av1-obs29-youtube/)

### Hardware Acceleration Guides

- [Arch Wiki - Hardware Video Acceleration](https://wiki.archlinux.org/title/Hardware_video_acceleration)
- [Arch Wiki - Chromium](https://wiki.archlinux.org/title/Chromium)
- [CachyOS - Chromium HW Acceleration](https://wiki.cachyos.org/configuration/enabling_hardware_acceleration_in_google_chrome/)
- [Intel Media Driver](https://github.com/intel/media-driver)
- [AMD GPU Firmware](https://gitlab.freedesktop.org/agd5f/linux/-/tree/amd-staging-drm-next/drivers/gpu/drm/amd)

---

## Appendix

### A. Codec String Reference

```
# AV1 Codec Strings (av01.P.LLT.DD)
av01.0.04M.08  # Main Profile, Level 4.0, Main tier, 8-bit
av01.0.08M.08  # Main Profile, Level 5.0, Main tier, 8-bit (4K)
av01.0.12M.10  # Main Profile, Level 6.0, Main tier, 10-bit (8K)

# HEVC Codec Strings (hvc1.P.C.LXXX)
hvc1.1.6.L93.B0   # Main, Level 3.1 (1080p)
hvc1.1.6.L120.B0  # Main, Level 4.0 (1440p)
hvc1.1.6.L153.B0  # Main, Level 5.1 (4K)
hvc1.2.4.L153.B0  # Main 10, Level 5.1 (4K HDR)

# H.264 Codec Strings (avc1.PPCCLL)
avc1.42001E  # Baseline, Level 3.0
avc1.4D401F  # Main, Level 3.1 (720p)
avc1.640028  # High, Level 4.0 (1080p)
avc1.640032  # High, Level 5.0 (4K)

# VP9 Codec Strings (vp09.PP.LL.DD)
vp09.00.31.08  # Profile 0, Level 3.1, 8-bit (1080p)
vp09.00.50.08  # Profile 0, Level 5.0, 8-bit (4K)
vp09.02.50.10  # Profile 2, Level 5.0, 10-bit (4K HDR)
```

### B. Chrome Feature Flags Reference

```
# Video Decoding
VaapiVideoDecoder              # Linux VAAPI decoder
VaapiVideoEncoder              # Linux VAAPI encoder
VaapiAV1Decoder                # VAAPI AV1 specific
Av1Decoder                     # General AV1 decoder
PlatformHEVCDecoderSupport     # Cross-platform HEVC HW decode
PlatformHEVCEncoderSupport     # Cross-platform HEVC HW encode
D3D11VideoDecodeAcceleration   # Windows D3D11 decoder

# Acceleration
AcceleratedVideoDecodeLinuxGL       # Linux GL-based acceleration
AcceleratedVideoDecodeLinuxZeroCopyGL  # Zero-copy variant
VaapiIgnoreDriverChecks             # Bypass driver validation
GlobalVaapiLock                     # Threading safety

# Platform Specific
VaapiOnNvidiaGPUs              # NVIDIA VAAPI support (experimental)
WaylandWindowDecorations       # Wayland native decorations
```

### C. Troubleshooting Commands

```bash
# Linux - Check VAAPI support
vainfo

# Linux - Check Intel GPU capabilities
sudo intel_gpu_top

# Linux - Check NVIDIA decoder utilization
nvidia-smi dmon -s u

# Windows - Check GPU info (PowerShell)
Get-WmiObject Win32_VideoController | Select-Object Name, DriverVersion

# Electron - Enable verbose logging
ELECTRON_ENABLE_LOGGING=1 ./GeForceInfinity --enable-logging

# Check chrome://gpu programmatically
# Navigate to chrome://gpu in the app or use:
const gpu = await app.getGPUInfo('complete');
```

### D. GeForce Infinity Specific Notes

The current implementation in `/home/parobek/Code/GeForce-Infinity/src/electron/main.ts` already configures:

1. **AV1 Support:** `Av1Decoder`, `VaapiAV1Decoder` flags enabled
2. **HEVC Support:** `PlatformHEVCDecoderSupport` flag enabled
3. **VAAPI Support:** Full VAAPI configuration for Linux
4. **Resolution Override:** webFrameMain API for iframe injection working correctly

The resolution override system successfully modifies GeForce NOW session requests. Any limitations with higher resolutions (3440x1440, 4K) are due to external factors:

- GeForce NOW account tier (Ultimate required for AV1)
- Game-specific limitations
- Backend validation by NVIDIA

---

**Document Maintained By:** GeForce Infinity Development Team
**Last Updated:** January 2026
