import { useEffect, useState } from "react";
import { Language } from "../types";
import { translations } from "../translations";
import { Zap, Disc, ArrowRightLeft, Move } from "lucide-react";

interface ArmVisualizerProps {
  language: Language;
  pose: { x: number; y: number; z: number; u: number };
  robotStatus: string;
  isDark: boolean;
  visionRunning: boolean;
}

export default function ArmVisualizer({
  language,
  pose,
  robotStatus,
  isDark,
  visionRunning
}: ArmVisualizerProps) {
  const t = translations[language];
  const [cargoPos, setCargoPos] = useState<number>(0);
  const [grabbing, setGrabbing] = useState<boolean>(false);
  const [targetBox, setTargetBox] = useState<number>(-1);

  // Math equations mapping physical pose coordinates to SVG visual anchors
  // Base at (150, 130)
  // End effector is calculated dynamically using X and Y values
  // We'll normalize X (typically 400-600) and Y (typically -750 to -650) to local coordinates inside standard SVG
  const normalizedX = Math.min(Math.max(((pose.x - 400) / 300) * 150 + 150, 80), 280);
  const normalizedY = Math.min(Math.max(((Math.abs(pose.y) - 600) / 200) * 100 + 40, 30), 150);
  const jointZHeight = Math.min(Math.max((pose.z / 30) * 40, 2), 60); // height offset for Z axis
  const angleTheta = pose.u; // Rotation joint angle

  // If vision running is active, animate cargo block advancing on a conveyor belt!
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (visionRunning) {
      interval = setInterval(() => {
        setCargoPos((prev) => {
          const next = prev + 3;
          if (next > 110) {
            // Picked up by robotic arm
            setGrabbing(true);
            const boxIdx = Math.floor(Math.random() * 3);
            setTargetBox(boxIdx);
            setTimeout(() => {
              setGrabbing(false);
            }, 1200);
            return 0; // reset feed
          }
          return next;
        });
      }, 100);
    } else {
      setCargoPos(0);
      setGrabbing(false);
      setTargetBox(-1);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [visionRunning]);

  return (
    <div className={`rounded-xl border p-4 transition-all relative overflow-hidden ${
      isDark ? "bg-slate-900/80 border-slate-800" : "bg-white border-zinc-200 shadow-sm"
    }`}>
      
      {/* Title */}
      <div className="flex items-center justify-between mb-3 border-b pb-2 border-cyan-500/10">
        <div className="flex items-center gap-2">
          <Zap className="text-[#2ec6d6]" size={18} />
          <span className={`font-display font-bold text-sm ${isDark ? "text-white" : "text-zinc-800"}`}>
            {t.conveyorAnim}
          </span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[10px]">
          <span className={`px-2 py-0.5 rounded font-bold ${
            robotStatus === "运行" || visionRunning
              ? "bg-[#2ec6d6]/20 text-[#2ec6d6] animate-pulse" 
              : "bg-slate-700/20 text-slate-400"
          }`}>
             {robotStatus === "运行" || visionRunning ? "ACTIVE MOTION" : "MOTOR DISARMED"}
          </span>
        </div>
      </div>

      {/* Vector Arm Scene canvas height wrapper */}
      <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden bg-slate-950 border border-slate-800/60 p-2 select-none">
        
        {/* Background industrial coordinates schema grids */}
        <div className="absolute inset-0 grid grid-cols-8 grid-rows-6 pointer-events-none opacity-[0.03]">
          {Array.from({ length: 48 }).map((_, idx) => (
            <div key={idx} className="border-r border-b border-cyan-400" />
          ))}
        </div>

        {/* High tension telemetry readout in background */}
        <div className="absolute top-2 left-3 font-mono text-[10px] text-slate-600/80 space-y-0.5">
          <div>FEED RATE: {visionRunning ? "1.2 M/S" : "0.0 M/S"}</div>
          <div>INSPECTION MODEL: RESNET_SCARA_V3</div>
          <div>SORT COUNTER: <span className="text-[#2ec6d6]">1,284 OK</span></div>
        </div>

        {/* 2D Vector Graphic Engine SVG */}
        <svg className="w-full h-full" viewBox="0 0 320 240">
          
          {/* Legend marker lines */}
          <line x1="20" y1="210" x2="300" y2="210" stroke="#1e293b" strokeWidth="2" strokeDasharray="4 4" />
          
          {/* Conveyor Belt bottom tracks */}
          <rect x="20" y="170" width="120" height="12" rx="3" fill="#1e293b" />
          {/* Conveyor rotating spindles */}
          <circle cx="30" cy="176" r="4" fill="#64748b" className="animate-spin" />
          <circle cx="70" cy="176" r="4" fill="#64748b" className="animate-spin" />
          <circle cx="110" cy="176" r="4" fill="#64748b" className="animate-spin" />
          <line x1="20" y1="176" x2="130" y2="176" stroke="#475569" strokeWidth="1.5" />

          {/* Place boxes (Place index 0, 1, 2) on the right */}
          <g>
            {/* Box 0 */}
            <rect x="180" y="165" width="30" height="20" rx="2" fill="none" stroke={targetBox === 0 && grabbing ? "#2ec6d6" : "#475569"} strokeWidth="1.5" />
            <text x="195" y="179" fill="#64748b" fontSize="8" fontFamily="monospace" textAnchor="middle">PL0</text>
            
            {/* Box 1 */}
            <rect x="220" y="165" width="30" height="20" rx="2" fill="none" stroke={targetBox === 1 && grabbing ? "#2ec6d6" : "#475569"} strokeWidth="1.5" />
            <text x="235" y="179" fill="#64748b" fontSize="8" fontFamily="monospace" textAnchor="middle">PL1</text>
            
            {/* Box 2 */}
            <rect x="260" y="165" width="30" height="20" rx="2" fill="none" stroke={targetBox === 2 && grabbing ? "#2ec6d6" : "#475569"} strokeWidth="1.5" />
            <text x="275" y="179" fill="#64748b" fontSize="8" fontFamily="monospace" textAnchor="middle">PL2</text>
          </g>

          {/* Material sorting package sliding block */}
          {visionRunning && (
            <g transform={`translate(${20 + cargoPos}, 156)`}>
              {!grabbing && (
                <rect x="0" y="0" width="14" height="10" rx="1.5" fill="#2ec6d6" opacity="0.8" className="animate-pulse" />
              )}
            </g>
          )}

          {/* SINGLE INDUSTRIAL ROBOTIC ARM RENDER */}
          <g>
            {/* 1. Arm Pedestal Base */}
            <rect x="140" y="120" width="40" height="25" rx="3" fill="#334155" />
            <rect x="150" y="105" width="20" height="15" fill="#475569" />
            {/* Joint Core circle */}
            <circle cx="160" cy="115" r="5" fill="#2ec6d6" />

            {/* 2. Main Segments Arm (Joint 1 to Joint 2) */}
            {/* Anchor coordinate math: Starts at Base (160, 115) and stretches to (normalizedX, normalizedY) */}
            <line 
              x1="160" 
              y1="115" 
              x2={normalizedX} 
              y2={normalizedY} 
              stroke="#64748b" 
              strokeWidth="7" 
              strokeLinecap="round" 
            />
            {/* Core inner link highlight */}
            <line 
              x1="160" 
              y1="115" 
              x2={normalizedX} 
              y2={normalizedY} 
              stroke="#2ec6d6" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
            />

            {/* 3. Joint 2: elbow */}
            <circle cx={normalizedX} cy={normalizedY} r="6" fill="#334155" stroke="#2ec6d6" strokeWidth="1" />

            {/* 4. Second Segment (Forearm / Z Shaft) */}
            {/* Drop vertically towards estimated workspace coordinate (normalizedX, normalizedY + jointZHeight) */}
            <line 
              x1={normalizedX} 
              y1={normalizedY} 
              x2={normalizedX} 
              y2={normalizedY + jointZHeight} 
              stroke="#94a3b8" 
              strokeWidth="4" 
              strokeLinecap="round" 
            />
            {/* Horizontal Tool Holder */}
            <line 
              x1={normalizedX - 8} 
              y1={normalizedY + jointZHeight} 
              x2={normalizedX + 8} 
              y2={normalizedY + jointZHeight} 
              stroke="#475569" 
              strokeWidth="2.5" 
            />

            {/* 5. Tool Gripper (Left / Right Prongs, rotating by U u-angle) */}
            <g transform={`translate(${normalizedX}, ${normalizedY + jointZHeight}) rotate(${angleTheta * 20})`}>
              {/* Gripper core */}
              <rect x="-4" y="0" width="8" height="4" fill="#334155" />
              {/* Left Prong */}
              <line x1="-4" y1="4" x2="-4" y2="10" stroke="#2ec6d6" strokeWidth="1.5" />
              {/* Right Prong */}
              <line x1="4" y1="4" x2="4" y2="10" stroke="#2ec6d6" strokeWidth="1.5" />

              {/* If grabbing and moving cargo, render cargo block inside the gripper claw! */}
              {grabbing && (
                <rect x="-6" y="6" width="12" height="8" rx="1.5" fill="#2ec6d6" className="animate-pulse" />
              )}
            </g>
          </g>

          {/* Coordinate text Overlay near end effector */}
          <g transform={`translate(${normalizedX + 15}, ${normalizedY + jointZHeight + 10})`}>
            <rect x="-4" y="-8" width="65" height="11" rx="2" fill="#0f172a" opacity="0.8" />
            <text x="2" y="0" fill="#2ec6d6" fontSize="7" fontFamily="monospace">
              Z:{pose.z.toFixed(1)} U:{pose.u.toFixed(1)}°
            </text>
          </g>

          {/* Base Coordinates Telemetry */}
          <text x="160" y="155" fill="#64748b" fontSize="8" fontFamily="monospace" textAnchor="middle">
            X:{pose.x.toFixed(1)} Y:{pose.y.toFixed(1)}
          </text>
        </svg>

        {/* Dynamic Angles indicator circular widgets */}
        <div className="absolute bottom-2 right-3 flex items-center gap-2 font-mono text-[9px] text-[#2ec6d6]">
          <Disc size={11} className="animate-spin text-cyan-400" />
          <span>AXIS RETRIEVER: REAL-TIME SECURED</span>
        </div>
      </div>

      {/* Manual coordinates reading */}
      <div className="mt-3 grid grid-cols-4 gap-2 font-mono text-center">
        <div className={`p-2 rounded border ${isDark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-zinc-100"}`}>
          <div className="text-[10px] text-slate-400">COORD X</div>
          <div className="text-xs font-bold text-[#2ec6d6]">{pose.x.toFixed(2)}</div>
        </div>
        <div className={`p-2 rounded border ${isDark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-zinc-100"}`}>
          <div className="text-[10px] text-slate-400">COORD Y</div>
          <div className="text-xs font-bold text-[#2ec6d6]">{pose.y.toFixed(2)}</div>
        </div>
        <div className={`p-2 rounded border ${isDark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-zinc-100"}`}>
          <div className="text-[10px] text-slate-400">COORD Z</div>
          <div className="text-xs font-bold text-[#2ec6d6]">{pose.z.toFixed(2)}</div>
        </div>
        <div className={`p-2 rounded border ${isDark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-zinc-100"}`}>
          <div className="text-[10px] text-slate-400">ANGLE U</div>
          <div className="text-xs font-bold text-[#2ec6d6]">{pose.u.toFixed(2)}°</div>
        </div>
      </div>
    </div>
  );
}
