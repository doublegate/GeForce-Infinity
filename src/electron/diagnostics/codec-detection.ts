// Codec Detection Module for GeForce Infinity
// Phase 1: Verification and Diagnostics implementation
// Uses WebCodecs API to detect codec support at various resolutions

import type { WebContents } from "electron";
import type { CodecCapabilities, CodecTestResult } from "./types.js";

// Codec string reference for various codecs and profiles
const CODEC_STRINGS = {
    // AV1 Codec Strings (av01.P.LLT.DD)
    av1_1080p: "av01.0.04M.08", // Main Profile, Level 4.0, Main tier, 8-bit
    av1_1440p: "av01.0.05M.08", // Main Profile, Level 4.1, Main tier, 8-bit
    av1_4K: "av01.0.08M.08", // Main Profile, Level 5.0, Main tier, 8-bit (4K)

    // HEVC Codec Strings (hvc1.P.C.LXXX)
    hevc_1080p: "hvc1.1.6.L93.B0", // Main, Level 3.1 (1080p)
    hevc_1440p: "hvc1.1.6.L120.B0", // Main, Level 4.0 (1440p)
    hevc_4K: "hvc1.1.6.L153.B0", // Main, Level 5.1 (4K)

    // H.264 Codec Strings (avc1.PPCCLL)
    h264_1080p: "avc1.640028", // High, Level 4.0 (1080p)
    h264_4K: "avc1.640032", // High, Level 5.0 (4K)

    // VP9 Codec Strings (vp09.PP.LL.DD)
    vp9_1080p: "vp09.00.31.08", // Profile 0, Level 3.1, 8-bit (1080p)
    vp9_4K: "vp09.00.50.08", // Profile 0, Level 5.0, 8-bit (4K)
};

// Resolution configurations for testing
const RESOLUTIONS = {
    "1080p": { width: 1920, height: 1080 },
    "1440p": { width: 2560, height: 1440 },
    "4K": { width: 3840, height: 2160 },
};

/**
 * Get comprehensive codec capabilities by executing WebCodecs API in renderer
 * @param webContents - Electron WebContents to execute JavaScript in
 * @returns Promise<CodecCapabilities> - Codec support information
 */
export async function getCodecCapabilities(
    webContents: WebContents
): Promise<CodecCapabilities> {
    const script = `
        (async () => {
            const checkCodec = async (codec, width, height) => {
                try {
                    if (typeof VideoDecoder === 'undefined' || !VideoDecoder.isConfigSupported) {
                        return { supported: false, hardware: null };
                    }
                    const result = await VideoDecoder.isConfigSupported({
                        codec: codec,
                        width: width,
                        height: height,
                    });
                    return {
                        supported: result.supported === true,
                        hardware: result.config?.hardwareAcceleration === 'prefer-hardware' ? true : null
                    };
                } catch (e) {
                    console.error('[GeForce Infinity] Codec check error:', codec, e.message);
                    return { supported: false, hardware: null };
                }
            };

            const hasWebGPU = !!navigator.gpu;

            const results = {
                av1: {
                    decode1080p: (await checkCodec('${CODEC_STRINGS.av1_1080p}', 1920, 1080)).supported,
                    decode1440p: (await checkCodec('${CODEC_STRINGS.av1_1440p}', 2560, 1440)).supported,
                    decode4K: (await checkCodec('${CODEC_STRINGS.av1_4K}', 3840, 2160)).supported,
                    hardwareAccelerated: hasWebGPU ? true : null,
                },
                hevc: {
                    decode1080p: (await checkCodec('${CODEC_STRINGS.hevc_1080p}', 1920, 1080)).supported,
                    decode1440p: (await checkCodec('${CODEC_STRINGS.hevc_1440p}', 2560, 1440)).supported,
                    decode4K: (await checkCodec('${CODEC_STRINGS.hevc_4K}', 3840, 2160)).supported,
                    hardwareAccelerated: null,
                },
                h264: {
                    decode1080p: (await checkCodec('${CODEC_STRINGS.h264_1080p}', 1920, 1080)).supported,
                    decode4K: (await checkCodec('${CODEC_STRINGS.h264_4K}', 3840, 2160)).supported,
                    hardwareAccelerated: null,
                },
                vp9: {
                    decode1080p: (await checkCodec('${CODEC_STRINGS.vp9_1080p}', 1920, 1080)).supported,
                    decode4K: (await checkCodec('${CODEC_STRINGS.vp9_4K}', 3840, 2160)).supported,
                    hardwareAccelerated: null,
                },
            };

            return results;
        })()
    `;

    try {
        const result = await webContents.executeJavaScript(script);
        console.log("[GeForce Infinity] Codec capabilities detected:", result);
        return result as CodecCapabilities;
    } catch (error) {
        console.error("[GeForce Infinity] Failed to detect codec capabilities:", error);
        // Return default values indicating unknown support
        return {
            av1: {
                decode1080p: false,
                decode1440p: false,
                decode4K: false,
                hardwareAccelerated: null,
            },
            hevc: {
                decode1080p: false,
                decode1440p: false,
                decode4K: false,
                hardwareAccelerated: null,
            },
            h264: {
                decode1080p: false,
                decode4K: false,
                hardwareAccelerated: null,
            },
            vp9: {
                decode1080p: false,
                decode4K: false,
                hardwareAccelerated: null,
            },
        };
    }
}

