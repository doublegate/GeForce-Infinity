import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { FaInfoCircle, FaSync } from "react-icons/fa";
import {
  FaCircleCheck,
  FaTriangleExclamation,
  FaMicrochip,
  FaDisplay,
  FaVideo,
} from "react-icons/fa6";
import type {
  DiagnosticsReport,
  DiagnosticsTestResults,
  DiagnosticsSummary,
} from "../global";
import { StatusIndicator, TabButton } from "./diagnostics";

type DiagnosticsTab = "summary" | "codecs" | "gpu" | "platform";

export const DiagnosticsPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<DiagnosticsTab>("summary");
  const [loading, setLoading] = useState(false);
  const [testRunning, setTestRunning] = useState(false);
  const [summary, setSummary] = useState<DiagnosticsSummary | null>(null);
  const [report, setReport] = useState<DiagnosticsReport | null>(null);
  const [testResults, setTestResults] = useState<DiagnosticsTestResults | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Load summary on mount
  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = useCallback(async () => {
    if (!window.diagnostics) {
      setError("Diagnostics API not available");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const summaryData = await window.diagnostics.getDiagnosticsSummary();
      setSummary(summaryData);
    } catch (err) {
      console.error("[Diagnostics] Failed to load summary:", err);
      setError("Failed to load diagnostics summary");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFullReport = useCallback(async () => {
    if (!window.diagnostics) {
      setError("Diagnostics API not available");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const reportData = await window.diagnostics.getDiagnosticsReport();
      setReport(reportData);
    } catch (err) {
      console.error("[Diagnostics] Failed to load report:", err);
      setError("Failed to load diagnostics report");
    } finally {
      setLoading(false);
    }
  }, []);

  const runTests = useCallback(async () => {
    if (!window.diagnostics) {
      setError("Diagnostics API not available");
      return;
    }

    setTestRunning(true);
    setError(null);
    try {
      const results = await window.diagnostics.runCodecTests();
      setTestResults(results);
    } catch (err) {
      console.error("[Diagnostics] Failed to run tests:", err);
      setError("Failed to run codec tests");
    } finally {
      setTestRunning(false);
    }
  }, []);

  // Load full report when expanding or changing tabs
  useEffect(() => {
    if (expanded && !report) {
      loadFullReport();
    }
  }, [expanded, report, loadFullReport]);

  const renderSummaryTab = () => {
    if (!summary && !report) {
      return (
        <div className="text-gray-400 text-center py-4">
          {loading ? "Loading..." : "No data available"}
        </div>
      );
    }

    const data = summary || {
      av1Support:
        report?.codecs.av1.decode4K || report?.codecs.av1.decode1080p || false,
      hevcSupport:
        report?.codecs.hevc.decode4K ||
        report?.codecs.hevc.decode1080p ||
        false,
      h264Support: report?.codecs.h264.decode1080p || false,
      max4K:
        report?.codecs.av1.decode4K || report?.codecs.hevc.decode4K || false,
      gpuName: report ? `${report.gpu.vendor} ${report.gpu.model}` : "Unknown",
    };

    return (
      <div className="space-y-4">
        <div className="bg-gray-700 rounded p-3">
          <div className="flex items-center gap-2 mb-2">
            <FaMicrochip className="text-[#76b900]" />
            <span className="font-medium text-white">GPU</span>
          </div>
          <p className="text-gray-300 text-sm">{data.gpuName}</p>
        </div>

        <div className="bg-gray-700 rounded p-3">
          <div className="flex items-center gap-2 mb-2">
            <FaVideo className="text-[#76b900]" />
            <span className="font-medium text-white">Codec Support</span>
          </div>
          <div className="space-y-1">
            <StatusIndicator
              supported={data.av1Support}
              label="AV1 (4K Streaming)"
            />
            <StatusIndicator supported={data.hevcSupport} label="HEVC/H.265" />
            <StatusIndicator supported={data.h264Support} label="H.264/AVC" />
          </div>
        </div>

        <div className="bg-gray-700 rounded p-3">
          <div className="flex items-center gap-2 mb-2">
            <FaDisplay className="text-[#76b900]" />
            <span className="font-medium text-white">Max Resolution</span>
          </div>
          <p className="text-gray-300">
            {data.max4K ? (
              <span className="text-green-400">4K Ready</span>
            ) : data.hevcSupport ? (
              <span className="text-yellow-400">1440p Ready</span>
            ) : (
              <span className="text-gray-400">1080p (H.264)</span>
            )}
          </p>
        </div>

        {report?.recommendations && report.recommendations.length > 0 && (
          <div className="bg-gray-700 rounded p-3">
            <div className="flex items-center gap-2 mb-2">
              <FaInfoCircle className="text-blue-400" />
              <span className="font-medium text-white">Recommendations</span>
            </div>
            <ul className="text-gray-300 text-sm space-y-1">
              {report.recommendations.slice(0, 3).map((rec, i) => (
                <li key={i} className="text-xs">
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}

        {report?.warnings && report.warnings.length > 0 && (
          <div className="bg-yellow-900/30 border border-yellow-700 rounded p-3">
            <div className="flex items-center gap-2 mb-2">
              <FaTriangleExclamation className="text-yellow-500" />
              <span className="font-medium text-yellow-400">Warnings</span>
            </div>
            <ul className="text-yellow-200 text-sm space-y-1">
              {report.warnings.map((warn, i) => (
                <li key={i} className="text-xs">
                  {warn}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  const renderCodecsTab = () => {
    const codecs = report?.codecs;
    if (!codecs) {
      return (
        <div className="text-gray-400 text-center py-4">
          {loading ? "Loading..." : "Click refresh to load codec data"}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="bg-gray-700 rounded p-3">
          <h4 className="font-medium text-white mb-2">AV1</h4>
          <StatusIndicator
            supported={codecs.av1.decode4K}
            label="4K (3840x2160)"
            hardwareAccelerated={codecs.av1.hardwareAccelerated}
          />
          <StatusIndicator
            supported={codecs.av1.decode1440p}
            label="1440p (2560x1440)"
            hardwareAccelerated={codecs.av1.hardwareAccelerated}
          />
          <StatusIndicator
            supported={codecs.av1.decode1080p}
            label="1080p (1920x1080)"
            hardwareAccelerated={codecs.av1.hardwareAccelerated}
          />
        </div>

        <div className="bg-gray-700 rounded p-3">
          <h4 className="font-medium text-white mb-2">HEVC/H.265</h4>
          <StatusIndicator
            supported={codecs.hevc.decode4K}
            label="4K (3840x2160)"
            hardwareAccelerated={codecs.hevc.hardwareAccelerated}
          />
          <StatusIndicator
            supported={codecs.hevc.decode1440p}
            label="1440p (2560x1440)"
            hardwareAccelerated={codecs.hevc.hardwareAccelerated}
          />
          <StatusIndicator
            supported={codecs.hevc.decode1080p}
            label="1080p (1920x1080)"
            hardwareAccelerated={codecs.hevc.hardwareAccelerated}
          />
        </div>

        <div className="bg-gray-700 rounded p-3">
          <h4 className="font-medium text-white mb-2">H.264/AVC</h4>
          <StatusIndicator
            supported={codecs.h264.decode4K}
            label="4K (3840x2160)"
            hardwareAccelerated={codecs.h264.hardwareAccelerated}
          />
          <StatusIndicator
            supported={codecs.h264.decode1080p}
            label="1080p (1920x1080)"
            hardwareAccelerated={codecs.h264.hardwareAccelerated}
          />
        </div>

        <div className="bg-gray-700 rounded p-3">
          <h4 className="font-medium text-white mb-2">VP9</h4>
          <StatusIndicator
            supported={codecs.vp9.decode4K}
            label="4K (3840x2160)"
            hardwareAccelerated={codecs.vp9.hardwareAccelerated}
          />
          <StatusIndicator
            supported={codecs.vp9.decode1080p}
            label="1080p (1920x1080)"
            hardwareAccelerated={codecs.vp9.hardwareAccelerated}
          />
        </div>

        {testResults && (
          <div
            className={`rounded p-3 ${
              testResults.overallStatus === "passed"
                ? "bg-green-900/30 border border-green-700"
                : testResults.overallStatus === "partial"
                  ? "bg-yellow-900/30 border border-yellow-700"
                  : "bg-red-900/30 border border-red-700"
            }`}
          >
            <h4 className="font-medium text-white mb-2">Test Results</h4>
            <p className="text-sm text-gray-300 mb-2">{testResults.summary}</p>
            <div className="text-xs text-gray-400">
              Last run: {new Date(testResults.timestamp).toLocaleString()}
            </div>
          </div>
        )}

        <button
          onClick={runTests}
          disabled={testRunning}
          className="w-full flex items-center justify-center gap-2 bg-[#76b900] hover:bg-[#5a8c00] disabled:bg-gray-600 text-white py-2 rounded transition-colors"
        >
          <FaSync className={testRunning ? "animate-spin" : ""} />
          {testRunning ? "Running Tests..." : "Run Codec Tests"}
        </button>
      </div>
    );
  };

  const renderGPUTab = () => {
    const gpu = report?.gpu;
    if (!gpu) {
      return (
        <div className="text-gray-400 text-center py-4">
          {loading ? "Loading..." : "Click refresh to load GPU data"}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="bg-gray-700 rounded p-3">
          <h4 className="font-medium text-white mb-2">Device</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Vendor</span>
              <span className="text-gray-200">{gpu.vendor}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Model</span>
              <span className="text-gray-200">{gpu.model}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Driver</span>
              <span className="text-gray-200">{gpu.driverVersion}</span>
            </div>
            {gpu.gpuMemoryMB && (
              <div className="flex justify-between">
                <span className="text-gray-400">Memory</span>
                <span className="text-gray-200">{gpu.gpuMemoryMB} MB</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-gray-700 rounded p-3">
          <h4 className="font-medium text-white mb-2">Acceleration</h4>
          <div className="space-y-1">
            <StatusIndicator
              supported={gpu.videoDecodeAccelerated}
              label="Video Decode"
            />
            <StatusIndicator
              supported={gpu.videoEncodeAccelerated}
              label="Video Encode"
            />
          </div>
        </div>

        {gpu.webglRenderer && (
          <div className="bg-gray-700 rounded p-3">
            <h4 className="font-medium text-white mb-2">WebGL</h4>
            <div className="text-sm text-gray-300 break-all">
              {gpu.webglRenderer}
            </div>
          </div>
        )}

        {gpu.features && gpu.features.length > 0 && (
          <div className="bg-gray-700 rounded p-3">
            <h4 className="font-medium text-white mb-2">Features</h4>
            <div className="space-y-1">
              {gpu.features.map((feature, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-400">{feature.name}</span>
                  <span
                    className={
                      feature.status === "enabled"
                        ? "text-green-400"
                        : feature.status === "software"
                          ? "text-yellow-400"
                          : feature.status === "disabled"
                            ? "text-red-400"
                            : "text-gray-500"
                    }
                  >
                    {feature.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderPlatformTab = () => {
    const platform = report?.platform;
    if (!platform) {
      return (
        <div className="text-gray-400 text-center py-4">
          {loading ? "Loading..." : "Click refresh to load platform data"}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="bg-gray-700 rounded p-3">
          <h4 className="font-medium text-white mb-2">System</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">OS</span>
              <span className="text-gray-200">{platform.osVersion}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Architecture</span>
              <span className="text-gray-200">{platform.arch}</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-700 rounded p-3">
          <h4 className="font-medium text-white mb-2">Runtime</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Electron</span>
              <span className="text-gray-200">{platform.electronVersion}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Chromium</span>
              <span className="text-gray-200">{platform.chromiumVersion}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Node.js</span>
              <span className="text-gray-200">{platform.nodeVersion}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">V8</span>
              <span className="text-gray-200">{platform.v8Version}</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-700 rounded p-3">
          <h4 className="font-medium text-white mb-2">Platform Features</h4>
          <div className="space-y-1">
            {platform.platform === "linux" && (
              <StatusIndicator
                supported={platform.vaapiAvailable || false}
                label="VAAPI (Linux)"
              />
            )}
            {platform.platform === "win32" && (
              <StatusIndicator
                supported={platform.hevcExtensionsInstalled || false}
                label="HEVC Extensions"
              />
            )}
            {platform.platform === "darwin" && (
              <StatusIndicator
                supported={platform.videoToolboxAvailable || false}
                label="VideoToolbox"
              />
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "summary":
        return renderSummaryTab();
      case "codecs":
        return renderCodecsTab();
      case "gpu":
        return renderGPUTab();
      case "platform":
        return renderPlatformTab();
      default:
        return null;
    }
  };

  return (
    <section className="p-4 text-gray-200">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <FaInfoCircle className="text-[#76b900]" />
          System Diagnostics
        </h2>
        <span className="text-gray-400 text-sm">
          {expanded ? "Click to collapse" : "Click to expand"}
        </span>
      </div>

      {!expanded && summary && (
        <div className="mt-2 text-sm text-gray-400 flex items-center gap-4">
          <span>{summary.gpuName}</span>
          <span className="flex items-center gap-1">
            {summary.max4K ? (
              <>
                <FaCircleCheck className="text-green-500" /> 4K Ready
              </>
            ) : (
              <>
                <FaTriangleExclamation className="text-yellow-500" /> Limited
              </>
            )}
          </span>
        </div>
      )}

      {expanded && (
        <div className="mt-4">
          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded p-3 mb-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <div className="flex gap-2 mb-4 flex-wrap">
            <TabButton
              active={activeTab === "summary"}
              onClick={() => setActiveTab("summary")}
              icon={<FaInfoCircle />}
              label="Summary"
            />
            <TabButton
              active={activeTab === "codecs"}
              onClick={() => setActiveTab("codecs")}
              icon={<FaVideo />}
              label="Codecs"
            />
            <TabButton
              active={activeTab === "gpu"}
              onClick={() => setActiveTab("gpu")}
              icon={<FaMicrochip />}
              label="GPU"
            />
            <TabButton
              active={activeTab === "platform"}
              onClick={() => setActiveTab("platform")}
              icon={<FaDisplay />}
              label="Platform"
            />
            <button
              onClick={loadFullReport}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 rounded text-sm bg-gray-600 text-gray-300 hover:bg-gray-500 disabled:opacity-50 transition-colors ml-auto"
            >
              <FaSync className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          <div className="max-h-[400px] overflow-y-auto scrollbar">
            {renderTabContent()}
          </div>
        </div>
      )}
    </section>
  );
};

export default DiagnosticsPanel;
