import { useState, useEffect } from "react";
import { Language } from "../types";
import { translations } from "../translations";
import { Eye, Hammer, Play, Square, MapPin, Check, Plus } from "lucide-react";

interface VisionShedulerProps {
  language: Language;
  connected: boolean;
  visionRunning: boolean;
  onStartVision: () => Promise<boolean>;
  onStopVision: () => Promise<boolean>;
  pose: { x: number; y: number; z: number; u: number };
  isDark: boolean;
  getApiUrl?: (path: string) => string;
}

export default function VisionSheduler({
  language,
  connected,
  visionRunning,
  onStartVision,
  onStopVision,
  pose,
  isDark,
  getApiUrl
}: VisionShedulerProps) {
  const t = translations[language];

  const getUrl = (path: string) => {
    return getApiUrl ? getApiUrl(path) : path;
  };

  // Point teach state tracking
  interface PointsState {
    pick: boolean;
    place: boolean[];
  }

  const [points, setPoints] = useState<PointsState>({
    pick: true,
    place: [true, false, true]
  });

  const [notif, setNotif] = useState<string | null>(null);

  // Poll current teach points state from the server
  const fetchPoints = async () => {
    if (!connected) return;
    try {
      const res = await fetch(getUrl("/get_points"));
      if (res.ok) {
        const json = await res.json();
        // Since get_points returns { pick: boolean, place: boolean[] } custom JSON format
        setPoints({
          pick: !!json.pick,
          place: Array.isArray(json.place) ? json.place : [false, false, false]
        });
      }
    } catch (e) {
      // ignore silently
    }
  };

  useEffect(() => {
    fetchPoints();
  }, [connected]);

  const handleTeachPick = async () => {
    if (!connected) return;
    try {
      const res = await fetch(getUrl("/teach_point"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "pick" })
      });
      if (res.ok) {
        const text = await res.text();
        if (text.trim() === "OK") {
          setNotif("PICK_TEACH_OK");
          setTimeout(() => setNotif(null), 2500);
          fetchPoints();
        } else {
          alert(`Teach Pick Failed: ${text}`);
        }
      }
    } catch (e) {
      alert(`Network error: ${e}`);
    }
  };

  const handleTeachPlace = async (index: number) => {
    if (!connected) return;
    try {
      const res = await fetch(getUrl("/teach_point"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "place", index })
      });
      if (res.ok) {
        const text = await res.text();
        if (text.trim() === "OK") {
          setNotif(`PLACE_TEACH_${index}_OK`);
          setTimeout(() => setNotif(null), 2500);
          fetchPoints();
        } else {
          alert(`Teach Place ${index} Failed: ${text}`);
        }
      }
    } catch (e) {
      alert(`Network error: ${e}`);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Start and Stop Vision Sorting module */}
      <div className={`p-4 rounded-xl border transition-all ${
        isDark ? "bg-slate-900/80 border-slate-800" : "bg-white border-zinc-200 shadow-sm"
      }`}>
        <h4 className="flex items-center gap-2 font-display font-bold text-sm mb-3 text-[#2ec6d6]">
          <Eye size={16} />
          <span>{t.visionModule}</span>
        </h4>

        <div className="p-3.5 rounded-lg bg-cyan-950/20 border border-cyan-500/10 mb-4 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] text-slate-400 block font-mono">
              {t.sortingState}:
            </span>
            <span className={`text-xs font-mono font-bold ${visionRunning ? "text-[#2ec6d6]" : "text-slate-400"}`}>
              {visionRunning ? t.running : t.idle}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${visionRunning ? "bg-[#2ec6d6] animate-ping" : "bg-slate-700"}`} />
            <span className="text-[9px] font-mono font-bold text-slate-500">SORT_ENGINE</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            id="start_sorting_engine_btn"
            onClick={onStartVision}
            disabled={!connected || visionRunning}
            className={`py-2 text-xs font-display font-semibold rounded-lg shadow-sm cursor-pointer transition-all ${
              connected && !visionRunning
                ? "bg-[#2ec6d6] text-cyan-950 hover:bg-[#2ec6d6]/80 active:scale-95"
                : "bg-slate-800 text-slate-600 cursor-not-allowed"
            }`}
          >
            <div className="flex items-center justify-center gap-1.5">
              <Play size={12} fill="currentColor" />
              <span>{t.startVision}</span>
            </div>
          </button>

          <button
            id="stop_sorting_engine_btn"
            onClick={onStopVision}
            disabled={!connected || !visionRunning}
            className={`py-2 text-xs font-display font-semibold rounded-lg shadow-sm cursor-pointer transition-all ${
              connected && visionRunning
                ? "bg-rose-600 hover:bg-rose-700 text-white active:scale-95"
                : "bg-slate-800 text-slate-600 cursor-not-allowed"
            }`}
          >
            <div className="flex items-center justify-center gap-1.5">
              <Square size={12} fill="currentColor" />
              <span>{t.stopVision}</span>
            </div>
          </button>
        </div>
      </div>

      {/* 2. Place Points Teach Control */}
      <div className={`p-4 rounded-xl border transition-all ${
        isDark ? "bg-slate-900/80 border-slate-800" : "bg-white border-zinc-200 shadow-sm"
      }`}>
        <div className="flex items-center justify-between mb-3.5 pb-2 border-b border-cyan-500/10">
          <h4 className="flex items-center gap-2 font-display font-bold text-sm text-[#2ec6d6]">
            <Hammer size={16} />
            <span>{t.pointsTitle}</span>
          </h4>
          <span className="text-[10px] font-mono text-slate-400 bg-slate-950/40 px-2 py-0.5 rounded">
            POSE SYNCED
          </span>
        </div>

        <p className="text-[11px] text-slate-400 mb-4 font-mono leading-relaxed bg-slate-950/20 p-2 rounded border border-white/5">
          👉 {language === 'zh' 
            ? "示教当前位姿可以快速记录物理关节与坐标，作为抓取放置参考位置点。请先通过 Jog 移动到位，再行一键设置示教点。" 
            : "Teaching is completed by jogging arm coordinates to target physical points on sorting desktop first, then click save."}
        </p>

        {/* Notifications HUD */}
        {notif && (
          <div className="p-2 mb-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 font-mono text-[10px] text-center animate-pulse">
            ✓ REGISTER_POINT SUCCESS: {notif}
          </div>
        )}

        <div className="space-y-3.5 font-mono text-xs">
          
          {/* Pick point teach item */}
          <div className={`p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            isDark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-zinc-100"
          }`}>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <MapPin size={14} className="text-[#2ec6d6]" />
                <span className={isDark ? "text-white" : "text-zinc-800"}>{t.pickPoint}</span>
              </div>
              <div className="text-[10px] text-slate-500">
                STATUS: {points.pick ? (
                  <span className="text-emerald-400 font-bold">● {t.setSuccess}</span>
                ) : (
                  <span className="text-slate-400 font-bold">○ {t.notSet}</span>
                )}
              </div>
            </div>
            <button
              id="teach_pick_btn"
              onClick={handleTeachPick}
              disabled={!connected}
              className="px-3.5 py-1.5 text-[10.5px] font-semibold font-display tracking-tight bg-[#2ec6d6]/10 border border-[#2ec6d6]/60 hover:bg-[#2ec6d6]/20 text-[#2ec6d6] rounded-md transition-all cursor-pointer active:scale-95 disabled:cursor-not-allowed"
            >
              {t.teachCurPose}
            </button>
          </div>

          {/* Place point 0, 1, 2 items */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              {t.placePoints} (3 Sinks):
            </span>

            {[0, 1, 2].map((idx) => (
              <div 
                id={`place_teach_item_${idx}`}
                key={idx} 
                className={`p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isDark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-zinc-100"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <MapPin size={14} className="text-amber-500" />
                    <span className={isDark ? "text-white" : "text-zinc-800"}>Place Area [{idx}]</span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    STATUS: {points.place[idx] ? (
                      <span className="text-emerald-400 font-bold">● {t.setSuccess}</span>
                    ) : (
                      <span className="text-slate-400 font-bold">○ {t.notSet}</span>
                    )}
                  </div>
                </div>
                <button
                  id={`teach_place_btn_${idx}`}
                  onClick={() => handleTeachPlace(idx)}
                  disabled={!connected}
                  className="px-3.5 py-1.5 text-[10.5px] font-semibold font-display tracking-tight bg-slate-800 border border-slate-700 hover:border-[#2ec6d6]/50 text-slate-300 hover:text-white rounded-md transition-all cursor-pointer active:scale-95 disabled:cursor-not-allowed"
                >
                  {t.teachCurPose}
                </button>
              </div>
            ))}
          </div>

        </div>
      </div>

    </div>
  );
}