/**
 * Run comprehensive codec tests and return detailed results
 * @param webContents - Electron WebContents to execute JavaScript in
 * @returns Promise<CodecTestResult[]> - Detailed test results for each codec/resolution
 */
export async function runCodecTests(
    webContents: WebContents
): Promise<CodecTestResult[]> {
    const script = `
        (async () => {
            const tests = [
                { name: 'AV1 (4K)', codec: '${CODEC_STRINGS.av1_4K}', width: 3840, height: 2160, resolution: '4K' },
                { name: 'AV1 (1440p)', codec: '${CODEC_STRINGS.av1_1440p}', width: 2560, height: 1440, resolution: '1440p' },
                { name: 'AV1 (1080p)', codec: '${CODEC_STRINGS.av1_1080p}', width: 1920, height: 1080, resolution: '1080p' },
                { name: 'HEVC (4K)', codec: '${CODEC_STRINGS.hevc_4K}', width: 3840, height: 2160, resolution: '4K' },
                { name: 'HEVC (1440p)', codec: '${CODEC_STRINGS.hevc_1440p}', width: 2560, height: 1440, resolution: '1440p' },
                { name: 'HEVC (1080p)', codec: '${CODEC_STRINGS.hevc_1080p}', width: 1920, height: 1080, resolution: '1080p' },
                { name: 'H.264 (1080p)', codec: '${CODEC_STRINGS.h264_1080p}', width: 1920, height: 1080, resolution: '1080p' },
                { name: 'H.264 (4K)', codec: '${CODEC_STRINGS.h264_4K}', width: 3840, height: 2160, resolution: '4K' },
                { name: 'VP9 (4K)', codec: '${CODEC_STRINGS.vp9_4K}', width: 3840, height: 2160, resolution: '4K' },
                { name: 'VP9 (1080p)', codec: '${CODEC_STRINGS.vp9_1080p}', width: 1920, height: 1080, resolution: '1080p' },
            ];

            const results = [];
            console.log('[GeForce Infinity] === Codec Support Test ===');

            for (const test of tests) {
                try {
                    if (typeof VideoDecoder === 'undefined' || !VideoDecoder.isConfigSupported) {
                        results.push({
                            codec: test.name,
                            resolution: test.resolution,
                            supported: false,
                            hardwareAccelerated: null,
                            error: 'WebCodecs API not available'
                        });
                        console.log('[GeForce Infinity] ' + test.name + ': WebCodecs not available');
                        continue;
                    }

                    const result = await VideoDecoder.isConfigSupported({
                        codec: test.codec,
                        width: test.width,
                        height: test.height,
                    });

                    const hwAccel = result.config?.hardwareAcceleration === 'prefer-hardware';
                    results.push({
                        codec: test.name,
                        resolution: test.resolution,
                        supported: result.supported === true,
                        hardwareAccelerated: hwAccel ? true : null,
                    });
                    console.log('[GeForce Infinity] ' + test.name + ': ' + (result.supported ? 'SUPPORTED' : 'NOT SUPPORTED'));
                } catch (e) {
                    results.push({
                        codec: test.name,
                        resolution: test.resolution,
                        supported: false,
                        hardwareAccelerated: null,
                        error: e.message
                    });
                    console.log('[GeForce Infinity] ' + test.name + ': ERROR - ' + e.message);
                }
            }

            return results;
        })()
    `;

    try {
        const results = await webContents.executeJavaScript(script);
        console.log("[GeForce Infinity] Codec test results:", results);
        return results as CodecTestResult[];
    } catch (error) {
        console.error("[GeForce Infinity] Failed to run codec tests:", error);
        return [];
    }
}

/**
 * Check if a specific codec is supported at a given resolution
 * @param webContents - Electron WebContents
 * @param codecString - The codec string to test (e.g., 'av01.0.08M.08')
 * @param width - Resolution width
 * @param height - Resolution height
 * @returns Promise<boolean> - Whether the codec is supported
 */
export async function isCodecSupported(
    webContents: WebContents,
    codecString: string,
    width: number,
    height: number
): Promise<boolean> {
    const script = `
        (async () => {
            try {
                if (typeof VideoDecoder === 'undefined' || !VideoDecoder.isConfigSupported) {
                    return false;
                }
                const result = await VideoDecoder.isConfigSupported({
                    codec: '${codecString}',
                    width: ${width},
                    height: ${height},
                });
                return result.supported === true;
            } catch {
                return false;
            }
        })()
    `;

    try {
        return await webContents.executeJavaScript(script);
    } catch {
        return false;
    }
}

export { CODEC_STRINGS, RESOLUTIONS };
