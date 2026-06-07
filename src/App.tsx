/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import { Language, CalibrationData } from "./types";
import { translations } from "./translations";
import ApiDocsModal from "./components/ApiDocsModal";
import CameraView from "./components/CameraView";
import ArmVisualizer from "./components/ArmVisualizer";
import ControlDashboard from "./components/ControlDashboard";
import VisionSheduler from "./components/VisionSheduler";
import LogsPanel from "./components/LogsPanel";
import { Sun, Moon, HelpCircle, Laptop, Settings, Eye, HelpCircle as DocIcon, FileText } from "lucide-react";

export default function App() {
  const [language, setLanguage] = useState<Language>("zh");
  const [isDark, setIsDark] = useState<boolean>(true);
  const [showDocs, setShowDocs] = useState<boolean>(false);

  // Connection & status states
  const [connected, setConnected] = useState<boolean>(false);
  const [ip, setIp] = useState<string>("192.168.1.220");
  const [backendAddress, setBackendAddress] = useState<string>(() => {
    return localStorage.getItem("NEXUS_BACKEND_ADDRESS") || "";
  });

  const getApiUrl = (path: string) => {
    if (!backendAddress) return path;
    let host = backendAddress.trim();
    if (host.startsWith("http://")) host = host.replace("http://", "");
    if (host.startsWith("https://")) host = host.replace("https://", "");
    if (!host.includes(":")) host = `${host}:3000`;
    const protocol = window.location.protocol;
    return `${protocol}//${host}${path}`;
  };

  const getWsUrl = () => {
    if (!backendAddress) {
      const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
      return `${wsProto}//${window.location.host}`;
    }
    let host = backendAddress.trim();
    if (host.startsWith("http://")) host = host.replace("http://", "");
    if (host.startsWith("https://")) host = host.replace("https://", "");
    if (!host.includes(":")) host = `${host}:3000`;
    const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${wsProto}//${host}`;
  };

  const [initialized, setInitialized] = useState<boolean>(false);
  const [robotStatus, setRobotStatus] = useState<string>("制动");
  const [robotStatusCode, setRobotStatusCode] = useState<number>(2);
  const [controllerState, setControllerState] = useState<string>("不允许程序操作和jog");
  const [controllerStateCode, setControllerStateCode] = useState<number>(3);
  const [pose, setPose] = useState<{ x: number; y: number; z: number; u: number }>({
    x: 528.61,
    y: -701.51,
    z: 0.47,
    u: -1.68
  });
  const [speedRatio, setSpeedRatio] = useState<number>(40);
  const [programStatus, setProgramStatus] = useState<string>("空闲");
  const [visionRunning, setVisionRunning] = useState<boolean>(false);
  const [teachRoiActive, setTeachRoiActive] = useState<boolean>(false);
  const [roi, setRoi] = useState<{ valid: boolean; x: number; y: number; w: number; h: number }>({
    valid: true,
    x: 100,
    y: 120,
    w: 300,
    h: 240
  });

  // Calibration outcomes
  const [calib, setCalib] = useState<CalibrationData>({
    status: "idle",
    running: false,
    progress: 0,
    total: 9,
    message: "auto calibration idle",
    errors: [],
    mean_error: 0.0,
    max_error: 0.0
  });

  // Binary WebSocket frame stream
  const [wsBinaryBlob, setWsBinaryBlob] = useState<Blob | null>(null);

  // WS instance reference
  const wsRef = useRef<WebSocket | null>(null);

  // Initialize and maintain WebSocket subscriptions
  useEffect(() => {
    let active = true;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connectWs = () => {
      const wsUrl = getWsUrl();
      
      console.log("Robotic Arm linking telemetry stream:", wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.binaryType = "blob";

      ws.onopen = () => {
        console.log("Industrial telemetry stream open and verified.");
        if (active) {
          // Connected will become true if we established raw WebSocket connection and server simulation has an IP loaded
          // However, for high usability, we can map true if we actually loaded IP on the controller!
          // We will sync connection state properly
        }
      };

      ws.onmessage = async (event) => {
        if (!active) return;

        if (event.data instanceof Blob) {
          // Binary frame representing camera stream update
          setWsBinaryBlob(event.data);
        } else {
          // Text frame representing system JSON telemetry status
          try {
            const payload = JSON.parse(event.data);
            if (payload.type === "sys_status" && payload.data) {
              const d = payload.data;
              setRobotStatus(d.robot_status);
              setRobotStatusCode(d.robot_status_code);
              setControllerState(d.controller_state);
              // Synced controller capability (Allows programs if setup/reg881 is true)
              setControllerStateCode(d.controller_state_code);
              setInitialized(d.controller_state_code === 2 || d.controller_state === "允许程序操作和jog");
              setPose(d.pose);
              setSpeedRatio(d.speed_ratio);
              setProgramStatus(d.program_status);
            } else if (payload.type === "calib_status" && payload.data) {
              const d = payload.data;
              setCalib({
                status: d.status,
                running: d.running,
                progress: d.progress,
                total: d.total,
                message: d.message,
                errors: d.errors || [],
                mean_error: d.mean_error || 0.0,
                max_error: d.max_error || 0.0
              });
            }
          } catch (e) {
            console.error("Telemetry decode exception:", e);
          }
        }
      };

      ws.onclose = () => {
        if (active) {
          console.warn("Robotic Arm stream lost. Retrying hook in 3000ms...");
          reconnectTimeout = setTimeout(connectWs, 3000);
        }
      };

      ws.onerror = (err) => {
        console.error("Industrial line socket exception:", err);
      };
    };

    connectWs();

    return () => {
      active = false;
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [backendAddress]);

  // Periodic poll of connection status & vision module running state to make sure frontend is perfectly aligned
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    const syncStatus = async () => {
      try {
        // Sync API telemetry endpoints to check if server was already connected/configured
        const resPose = await fetch(getApiUrl("/pose_realtime"));
        if (resPose.ok) {
          const json = await resPose.ok ? await resPose.json() : null;
          if (json && json.success) {
            // Server was already alive
            setConnected(true);
            setPose(json.data);
          }
        }

        const resVision = await fetch(getApiUrl("/vision/status"));
        if (resVision.ok) {
          const json = await resVision.json();
          if (json && json.success && json.data) {
            setVisionRunning(json.data.running === 1);
          }
        }

        const resRoi = await fetch(getApiUrl("/get_roi"));
        if (resRoi.ok) {
          const json = await resRoi.json();
          if (json && json.valid) {
            setRoi(json);
          }
        }
      } catch (err) {
        // silent
      }
    };

    syncStatus();
    interval = setInterval(syncStatus, 2500);
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [backendAddress]);

  // REST API Actions
  const handleConnect = async (targetIp: string): Promise<boolean> => {
    try {
      const res = await fetch(getApiUrl(`/connect?ip=${encodeURIComponent(targetIp)}`));
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setConnected(true);
          setIp(targetIp);
          return true;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return false;
  };

  const handleInitialize = async (): Promise<boolean> => {
    try {
      const res = await fetch(getApiUrl("/init"));
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setInitialized(true);
          setControllerState("允许程序操作和jog");
          setControllerStateCode(2);
          return true;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return false;
  };

  const handleEnable = async (): Promise<boolean> => {
    try {
      const res = await fetch(getApiUrl("/start"));
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setRobotStatus("使能");
          setRobotStatusCode(3);
          return true;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return false;
  };

  const handleDisable = async () => {
    try {
      const res = await fetch(getApiUrl("/stop"));
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setRobotStatus("制动");
          setRobotStatusCode(2);
          setVisionRunning(false);
          return true;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return false;
  };

  const handleClearError = async (): Promise<boolean> => {
    try {
      const res = await fetch(getApiUrl("/clear_error"));
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setRobotStatus("使能");
          setRobotStatusCode(3);
          return true;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return false;
  };

  const handleTriggerSimError = async () => {
    try {
      // Secret error simulator router on host
      const res = await fetch(getApiUrl("/sim_trigger_error"));
      if (res.ok) {
        setRobotStatus("错误");
        setRobotStatusCode(1);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSpeedRatioChange = async (val: number): Promise<boolean> => {
    try {
      const res = await fetch(getApiUrl(`/speedratio?value=${val}`));
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setSpeedRatio(val);
          return true;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return false;
  };

  const handleJog = async (
    axis: "X" | "Y" | "Z" | "U",
    dir: 1 | -1,
    dist: number
  ): Promise<boolean> => {
    try {
      const res = await fetch(getApiUrl(`/jog_step?axis=${axis}&dir=${dir}&dist=${dist}`));
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          // Immediately poll and increment coordinates
          const offset = dir * dist;
          setPose((prev) => {
            const next = { ...prev };
            if (axis === "X") next.x = parseFloat((next.x + offset).toFixed(2));
            if (axis === "Y") next.y = parseFloat((next.y + offset).toFixed(2));
            if (axis === "Z") next.z = parseFloat((next.z + offset).toFixed(2));
            if (axis === "U") next.u = parseFloat((next.u + offset).toFixed(2));
            return next;
          });
          return true;
        } else {
          alert(`Jog failed: ${json.data || 'Servo check required'}`);
        }
      }
    } catch (e) {
      console.error(e);
    }
    return false;
  };

  const handleTriggerCalibration = async (): Promise<boolean> => {
    try {
      const res = await fetch(getApiUrl("/autocalib"));
      if (res.ok) {
        const json = await res.json();
        return json.success;
      }
    } catch (e) {
      console.error(e);
    }
    return false;
  };

  const handleStartSorting = async () => {
    try {
      const res = await fetch(getApiUrl("/vision/start"), { method: "POST" });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setVisionRunning(true);
          setRobotStatus("运行");
          setRobotStatusCode(4);
          return true;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return false;
  };

  const handleStopSorting = async () => {
    try {
      const res = await fetch(getApiUrl("/vision/stop"), { method: "POST" });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setVisionRunning(false);
          setRobotStatus("使能");
          setRobotStatusCode(3);
          return true;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return false;
  };

  const handleTeachRoiSave = async (dimensions: { x: number; y: number; w: number; h: number }) => {
    try {
      const res = await fetch(getApiUrl("/set_roi"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dimensions)
      });
      if (res.ok) {
        const text = await res.text();
        if (text.includes("ROI SAVED")) {
          // Success update
          setRoi({ valid: true, ...dimensions });
          setTeachRoiActive(false);
        } else {
          alert(`ROI save outcome: ${text}`);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTeachRoiClick = async () => {
    try {
      const res = await fetch(getApiUrl("/teach_roi/start"), { method: "POST" });
      if (res.ok) {
        const text = await res.text();
        if (text.includes("ROI TEACH MODE ON")) {
          setTeachRoiActive(true);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const t = translations[language];

  // Colors mapping corresponding to selected theme state & logo (0x2ec6d6)
  const themeAccentStyle = "#2ec6d6"; // Main brand cyan theme
  const outerBg = isDark ? "bg-[#0a0e17] text-slate-300" : "bg-zinc-50 text-zinc-700";
  const innerCardBg = isDark ? "bg-slate-900/60 border-slate-800/80" : "bg-white border-zinc-200/80";
  
  return (
    <div className={`min-h-screen ${outerBg} font-sans transition-colors duration-300 relative flex flex-col`}>

      {/* Modern Compact Header */}
      <header className={`sticky top-0 z-40 backdrop-blur-md border-b transition-all ${
        isDark ? "bg-[#0a0e17]/85 border-slate-800/80" : "bg-white/85 border-zinc-200"
      }`}>
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          
          {/* Logo Brand area */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-cyan-950/40 border border-cyan-400 text-[#2ec6d6] overflow-hidden shadow-inner">
              <span className="font-display font-black text-sm tracking-wider">Ω</span>
              <div className="absolute inset-0 bg-[#2ec6d6] opacity-10 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display font-extrabold text-sm sm:text-base tracking-tight text-white logo-glow uppercase flex items-center">
                  <span className="text-[#2ec6d6]">NEXUS</span>&nbsp;
                  <span className={isDark ? "text-slate-300" : "text-zinc-800"}>SCARA</span>
                </h1>
                <span className="text-[9px] font-mono font-bold bg-[#2ec6d6]/10 text-[#2ec6d6] px-1 py-0.2 rounded border border-[#2ec6d6]/20">
                  SINGLE ARM
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-mono hidden sm:block">
                {t.subtitle}
              </p>
            </div>
          </div>

          {/* Quick HUD overall stats overlay strip */}
          {connected && (
            <div className="hidden lg:flex items-center gap-3.5 font-mono text-[10px] bg-slate-950/40 px-3 py-1.5 rounded-lg border border-slate-800/30">
              <span className="text-slate-500">ARM: <span className="text-[#2ec6d6] font-bold">{ip || "192.168.1.220"}</span></span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-500">BACKEND: <span className="text-amber-400 font-bold">{backendAddress || window.location.host}</span></span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-500">INIT: <span className={initialized ? "text-[#2ec6d6]" : "text-amber-500"}>{initialized ? "OK" : "NULL"}</span></span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-500">POSE: <span className="text-[#2ec6d6]">X:{pose.x.toFixed(1)} Y:{pose.y.toFixed(1)} Z:{pose.z.toFixed(1)}</span></span>
              <button 
                id="header_disconnect_btn"
                onClick={() => setConnected(false)}
                className="ml-1 px-1.5 py-0.5 bg-rose-950/45 text-rose-400 border border-rose-800/40 hover:bg-rose-900/60 rounded text-[9px] cursor-pointer transition-all active:scale-95"
              >
                {language === 'zh' ? '断开并重配' : 'Disconnect'}
              </button>
            </div>
          )}

          {/* Action controllers buttons */}
          <div className="flex items-center gap-2.5">
            
            {/* 1. Api Document Button */}
            <button
              id="view_api_docs_btn"
              onClick={() => setShowDocs(true)}
              className="p-2 rounded-lg border text-slate-400 hover:text-white transition-all cursor-pointer border-slate-700/80 hover:border-cyan-400/40 bg-slate-900/30"
              title={t.apiDoc}
            >
              <div className="flex items-center gap-1.5 px-1 font-mono text-[11px] font-semibold text-cyan-300">
                <FileText size={15} />
                <span className="hidden md:inline">{t.apiDoc}</span>
              </div>
            </button>

            {/* 2. Style Theme Switch (明暗风格转换) */}
            <button
              id="mode_theme_toggle"
              onClick={() => setIsDark(!isDark)}
              className="p-2 rounded-lg border border-slate-700/80 hover:border-cyan-400/40 bg-slate-900/30 text-slate-400 hover:text-white transition-all cursor-pointer active:scale-95"
              title={isDark ? "Light Mode" : "Dark Mode"}
            >
              {isDark ? <Sun size={15} className="text-[#2ec6d6]" /> : <Moon size={15} className="text-cyan-600" />}
            </button>

            {/* 3. Internationalization languages Select switch (中英日韩) */}
            <div className="flex items-center border border-slate-700/80 rounded-lg p-0.5 bg-slate-900/30">
              {(["zh", "en", "ja", "ko"] as Language[]).map((lang) => (
                <button
                  id={`lang_switch_${lang}`}
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={`px-2.5 py-1 text-[10px] font-display font-medium rounded transition-all cursor-pointer ${
                    language === lang
                      ? "bg-[#2ec6d6] text-cyan-950 font-bold shadow-xs"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>

          </div>

        </div>
      </header>

      {/* Main Container Area with Bento Style Grid layout */}
      <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
        
        {connected ? (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            
            {/* LEFT HALF COLUMN: TELEMETRY AND LIVESTEP ANIMATOR */}
            <div className="xl:col-span-5 space-y-6">
              
              {/* Dynamic Camera Feed stream */}
              <CameraView
                language={language}
                connected={connected}
                isDark={isDark}
                roi={roi}
                onTeachRoiClick={handleTeachRoiClick}
                onTeachRoiSave={handleTeachRoiSave}
                teachRoiActive={teachRoiActive}
                wsBinaryBlob={wsBinaryBlob}
              />

              {/* Graphical single robotic arm monitor schematic */}
              <ArmVisualizer
                language={language}
                pose={pose}
                robotStatus={robotStatus}
                isDark={isDark}
                visionRunning={visionRunning}
              />

            </div>

            {/* RIGHT HALF COLUMN: CONFIGURATION CONTROLLERS AND LOGS */}
            <div className="xl:col-span-7 space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
                
                {/* Manual control values dashboard */}
                <ControlDashboard
                  language={language}
                  connected={connected}
                  ip={ip}
                  onConnect={handleConnect}
                  initialized={initialized}
                  onInitialize={handleInitialize}
                  robotStatus={robotStatus}
                  robotStatusCode={robotStatusCode}
                  onEnable={handleEnable}
                  onDisable={handleDisable}
                  onClearError={handleClearError}
                  onTriggerSimError={handleTriggerSimError}
                  speedRatio={speedRatio}
                  onSpeedRatioChange={handleSpeedRatioChange}
                  onJog={handleJog}
                  calib={calib}
                  onTriggerCalibration={handleTriggerCalibration}
                  isDark={isDark}
                />

                {/* Sorter Engine Scheduling and point teaching */}
                <VisionSheduler
                  language={language}
                  connected={connected}
                  visionRunning={visionRunning}
                  onStartVision={handleStartSorting}
                  onStopVision={handleStopSorting}
                  pose={pose}
                  isDark={isDark}
                  getApiUrl={getApiUrl}
                />

                {/* Industrial Database logging search logs */}
                <LogsPanel
                  language={language}
                  connected={connected}
                  isDark={isDark}
                  getApiUrl={getApiUrl}
                />

              </div>

            </div>

          </div>
        ) : (
          /* Offline/Initial Connection Gateway Setup Card */
          <div className="max-w-md mx-auto my-12 animate-in fade-in zoom-in-95 duration-300">
            <div className={`p-6 rounded-2xl border ${innerCardBg} box-glow space-y-5 text-center`}>
              
              <div className="mx-auto w-12 h-12 rounded-full bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-center text-[#2ec6d6]">
                <Settings className="animate-spin" size={24} />
              </div>

              <div className="space-y-1">
                <h3 className={`font-display font-extrabold text-lg ${isDark ? "text-white" : "text-zinc-800"}`}>
                  {t.title}
                </h3>
                <p className="text-xs text-slate-400">
                  {language === 'zh'
                    ? '请填写网卡连接参数以启动 NEXUS 控制网关' 
                    : 'Configure control endpoints and start NEXUS operations gateway'}
                </p>
              </div>

              <div className="space-y-4 pt-2 text-left">
                {/* 1. Robotic Arm IP */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider font-mono block">
                    {t.armIpAddress}
                  </label>
                  <input
                    id="gateway_ip_input"
                    type="text"
                    value={ip || "192.168.1.220"}
                    onChange={(e) => setIp(e.target.value)}
                    className={`w-full px-4 py-2 font-mono text-sm rounded-xl border outline-none text-center ${
                      isDark 
                        ? "bg-slate-950 border-slate-800 text-[#2ec6d6] focus:border-cyan-400" 
                        : "bg-zinc-50 border-zinc-200 text-zinc-800 focus:border-cyan-600"
                    }`}
                    placeholder="192.168.1.220"
                  />
                </div>

                {/* 2. Backend Service Host IP */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider font-mono block">
                    {t.backendAddress}
                  </label>
                  <input
                    id="backend_host_ip_input"
                    type="text"
                    value={backendAddress}
                    onChange={(e) => {
                      const val = e.target.value;
                      setBackendAddress(val);
                      localStorage.setItem("NEXUS_BACKEND_ADDRESS", val);
                    }}
                    className={`w-full px-4 py-2 font-mono text-sm rounded-xl border outline-none text-center ${
                      isDark 
                        ? "bg-slate-950 border-slate-800 text-[#ccc] focus:border-cyan-400" 
                        : "bg-zinc-50 border-zinc-200 text-zinc-800 focus:border-cyan-600"
                    }`}
                    placeholder={t.backendAddressPlaceholder}
                  />
                  <span className="text-[9px] text-slate-400 font-mono block leading-normal text-center">
                    {language === 'zh' 
                      ? '💡 真正提供后端接口的业务服务主机 IP 地址(留空则默认当前网页地址)' 
                      : '💡 Host executing backend control proxy (Leave empty for current host)'}
                  </span>
                </div>
              </div>

              <button
                id="connect_gateway_btn"
                onClick={() => handleConnect(ip || "192.168.1.220")}
                className="w-full py-3 bg-[#2ec6d6] text-cyan-950 font-display font-bold rounded-xl hover:bg-[#2ec6d6]/80 active:scale-95 transition-all text-sm cursor-pointer shadow-md mt-2"
              >
                {t.connectBtn}
              </button>

              <div className="pt-2 text-[10px] text-slate-500 font-mono uppercase tracking-wider text-center flex justify-center gap-1.5 items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span>NEXUS CONTROLLER OFFLINE</span>
              </div>

            </div>
          </div>
        )}

      </main>

      {/* Floating API Docs Backdrop modal portal */}
      {showDocs && (
        <ApiDocsModal
          language={language}
          onClose={() => setShowDocs(false)}
        />
      )}

      {/* Industrial Footer branding */}
      <footer className={`mt-auto py-4 border-t text-center font-mono text-[9px] text-slate-500 ${
        isDark ? "bg-[#070b12] border-slate-800/40" : "bg-zinc-100 border-zinc-200"
      }`}>
        <div className="max-w-[1400px] mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-slate-500">
          <span>&copy; 2026 NEXUS INDUSTRIAL SYSTEM TECHNOLOGY INC.</span>
          <span className="text-[#2ec6d6]">SYS_PORT: 3000 | CORE_WS: VALIDATED</span>
        </div>
      </footer>

    </div>
  );
}

