import { useState, useEffect, ChangeEvent } from "react";
import { Language, CalibrationData } from "../types";
import { translations } from "../translations";
import { 
  Link, Play, Square, AlertTriangle, ShieldCheck, 
  Settings, Gauge, Sparkles, Navigation2, ZapOff, CheckCircle 
} from "lucide-react";

interface ControlDashboardProps {
  language: Language;
  connected: boolean;
  ip: string;
  onConnect: (ip: string) => Promise<boolean>;
  initialized: boolean;
  onInitialize: () => Promise<boolean>;
  robotStatus: string;
  robotStatusCode: number;
  onEnable: () => Promise<boolean>;
  onDisable: () => Promise<boolean>;
  onClearError: () => Promise<boolean>;
  onTriggerSimError: () => Promise<void>;
  speedRatio: number;
  onSpeedRatioChange: (val: number) => Promise<boolean>;
  onJog: (axis: "X" | "Y" | "Z" | "U", dir: 1 | -1, dist: number) => Promise<boolean>;
  calib: CalibrationData;
  onTriggerCalibration: () => Promise<boolean>;
  isDark: boolean;
}

export default function ControlDashboard({
  language,
  connected,
  ip,
  onConnect,
  initialized,
  onInitialize,
  robotStatus,
  robotStatusCode,
  onEnable,
  onDisable,
  onClearError,
  onTriggerSimError,
  speedRatio,
  onSpeedRatioChange,
  onJog,
  calib,
  onTriggerCalibration,
  isDark
}: ControlDashboardProps) {
  const t = translations[language];

  // IP connection state helpers
  const [inputIp, setInputIp] = useState<string>("192.168.1.220");
  const [connecting, setConnecting] = useState<boolean>(false);
  const [localSpeedRatio, setLocalSpeedRatio] = useState<number>(speedRatio);

  // Sync speed ratio values on change
  useEffect(() => {
    setLocalSpeedRatio(speedRatio);
  }, [speedRatio]);

  // Jog parameters states
  const [selectedAxis, setSelectedAxis] = useState<"X" | "Y" | "Z" | "U">("X");
  const [jogDir, setJogDir] = useState<1 | -1>(1);
  const [jogDist, setJogDist] = useState<number>(10);

  const handleConnectClick = async () => {
    setConnecting(true);
    const success = await onConnect(inputIp);
    setConnecting(false);
  };

  const handleSpeedSliderChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    setLocalSpeedRatio(val);
  };

  const handleSpeedRelease = async () => {
    await onSpeedRatioChange(localSpeedRatio);
  };

  const handleJogClick = async () => {
    await onJog(selectedAxis, jogDir, jogDist);
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Device Connections Bento Item */}
      <div className={`p-4 rounded-xl border transition-all ${
        isDark ? "bg-slate-900/80 border-slate-800" : "bg-white border-zinc-200 shadow-sm"
      }`}>
        <h4 className="flex items-center gap-2 font-display font-bold text-sm mb-3 text-[#2ec6d6]">
          <Link size={16} />
          <span>{language === 'zh' ? '第一步：建立通信连接' : 'Step 1: Connect Controller'}</span>
        </h4>

        <div className="flex flex-col sm:flex-row items-stretch gap-3">
          <div className="relative flex-1">
            <input
              id="controller_ip_input"
              type="text"
              value={inputIp}
              onChange={(e) => setInputIp(e.target.value)}
              placeholder="192.168.1.220"
              disabled={connected}
              className={`w-full px-3 py-2 text-xs font-mono rounded-lg border transition-all outline-none ${
                isDark 
                  ? "bg-slate-950 border-slate-800 text-cyan-300 focus:border-cyan-500" 
                  : "bg-slate-50 border-zinc-300 text-zinc-800 focus:border-[#2ec6d6]"
              }`}
            />
          </div>
          <button
            id="connect_ip_btn"
            onClick={handleConnectClick}
            disabled={connected || connecting}
            className={`px-5 py-2 text-xs font-display font-semibold rounded-lg shadow-sm transition-all cursor-pointer ${
              connected 
                ? "bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 cursor-default" 
                : "bg-[#2ec6d6] text-cyan-950 hover:bg-[#2ec6d6]/80 active:scale-95"
            }`}
          >
            {connecting ? t.connecting : connected ? t.connected : t.connectBtn}
          </button>
        </div>
      </div>

      {/* 2. Arm Status & Activation Bento Item */}
      <div className={`p-4 rounded-xl border transition-all ${
        isDark ? "bg-slate-900/80 border-slate-800" : "bg-white border-zinc-200 shadow-sm"
      }`}>
        <h4 className="flex items-center gap-2 font-display font-bold text-sm mb-4 text-[#2ec6d6]">
          <Settings size={16} />
          <span>{language === 'zh' ? '第二步与第三步：控制与使能状态' : 'Step 2 & 3: Initialization & Enable Controls'}</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Quick Stats Pillar */}
          <div className="space-y-2.5">
            <div className="text-xs text-slate-400 font-medium">
              {t.controllerState}:
            </div>
            <div className={`p-3 rounded-lg border font-mono text-center flex flex-col justify-center min-h-[70px] ${
              isDark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-zinc-200"
            }`}>
              <span className={`text-[11px] font-bold ${initialized ? "text-[#2ec6d6]" : "text-amber-500 animate-pulse"}`}>
                {initialized ? t.initSuccess : t.notSet}
              </span>
              <span className="text-[9px] text-slate-500 mt-1">
                {initialized ? "PROG_ALLOW_JOG (reg881 = 2)" : "WAIT_INITIAL_HANDSHAKE"}
              </span>
            </div>

            {/* Arm status pill */}
            <div className="text-xs text-slate-400 font-medium">
              {language === 'zh' ? '机械臂当前状态' : 'Mechanical Arm Status'}:
            </div>
            <div className={`p-3 rounded-lg border font-mono text-center flex items-center justify-center gap-2 min-h-[50px] ${
              robotStatusCode === 3 || robotStatusCode === 4
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : robotStatusCode === 1
                ? "bg-rose-500/10 border-rose-500/30 text-rose-500 animate-pulse"
                : "bg-amber-500/10 border-amber-500/30 text-amber-500"
            }`}>
              {robotStatusCode === 3 || robotStatusCode === 4 ? (
                <>
                  <CheckCircle size={14} className="animate-spin text-emerald-400" />
                  <span className="text-xs font-bold">{t.enabled}</span>
                </>
              ) : robotStatusCode === 1 ? (
                <>
                  <AlertTriangle size={14} className="animate-bounce" />
                  <span className="text-xs font-bold">{t.errorState}</span>
                </>
              ) : (
                <>
                  <ZapOff size={14} />
                  <span className="text-xs font-bold">{t.disabled}</span>
                </>
              )}
            </div>
          </div>

          {/* Core Controls Actions Pillar */}
          <div className="flex flex-col gap-2 justify-center">
            <button
              id="init_arm_btn"
              onClick={onInitialize}
              disabled={!connected}
              className={`w-full py-2 text-xs font-semibold rounded-lg font-display transition-all cursor-pointer ${
                initialized 
                  ? "bg-slate-800 text-slate-400 border border-slate-700 cursor-default" 
                  : connected 
                  ? "border border-cyan-400 text-cyan-300 hover:bg-cyan-500/10 active:scale-95" 
                  : "border border-slate-800 text-slate-600 cursor-not-allowed"
              }`}
            >
              {t.initBtn}
            </button>

            <button
              id="enable_servo_btn"
              onClick={onEnable}
              disabled={!connected || !initialized}
              className={`w-full py-2 text-xs font-semibold rounded-lg font-display transition-all cursor-pointer ${
                connected && initialized
                  ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm active:scale-95"
                  : "bg-slate-800 text-slate-600 cursor-not-allowed"
              }`}
            >
              <div className="flex items-center justify-center gap-1.5">
                <Play size={13} fill="currentColor" />
                <span>{t.enableBtn}</span>
              </div>
            </button>

            <button
              id="brake_servo_btn"
              onClick={onDisable}
              disabled={!connected}
              className={`w-full py-2 text-xs font-semibold rounded-lg font-display transition-all cursor-pointer ${
                connected
                  ? "bg-amber-600 hover:bg-amber-700 text-white shadow-sm active:scale-95"
                  : "bg-slate-800 text-slate-600 cursor-not-allowed"
              }`}
            >
              <div className="flex items-center justify-center gap-1.5">
                <Square size={13} fill="currentColor" />
                <span>{t.disableBtn}</span>
              </div>
            </button>

            {/* Error management block */}
            <div className="pt-2 border-t border-slate-800/60 grid grid-cols-2 gap-2">
              <button
                id="clear_arm_error_btn"
                onClick={onClearError}
                disabled={!connected}
                className="w-full py-1.5 text-[10px] font-mono font-bold border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
              >
                {t.clearError}
              </button>
              <button
                id="trigger_sim_error_btn"
                onClick={onTriggerSimError}
                disabled={!connected}
                className="w-full py-1.5 text-[10px] bg-red-950/40 hover:bg-red-900/40 border border-red-800/40 font-mono text-red-300 rounded-lg transition-all cursor-pointer"
              >
                {t.triggerError}
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* 3. Global Speed Overrides Slider */}
      <div className={`p-4 rounded-xl border transition-all ${
        isDark ? "bg-slate-900/80 border-slate-800" : "bg-white border-zinc-200 shadow-sm"
      }`}>
        <div className="flex items-center justify-between mb-2">
          <h4 className="flex items-center gap-2 font-display font-bold text-sm text-[#2ec6d6]">
            <Gauge size={16} />
            <span>{t.speedRatio}</span>
          </h4>
          <span className="font-mono text-xs font-extrabold text-[#2ec6d6] px-2 py-0.5 rounded bg-[#2ec6d6]/10">
            {localSpeedRatio}%
          </span>
        </div>

        <input
          id="speed_ratio_slider"
          type="range"
          min="0"
          max="100"
          value={localSpeedRatio}
          disabled={!connected}
          onChange={handleSpeedSliderChange}
          onMouseUp={handleSpeedRelease}
          onTouchEnd={handleSpeedRelease}
          className="w-full accent-[#2ec6d6] bg-slate-800 rounded-lg appearance-none h-2 cursor-pointer disabled:cursor-not-allowed"
        />
        <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
          <span>0 (SLOW)</span>
          <span>50 (OPTIMIZED)</span>
          <span>100 (HIGH SPEED)</span>
        </div>
      </div>

      {/* 4. Auto Calibration Panel */}
      <div className={`p-4 rounded-xl border transition-all ${
        isDark ? "bg-slate-900/80 border-slate-800" : "bg-white border-zinc-200 shadow-sm"
      }`}>
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-cyan-500/10">
          <h4 className="flex items-center gap-2 font-display font-bold text-sm text-[#2ec6d6]">
            <Sparkles size={16} />
            <span>{t.autoCalib}</span>
          </h4>
          <button
            id="start_autocalib_btn"
            onClick={onTriggerCalibration}
            disabled={!connected || robotStatusCode !== 3 || calib.running}
            className={`px-3 py-1.5 text-[11px] font-display font-semibold rounded-lg shadow-sm transition-all cursor-pointer ${
              connected && robotStatusCode === 3 && !calib.running
                ? "bg-[#2ec6d6] text-cyan-950 hover:bg-[#2ec6d6]/80 active:scale-95"
                : "bg-slate-800 text-slate-600 cursor-not-allowed"
            }`}
          >
            {calib.running ? "CALIBRATING..." : "START CALIBRATION"}
          </button>
        </div>

        {/* Display live progress if active or was completed */}
        <div className="space-y-3 font-mono text-xs">
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>{t.calibProgress}:</span>
            <span className={`font-bold ${calib.status === 'completed' ? 'text-emerald-400' : 'text-cyan-400'}`}>
              {calib.status === 'idle' 
                ? t.calibIdle 
                : calib.status === 'running' 
                ? `${calib.progress}/${calib.total}` 
                : calib.status === 'completed'
                ? t.calibCompleted 
                : t.calibFailed}
            </span>
          </div>
          
          {/* Progress Bar container */}
          <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
            <div 
              id="calib_progress_filling"
              style={{ width: `${(calib.progress / calib.total) * 100}%` }}
              className="bg-cyan-400 h-full transition-all duration-300" 
            />
          </div>

          {/* Residual point residuals errors list */}
          {calib.progress > 0 && (
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800/80 space-y-2 text-[10px]">
              <div className="flex justify-between items-center text-[#2ec6d6] border-b border-slate-800 pb-1 font-semibold">
                <span>{t.errorsList}</span>
                <span>COUNT: {calib.errors.length}</span>
              </div>
              <div className="grid grid-cols-5 gap-1 text-[9px] text-slate-400">
                {calib.errors.map((err, idx) => (
                  <span id={`calib_error_point_${idx}`} key={idx} className="bg-slate-900 p-1 text-center rounded border border-slate-800">
                    P{idx+1}: {err.toFixed(4)}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4 items-center border-t border-slate-800/60 pt-2 text-slate-300">
                <div>
                  <span className="text-slate-500 block text-[9px]">{t.meanError}:</span>
                  <span className="font-bold text-[#2ec6d6]">{calib.mean_error.toFixed(4)} mm</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block text-[9px]">{t.maxError}:</span>
                  <span className="font-bold text-amber-500">{calib.max_error.toFixed(4)} mm</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 5. Jog Interactive Step controls */}
      <div className={`p-4 rounded-xl border transition-all ${
        isDark ? "bg-slate-900/80 border-slate-800" : "bg-white border-zinc-200 shadow-sm"
      }`}>
        <h4 className="flex items-center gap-2 font-display font-bold text-sm mb-3 text-[#2ec6d6]">
          <Navigation2 size={16} className="rotate-45" />
          <span>{t.manualOption}</span>
        </h4>

        <div className="grid grid-cols-3 gap-3 text-xs mb-3 font-mono">
          <div className="space-y-1">
            <span className="text-slate-400 block text-[10px]">{t.jogAxis}:</span>
            <select
              id="jog_axis_select"
              value={selectedAxis}
              onChange={(e) => setSelectedAxis(e.target.value as any)}
              className={`w-full px-2 py-1.5 rounded-md border text-[11px] ${
                isDark ? "bg-slate-950 border-slate-800 text-cyan-300" : "bg-white border-zinc-300 text-zinc-800"
              }`}
            >
              <option value="X">AXIS X (X-axis)</option>
              <option value="Y">AXIS Y (Y-axis)</option>
              <option value="Z">AXIS Z (Vertical)</option>
              <option value="U">AXIS U (Flange °)</option>
            </select>
          </div>

          <div className="space-y-1">
            <span className="text-slate-400 block text-[10px]">{t.jogDirection}:</span>
            <select
              id="jog_dir_select"
              value={jogDir}
              onChange={(e) => setJogDir(parseInt(e.target.value) as any)}
              className={`w-full px-2 py-1.5 rounded-md border text-[11px] ${
                isDark ? "bg-slate-950 border-slate-800 text-cyan-300" : "bg-white border-zinc-300 text-zinc-800"
              }`}
            >
              <option value={1}>+ dir (Positive)</option>
              <option value={-1}>- dir (Negative)</option>
            </select>
          </div>

          <div className="space-y-1">
            <span className="text-slate-400 block text-[10px]">{t.jogStepDist}:</span>
            <input
              id="jog_dist_input"
              type="number"
              value={jogDist}
              onChange={(e) => setJogDist(Math.max(0.1, parseFloat(e.target.value) || 0))}
              className={`w-full px-2 py-1 rounded border text-[11px] ${
                isDark ? "bg-slate-950 border-slate-800 text-cyan-300" : "bg-white border-zinc-300 text-zinc-850"
              }`}
            />
          </div>
        </div>

        {/* Rapid distance pill overrides */}
        <div className="flex items-center gap-1.5 mb-3 font-mono">
          <span className="text-[10px] text-slate-500">QUICK PRESET:</span>
          {[0.5, 1, 10, 50].map((num) => (
            <button
              id={`quick_preset_${num}`}
              key={num}
              onClick={() => setJogDist(num)}
              className={`px-2 py-0.5 text-[9px] rounded font-bold border transition-all cursor-pointer ${
                jogDist === num 
                  ? "bg-[#2ec6d6] text-cyan-950 border-cyan-400" 
                  : isDark
                  ? "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                  : "bg-slate-100 border-zinc-200 text-zinc-600 hover:bg-slate-200"
              }`}
            >
              {num}{selectedAxis === 'U' ? '°' : 'mm'}
            </button>
          ))}
        </div>

        <button
          id="trigger_jog_step_btn"
          onClick={handleJogClick}
          disabled={!connected || robotStatusCode !== 3}
          className={`w-full py-2.5 rounded-lg text-xs font-display font-bold shadow-sm cursor-pointer transition-all ${
            connected && robotStatusCode === 3
              ? "bg-[#2ec6d6]/25 border border-[#2ec6d6] text-[#2ec6d6] hover:bg-[#2ec6d6]/35 active:scale-95"
              : "bg-slate-800 text-slate-600 border border-transparent cursor-not-allowed"
          }`}
        >
          {t.triggerJog}
        </button>
      </div>

    </div>
  );
}
