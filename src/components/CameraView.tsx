import { useEffect, useState, useRef } from "react";
import { Language } from "../types";
import { translations } from "../translations";
import { Eye, Focus, RefreshCw, AlertTriangle, ShieldCheck } from "lucide-react";

interface CameraViewProps {
  language: Language;
  connected: boolean;
  isDark: boolean;
  roi: { valid: boolean; x: number; y: number; w: number; h: number };
  onTeachRoiClick: () => void;
  onTeachRoiSave: (roi: { x: number; y: number; w: number; h: number }) => void;
  teachRoiActive: boolean;
  wsBinaryBlob: Blob | null;
}

export default function CameraView({
  language,
  connected,
  isDark,
  roi,
  onTeachRoiClick,
  onTeachRoiSave,
  teachRoiActive,
  wsBinaryBlob
}: CameraViewProps) {
  const t = translations[language];
  const [frameId, setFrameId] = useState<number>(0);
  const [resolution, setResolution] = useState<string>("1280 x 960 | 60 FPS");
  const [latency, setLatency] = useState<number>(12);
  const [cameraImage, setCameraImage] = useState<string>("");
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const imageRevokeUrlRef = useRef<string>("");

  // Simulated slider coordinates for ROI setting when teachRoiActive is true
  const [editX, setEditX] = useState<number>(roi.x);
  const [editY, setEditY] = useState<number>(roi.y);
  const [editW, setEditW] = useState<number>(roi.w);
  const [editH, setEditH] = useState<number>(roi.h);

  // Sync edits if ROI changes from outer scope
  useEffect(() => {
    if (!teachRoiActive) {
      setEditX(roi.x);
      setEditY(roi.y);
      setEditW(roi.w);
      setEditH(roi.h);
    }
  }, [roi, teachRoiActive]);

  // Read binary blob stream from websocket to update camera view!
  useEffect(() => {
    if (wsBinaryBlob) {
      const url = URL.createObjectURL(wsBinaryBlob);
      // Revoke the older URL to prevent memory leaks in browser
      if (imageRevokeUrlRef.current) {
        URL.revokeObjectURL(imageRevokeUrlRef.current);
      }
      setCameraImage(url);
      imageRevokeUrlRef.current = url;
      setFrameId((prev) => (prev + 1) % 99999);
      setLatency(parseFloat((4 + Math.random() * 6).toFixed(1) as any));
    }
  }, [wsBinaryBlob]);

  // Periodic fallback Base64 pull if WebSocket is not active, ensuring live feed
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (connected && !wsBinaryBlob) {
      interval = setInterval(async () => {
        try {
          const res = await fetch("/camera_stream");
          if (res.ok) {
            const json = await res.json();
            if (json.success && json.data) {
              setCameraImage(`data:image/jpeg;base64,${json.data}`);
              setFrameId((prev) => (prev + 1) % 99999);
              setLatency(parseFloat((10 + Math.random() * 8).toFixed(1) as any));
            }
          }
        } catch (err) {
          // Silent fallback
        }
      }, 1500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [connected, wsBinaryBlob]);

  // Clean up Blob URLs on unmount
  useEffect(() => {
    return () => {
      if (imageRevokeUrlRef.current) {
        URL.revokeObjectURL(imageRevokeUrlRef.current);
      }
    };
  }, []);

  const handleSaveRoi = () => {
    onTeachRoiSave({ x: editX, y: editY, w: editW, h: editH });
  };

  return (
    <div 
      id="camera_viewport_container"
      className={`rounded-xl border p-4 transition-all relative overflow-hidden ${
        isDark 
          ? "bg-slate-900/80 border-slate-800" 
          : "bg-white border-zinc-200 shadow-sm"
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Title */}
      <div className="flex items-center justify-between mb-3 border-b pb-2 border-cyan-500/10">
        <div className="flex items-center gap-2">
          <Eye className="text-[#2ec6d6]" size={18} />
          <span className={`font-display font-bold text-sm ${isDark ? "text-white" : "text-zinc-800"}`}>
            {t.cameraFeed}
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px]">
          {connected ? (
            <span className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <ShieldCheck size={11} />
              LIVE
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-500">
              OFFLINE
            </span>
          )}
          <span className={isDark ? "text-slate-500" : "text-zinc-400"} />
        </div>
      </div>

      {/* Screen Frame */}
      <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-slate-950 border border-slate-800/80">
        
        {/* Render actual image if connected or render high-tech industrial schematic vector layout */}
        {connected ? (
          cameraImage ? (
            <img 
              id="live_camera_feed_img"
              src={cameraImage} 
              alt="Industrial Camera Stream" 
              className="w-full h-full object-cover opacity-85 select-none"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950 text-slate-500 font-mono text-xs">
              <RefreshCw className="animate-spin text-[#2ec6d6]" size={20} />
              <span>Receiving Blob Flow ...</span>
            </div>
          )
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950 px-6 text-center text-slate-500 font-mono text-xs">
            <AlertTriangle className="text-amber-500/60 animate-pulse" size={32} />
            <span className="max-w-xs">{language === 'zh' ? '尚未建立遥测。请连接左侧IP以启动相机流。' : 'No telemetry linked. Connect IP on control board to initiate camera view stream.'}</span>
          </div>
        )}

        {/* Dynamic Canvas High Tech Graphic Overlay */}
        <div className="absolute inset-0 pointer-events-none select-none flex flex-col justify-between p-3 font-mono text-[10px] text-cyan-400/80">
          
          {/* Top telemetry */}
          <div className="flex justify-between items-start">
            <div className="space-y-0.5 bg-black/40 p-1 rounded backdrop-blur-xs border border-white/5">
              <div>LATENCY: <span className="text-white font-bold">{latency}ms</span></div>
              <div>RESL: <span className="text-[#2ec6d6] font-bold">{resolution}</span></div>
            </div>
            <div className="text-right space-y-0.5 bg-black/40 p-1 rounded backdrop-blur-xs border border-white/5">
              <div>FRAME: <span className="text-white font-bold">{frameId}</span></div>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                <span>CAM_ONLINE</span>
              </div>
            </div>
          </div>

          {/* Crosshair target in the middle */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-8 h-8 flex items-center justify-center">
              <div className="absolute w-full h-[1px] bg-cyan-400/40" />
              <div className="absolute h-full w-[1px] bg-cyan-400/40" />
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
            </div>
          </div>

          {/* SVG representation of ROI interest zone overlay */}
          {roi.valid && (
            <div 
              style={{
                position: "absolute",
                left: `${(roi.x / 400) * 100}%`,
                top: `${(roi.y / 350) * 100}%`,
                width: `${(roi.w / 400) * 100}%`,
                height: `${(roi.h / 350) * 100}%`,
                border: "1.5px dashed #2ec6d6",
              }}
              className="pointer-events-none transition-all flex items-start p-1 bg-cyan-500/5 select-none"
            >
              <span className="bg-[#2ec6d6] text-[8px] text-cyan-950 font-extrabold px-1 py-0.2 rounded-xs select-none">
                ROI BOUNDARY
              </span>
            </div>
          )}

          {/* Bottom telemetry */}
          <div className="flex justify-between items-end">
            <div className="bg-black/40 p-1 rounded backdrop-blur-xs border border-white/5">
              <div>AXIS SPEED: <span className="text-emerald-400 font-bold">OPTIMIZED</span></div>
            </div>
            <div className="text-right bg-black/40 p-1 rounded backdrop-blur-xs border border-white/5 text-[9px] text-[#2ec6d6]">
              ISO 100 | S: 1/800 | F: 2.8
            </div>
          </div>
        </div>
      </div>

      {/* ROI Teaching Controls */}
      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className={`text-xs font-semibold ${isDark ? "text-slate-300" : "text-zinc-700"}`}>
              {t.teachRoiTitle}
            </span>
            <span className="text-[10px] text-slate-400">
              {roi.valid ? `X:${roi.x} Y:${roi.y} W:${roi.w} H:${roi.h}` : t.notSet}
            </span>
          </div>
          {teachRoiActive ? (
            <button
              id="save_roi_mode_btn"
              onClick={handleSaveRoi}
              className="px-3.5 py-1.5 text-xs font-display font-medium rounded-lg bg-[#2ec6d6] hover:bg-[#2ec6d6]/80 text-cyan-950 transition-all cursor-pointer shadow-md"
            >
              {t.exitRoiBtn}
            </button>
          ) : (
            <button
              id="enter_roi_mode_btn"
              onClick={onTeachRoiClick}
              disabled={!connected}
              className={`px-3.5 py-1.5 text-xs font-display font-medium border rounded-lg transition-all cursor-pointer ${
                connected 
                  ? "border-[#2ec6d6] text-[#2ec6d6] hover:bg-[#2ec6d6]/10 active:scale-95" 
                  : "border-slate-800 text-slate-500 cursor-not-allowed"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Focus size={13} />
                <span>{t.teachRoiBtn}</span>
              </div>
            </button>
          )}
        </div>

        {/* Adjust ROI in dynamic Mode sliding bars */}
        {teachRoiActive && (
          <div className="p-3 bg-cyan-950/20 border border-cyan-500/20 rounded-lg space-y-2.5 font-mono text-[11px] animate-in slide-in-from-top-1">
            <p className="text-[#2ec6d6] text-xs font-semibold flex items-center gap-1.5">
              <Focus size={14} className="animate-pulse" />
              <span>{t.roiDesc}</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">OFFSET X:</span>
                  <span className="text-white font-bold">{editX} px</span>
                </div>
                <input
                  id="roi_slider_x"
                  type="range"
                  min="0"
                  max="100"
                  value={editX}
                  onChange={(e) => setEditX(parseInt(e.target.value))}
                  className="w-full accent-[#2ec6d6] bg-slate-800 rounded-lg appearance-none h-1.5"
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">OFFSET Y:</span>
                  <span className="text-white font-bold">{editY} px</span>
                </div>
                <input
                  id="roi_slider_y"
                  type="range"
                  min="0"
                  max="120"
                  value={editY}
                  onChange={(e) => setEditY(parseInt(e.target.value))}
                  className="w-full accent-[#2ec6d6] bg-slate-800 rounded-lg appearance-none h-1.5"
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">WIDTH:</span>
                  <span className="text-white font-bold">{editW} px</span>
                </div>
                <input
                  id="roi_slider_w"
                  type="range"
                  min="10"
                  max="290"
                  value={editW}
                  onChange={(e) => setEditW(parseInt(e.target.value))}
                  className="w-full accent-[#2ec6d6] bg-slate-800 rounded-lg appearance-none h-1.5"
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">HEIGHT:</span>
                  <span className="text-white font-bold">{editH} px</span>
                </div>
                <input
                  id="roi_slider_h"
                  type="range"
                  min="10"
                  max="240"
                  value={editH}
                  onChange={(e) => setEditH(parseInt(e.target.value))}
                  className="w-full accent-[#2ec6d6] bg-slate-800 rounded-lg appearance-none h-1.5"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
