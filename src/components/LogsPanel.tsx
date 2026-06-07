import { useState } from "react";
import { Language, LogFile, LogList } from "../types";
import { translations } from "../translations";
import { Terminal, Database, Download, Eye, FileText, Check } from "lucide-react";

interface LogsPanelProps {
  language: Language;
  connected: boolean;
  isDark: boolean;
  getApiUrl?: (path: string) => string;
}

export default function LogsPanel({ language, connected, isDark, getApiUrl }: LogsPanelProps) {
  const t = translations[language];

  const getUrl = (path: string) => {
    return getApiUrl ? getApiUrl(path) : path;
  };

  const [types, setTypes] = useState<string[]>(["ScaraControl", "VisionSorter"]);
  const [queriedLogs, setQueriedLogs] = useState<LogList | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);

  // Toggle checks helper
  const handleCheckboxChange = (type: string) => {
    if (types.includes(type)) {
      setTypes(types.filter((t) => t !== type));
    } else {
      setTypes([...types, type]);
    }
  };

  const handleQueryLogs = async () => {
    if (!connected) return;
    setLoading(true);
    try {
      const res = await fetch(getUrl("/log/list"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ types })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setQueriedLogs(json.data);
        }
      }
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadLogs = async () => {
    if (!connected || !queriedLogs) return;
    setDownloading(true);
    
    // Extract checked log list names
    const scaraNames = (queriedLogs.ScaraControl || []).map((file) => file.name);
    const visionNames = (queriedLogs.VisionSorter || []).map((file) => file.name);

    try {
      // POST download
      const res = await fetch(getUrl("/log/download"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ScaraControl: scaraNames,
          VisionSorter: visionNames
        })
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `scara_industrial_logs_2026_06_05.tar`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (e) {
      alert(`Export failed: ${e}`);
    } finally {
      setDownloading(false);
    }
  };

  // Convert bytes size to readable KB format
  const formatSize = (bytes: number) => {
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <div className={`p-4 rounded-xl border transition-all ${
      isDark ? "bg-slate-900/80 border-slate-800" : "bg-white border-zinc-200 shadow-sm"
    }`}>
      
      {/* Title */}
      <div className="flex items-center justify-between mb-3 border-b pb-2 border-cyan-500/10">
        <div className="flex items-center gap-2">
          <Database className="text-[#2ec6d6]" size={18} />
          <span className={`font-display font-bold text-sm ${isDark ? "text-white" : "text-zinc-800"}`}>
            {t.logsTitle}
          </span>
        </div>
        <div className="font-mono text-[10px] text-slate-500">
          LOG RETRIEVAL ENGINE v2
        </div>
      </div>

      {/* Select type options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 text-xs font-mono">
        <label className={`p-3 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
          isDark 
            ? "bg-slate-950/40 border-slate-800 text-slate-300 hover:border-cyan-500/30" 
            : "bg-slate-50 border-zinc-200 text-zinc-700 hover:bg-slate-100"
        }`}>
          <div className="flex items-center gap-2">
            <input
              id="checkbox_scara_control"
              type="checkbox"
              checked={types.includes("ScaraControl")}
              onChange={() => handleCheckboxChange("ScaraControl")}
              className="accent-[#2ec6d6] cursor-pointer"
            />
            <span>ScaraControl Logs</span>
          </div>
          <span className="text-[10px] text-slate-500">/logs</span>
        </label>

        <label className={`p-3 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
          isDark 
            ? "bg-slate-950/40 border-slate-800 text-slate-300 hover:border-cyan-500/30" 
            : "bg-slate-50 border-zinc-200 text-zinc-700 hover:bg-slate-100"
        }`}>
          <div className="flex items-center gap-2">
            <input
              id="checkbox_vision_sorter"
              type="checkbox"
              checked={types.includes("VisionSorter")}
              onChange={() => handleCheckboxChange("VisionSorter")}
              className="accent-[#2ec6d6] cursor-pointer"
            />
            <span>VisionSorter Logs</span>
          </div>
          <span className="text-[10px] text-slate-500">/build/log</span>
        </label>
      </div>

      {/* Query button */}
      <div className="flex gap-3 mb-4">
        <button
          id="query_logs_btn"
          onClick={handleQueryLogs}
          disabled={!connected || loading || types.length === 0}
          className={`flex-1 py-2 text-xs font-display font-semibold rounded-lg shadow-sm cursor-pointer transition-all ${
            connected && types.length > 0
              ? "bg-[#2ec6d6] text-cyan-950 hover:bg-[#2ec6d6]/80 active:scale-95"
              : "bg-slate-800 text-slate-600 cursor-not-allowed"
          }`}
        >
          {loading ? "SEARCHING..." : t.queryLogs}
        </button>

        {queriedLogs && (
          <button
            id="download_logs_btn"
            onClick={handleDownloadLogs}
            disabled={downloading}
            className="px-4 py-2 bg-slate-800 border border-slate-700 hover:border-[#2ec6d6] text-white hover:text-[#2ec6d6] rounded-lg text-xs font-display font-semibold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
          >
            <Download size={13} />
            <span>{downloading ? "PACKING..." : t.downloadLogs}</span>
          </button>
        )}
      </div>

      {/* Table listing */}
      {queriedLogs ? (
        <div className="space-y-4 max-h-[220px] overflow-y-auto pr-1 no-scrollbar font-mono text-xs">
          
          {/* Render ScaraControl logs group if available */}
          {types.includes("ScaraControl") && queriedLogs.ScaraControl && (
            <div id="scara_logs_group" className="space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-[#2ec6d6] block">
                📦 Directory: ScaraControl Logs (/workspace/logs)
              </span>
              {queriedLogs.ScaraControl.length > 0 ? (
                queriedLogs.ScaraControl.map((file) => (
                  <div 
                    id={`scara_log_${file.name.replace(/[^a-zA-Z0-9]/g, '_')}`}
                    key={file.name} 
                    className={`p-2.5 rounded border border-slate-800 flex items-center justify-between text-[11px] ${
                      isDark ? "bg-slate-950 text-slate-300" : "bg-slate-50 text-zinc-700"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-[#2ec6d6]" />
                      <span className="font-semibold text-slate-200">{file.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-500">
                      <span>{formatSize(file.size)}</span>
                      <span>{file.lastModifiedAt}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-[10px] text-slate-500 pl-3">No Scara logs found.</div>
              )}
            </div>
          )}

          {/* Render VisionSorter logs group if available */}
          {types.includes("VisionSorter") && queriedLogs.VisionSorter && (
            <div id="vision_logs_group" className="space-y-1.5 mt-2">
              <span className="text-[10px] uppercase font-bold text-amber-500 block">
                📦 Directory: VisionSorter Logs (/scara_control/build/log)
              </span>
              {queriedLogs.VisionSorter.length > 0 ? (
                queriedLogs.VisionSorter.map((file) => (
                  <div 
                    id={`vision_log_${file.name.replace(/[^a-zA-Z0-9]/g, '_')}`}
                    key={file.name} 
                    className={`p-2.5 rounded border border-slate-800 flex items-center justify-between text-[11px] ${
                      isDark ? "bg-slate-950 text-slate-300" : "bg-slate-50 text-zinc-700"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-amber-500" />
                      <span className="font-semibold text-slate-200">{file.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-500">
                      <span>{formatSize(file.size)}</span>
                      <span>{file.lastModifiedAt}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-[10px] text-slate-500 pl-3">No Vision logs found.</div>
              )}
            </div>
          )}

        </div>
      ) : (
        <div className={`p-4 rounded-lg text-center font-mono text-xs border ${
          isDark ? "bg-slate-950/20 border-slate-900 text-slate-500" : "bg-slate-50 border-zinc-100 text-zinc-400"
        }`}>
          {language === 'zh' ? '尚未发起查询。点击“查询选定日志”提取系统实时生成的文件信息。' : 'Logs catalog offline. Send search query to retrieve file indexing tables.'}
        </div>
      )}
    </div>
  );
}
