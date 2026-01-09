# Electron Custom Build Research Notes

**Date:** January 2026
**Project:** GeForce Infinity
**Current Electron:** 37.2.0 (Chromium 138.0.7204.35, Node.js 22.16.0)

---

## Executive Summary

This document captures research findings on building custom Electron distributions for enhanced codec and hardware acceleration support. The primary conclusion is that **custom Electron builds are generally unnecessary** for AV1/HEVC streaming support, as modern Electron versions already include comprehensive codec support.

---

## 1. Electron Build Architecture

### Build System Overview

Electron uses a complex build system that combines:
- **GN (Generate Ninja):** Google's meta-build system for Chromium
- **Ninja:** Fast build system for actual compilation
- **depot_tools:** Google's suite of build and version control tools

### Build Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| Disk Space | 50 GB | 100+ GB |
| RAM | 16 GB | 32+ GB |
| Build Time | 2-4 hours | N/A |
| CPU Cores | 8 | 16+ |

### Key GN Build Arguments

```gn
# Enable proprietary codecs (H.264/AAC)
proprietary_codecs = true

# Chrome branding enables additional codecs
ffmpeg_branding = "Chrome"

# Hardware acceleration flags
use_vaapi = true  # Linux only
```

---

## 2. Electron Distribution Methods

### Method A: electron-builder with electronDist

The `electronDist` option in electron-builder accepts custom Electron binaries:

```javascript
// electron-builder.json
{
  "electronDist": "./custom-electron",
  // OR for zip archives:
  "electronDist": "./electron-zips"
  // Expected format: electron-v${version}-${platformName}-${arch}.zip
}
```

### Method B: @electron/rebuild

For native Node.js modules, use @electron/rebuild:

```bash
# Rebuild native modules against custom Electron
npx @electron/rebuild -e ./path/to/custom/electron -d https://custom-headers.example.com
```

### Method C: electron-packager afterCopy Hook

```javascript
const rebuild = require('@electron/rebuild');

packager({
  afterCopy: [(buildPath, electronVersion, platform, arch, callback) => {
    rebuild.rebuild({ buildPath, electronVersion, arch })
      .then(() => callback())
      .catch((error) => callback(error));
  }]
});
```

---

## 3. Versioning and Maintenance

### Electron Versioning Strategy

Since v2.0.0, Electron follows SemVer:
- **Major:** API breaking changes
- **Minor:** Chromium/Node.js upgrades
- **Patch:** Features and bug fixes

**Critical Note:** Most Chromium updates are considered breaking changes.

### Recommended Practices

1. **Pin exact versions:** Use `--save-exact` flag
2. **Test thoroughly:** Each Chromium update requires full validation
3. **Monitor stabilization branches:** Cherry-pick security fixes when needed
4. **Document modifications:** Track all custom patches for future upgrades

### Update Maintenance Burden

| Task | Frequency | Effort |
|------|-----------|--------|
| Security patches | Weekly-Monthly | Low-Medium |
| Chromium updates | Every 4-6 weeks | High |
| Node.js updates | As needed | Medium |
| Custom patch rebasing | Each Chromium update | High |

---

## 4. Custom Build vs. Standard Build Trade-offs

### When Custom Builds ARE Necessary

1. **Software HEVC decoding:** Requires FFmpeg patches (legal gray area)
2. **AC3/E-AC3 audio:** Not included in default builds
3. **Proprietary DRM modifications:** Beyond standard Widevine support
4. **Embedded device optimizations:** Custom hardware targets

### When Custom Builds Are NOT Necessary

1. **AV1 support:** Already included (libgav1/dav1d + hardware acceleration)
2. **Hardware HEVC decoding:** Available since Electron v22.0.0
3. **VP8/VP9 support:** Fully included
4. **H.264/AVC support:** Enabled with proprietary_codecs=true (default)

### Cost-Benefit Analysis

| Factor | Standard Electron | Custom Build |
|--------|-------------------|--------------|
| Build time | 0 (pre-built) | 2-4 hours |
| Disk space | ~200 MB | 50-100 GB |
| Maintenance | Minimal | High |
| Security updates | Automatic | Manual |
| Codec flexibility | Limited | Full |
| Legal risk | None | Varies |

---

## 5. FFmpeg Customization

### Default FFmpeg Configuration

Chromium's FFmpeg includes:
- **Included:** H.264, VP8, VP9, AV1, AAC, Opus, Vorbis, FLAC
- **Not Included:** HEVC (software), AC3, E-AC3, TrueHD

### FFmpeg Patches for HEVC

Several community projects provide HEVC patches:

1. **electron-chromium-codecs:** Community FFmpeg patches
2. **chromium-vaapi patches:** Linux-focused hardware acceleration
3. **FFmpeg official releases:** Can be used as replacement library

### Replacement Strategy

Replace the FFmpeg shared library post-build:
- Linux: `libffmpeg.so`
- macOS: `libffmpeg.dylib`
- Windows: `ffmpeg.dll`

**Warning:** This may violate codec patents in certain jurisdictions.

---

## 6. Platform-Specific Considerations

### Linux

- VAAPI support requires specific build flags and runtime configuration
- NVIDIA VAAPI support uses wrapper around NVDEC (not native)
- Intel and AMD have better native VAAPI support

### Windows

- D3D11VideoDecoder used by default for hardware acceleration
- HEVC requires Microsoft Store extension
- DXVA available as fallback for WebRTC

### macOS

- VideoToolbox provides hardware acceleration
- HEVC available since macOS 11.0 (Big Sur)
- AV1 hardware decode on M3+ (software on M1/M2)

---

## 7. Recommendations for GeForce Infinity

### Primary Recommendation: Enhanced Configuration

1. **Keep standard Electron:** Current v37.2.0 is sufficient
2. **Optimize runtime flags:** Current flags are comprehensive
3. **Leverage hardware acceleration:** Already properly configured
4. **Monitor GeForce NOW requirements:** Server-side codec decisions dominate

### When to Reconsider Custom Build

1. GeForce NOW requires codecs not in standard builds
2. Users consistently lack hardware decode capability
3. Software HEVC becomes legally viable and needed

### Current Implementation Assessment

The existing GeForce Infinity implementation in `main.ts` already includes:
- Comprehensive VAAPI flags for Linux
- D3D11/DXVA configuration for Windows
- VideoToolbox support for macOS
- AV1 and HEVC feature flags enabled

**Conclusion:** No immediate need for custom Electron build.

---

## 8. References

- Electron Build Instructions: https://github.com/nicbhp/nicbhp/blob/main/electron-build-HOWTO.md
- Chromium GN Build Configuration: https://gn.googlesource.com/gn/
- FFmpeg Codec Documentation: https://ffmpeg.org/documentation.html
- electron-builder Configuration: https://www.electron.build/configuration/configuration
- @electron/rebuild: https://github.com/electron/rebuild
