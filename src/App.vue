<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from "vue";
import { Language, CalibrationData } from "./types";
import { translations } from "./translations";
import ApiDocsModal from "./components/ApiDocsModal.vue";
import CameraView from "./components/CameraView.vue";
import ArmVisualizer from "./components/ArmVisualizer.vue";
import ControlDashboard from "./components/ControlDashboard.vue";
import VisionSheduler from "./components/VisionSheduler.vue";
import LogsPanel from "./components/LogsPanel.vue";
import { Sun, Moon, Laptop, Settings, Eye, FileText } from "lucide-vue-next";

const language = ref<Language>("zh");
const isDark = ref<boolean>(true);
const showDocs = ref<boolean>(false);

// Connection & status states
const connected = ref<boolean>(false);
const ip = ref<string>("192.168.1.220");
const backendAddress = ref<string>(localStorage.getItem("NEXUS_BACKEND_ADDRESS") || "");

const getApiUrl = (path: string) => {
  if (!backendAddress.value) return path;
  let host = backendAddress.value.trim();
  if (host.startsWith("http://")) host = host.replace("http://", "");
  if (host.startsWith("https://")) host = host.replace("https://", "");
  if (!host.includes(":")) host = `${host}:3000`;
  const protocol = window.location.protocol;
  return `${protocol}//${host}${path}`;
};

const getWsUrl = () => {
  if (!backendAddress.value) {
    const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${wsProto}//${window.location.host}`;
  }
  let host = backendAddress.value.trim();
  if (host.startsWith("http://")) host = host.replace("http://", "");
  if (host.startsWith("https://")) host = host.replace("https://", "");
  if (!host.includes(":")) host = `${host}:3000`;
  const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${wsProto}//${host}`;
};

const initialized = ref<boolean>(false);
const robotStatus = ref<string>("制动");
const robotStatusCode = ref<number>(2);
const controllerState = ref<string>("不允许程序操作和jog");
const controllerStateCode = ref<number>(3);
const pose = ref<{ x: number; y: number; z: number; u: number }>({
  x: 528.61,
  y: -701.51,
  z: 0.47,
  u: -1.68
});
const speedRatio = ref<number>(40);
const programStatus = ref<string>("空闲");
const visionRunning = ref<boolean>(false);
const teachRoiActive = ref<boolean>(false);
const roi = ref<{ valid: boolean; x: number; y: number; w: number; h: number }>({
  valid: true,
  x: 100,
  y: 120,
  w: 300,
  h: 240
});

// Calibration outcomes
const calib = ref<CalibrationData>({
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
const wsBinaryBlob = ref<Blob | null>(null);

// WS instance reference
let socket: WebSocket | null = null;
let reconnectTimeout: any = null;
let syncInterval: any = null;

const t = computed(() => translations[language.value]);

// Initialize and maintain WebSocket subscriptions
const linkTelemetryStream = () => {
  if (socket) {
    try {
      socket.close();
    } catch (e) {
      // ignore
    }
  }
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }

  const wsUrl = getWsUrl();
  console.log("Robotic Arm linking telemetry stream:", wsUrl);
  
  socket = new WebSocket(wsUrl);
  socket.binaryType = "blob";

  socket.onopen = () => {
    console.log("Industrial telemetry stream open and verified.");
  };

  socket.onmessage = (event) => {
    if (event.data instanceof Blob) {
      // Binary frame representing camera stream update
      wsBinaryBlob.value = event.data;
    } else {
      // Text frame representing system JSON telemetry status
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "sys_status" && payload.data) {
          const d = payload.data;
          robotStatus.value = d.robot_status;
          robotStatusCode.value = d.robot_status_code;
          controllerState.value = d.controller_state;
          controllerStateCode.value = d.controller_state_code;
          initialized.value = d.controller_state_code === 2 || d.controller_state === "允许程序操作和jog";
          pose.value = d.pose;
          speedRatio.value = d.speed_ratio;
          programStatus.value = d.program_status;
        } else if (payload.type === "calib_status" && payload.data) {
          const d = payload.data;
          calib.value = {
            status: d.status,
            running: d.running,
            progress: d.progress,
            total: d.total,
            message: d.message,
            errors: d.errors || [],
            mean_error: d.mean_error || 0.0,
            max_error: d.max_error || 0.0
          };
        }
      } catch (e) {
        console.error("Telemetry decode exception:", e);
      }
    }
  };

  socket.onclose = () => {
    console.warn("Robotic Arm stream lost. Retrying hook in 3000ms...");
    reconnectTimeout = setTimeout(linkTelemetryStream, 3000);
  };

  socket.onerror = (err) => {
    console.error("Industrial line socket exception:", err);
  };
};

// Periodic poll of connection status & vision module running state to make sure frontend is perfectly aligned
const syncStatus = async () => {
  try {
    const resPose = await fetch(getApiUrl("/pose_realtime"));
    if (resPose.ok) {
      const json = await resPose.json();
      if (json && json.success) {
        connected.value = true;
        pose.value = json.data;
      }
    }

    const resVision = await fetch(getApiUrl("/vision/status"));
    if (resVision.ok) {
      const json = await resVision.json();
      if (json && json.success && json.data) {
        visionRunning.value = json.data.running === 1;
      }
    }

    const resRoi = await fetch(getApiUrl("/get_roi"));
    if (resRoi.ok) {
      const json = await resRoi.json();
      if (json && json.valid) {
        roi.value = json;
      }
    }
  } catch (err) {
    // silent
  }
};

watch(backendAddress, () => {
  linkTelemetryStream();
  syncStatus();
});

onMounted(() => {
  linkTelemetryStream();
  syncStatus();
  syncInterval = setInterval(syncStatus, 2500);
});

onUnmounted(() => {
  if (socket) socket.close();
  if (reconnectTimeout) clearTimeout(reconnectTimeout);
  if (syncInterval) clearInterval(syncInterval);
});

// REST API Actions
const handleConnect = async (targetIp: string): Promise<boolean> => {
  try {
    const res = await fetch(getApiUrl(`/connect?ip=${encodeURIComponent(targetIp)}`));
    if (res.ok) {
      const json = await res.json();
      if (json.success) {
        connected.value = true;
        ip.value = targetIp;
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
        initialized.value = true;
        controllerState.value = "允许程序操作和jog";
        controllerStateCode.value = 2;
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
        robotStatus.value = "使能";
        robotStatusCode.value = 3;
        return true;
      }
    }
  } catch (e) {
    console.error(e);
  }
  return false;
};

const handleDisable = async (): Promise<boolean> => {
  try {
    const res = await fetch(getApiUrl("/stop"));
    if (res.ok) {
      const json = await res.json();
      if (json.success) {
        robotStatus.value = "制动";
        robotStatusCode.value = 2;
        visionRunning.value = false;
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
        robotStatus.value = "使能";
        robotStatusCode.value = 3;
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
    const res = await fetch(getApiUrl("/sim_trigger_error"));
    if (res.ok) {
      robotStatus.value = "错误";
      robotStatusCode.value = 1;
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
        speedRatio.value = val;
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
        const offset = dir * dist;
        const cur = { ...pose.value };
        if (axis === "X") cur.x = parseFloat((cur.x + offset).toFixed(2));
        if (axis === "Y") cur.y = parseFloat((cur.y + offset).toFixed(2));
        if (axis === "Z") cur.z = parseFloat((cur.z + offset).toFixed(2));
        if (axis === "U") cur.u = parseFloat((cur.u + offset).toFixed(2));
        pose.value = cur;
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
        visionRunning.value = true;
        robotStatus.value = "运行";
        robotStatusCode.value = 4;
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
        visionRunning.value = false;
        robotStatus.value = "使能";
        robotStatusCode.value = 3;
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
        roi.value = { valid: true, ...dimensions };
        teachRoiActive.value = false;
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
        teachRoiActive.value = true;
      }
    }
  } catch (err) {
    console.error(err);
  }
};

const updateBackendAddress = (val: string) => {
  backendAddress.value = val;
  localStorage.setItem("NEXUS_BACKEND_ADDRESS", val);
};

// Styles mapping matching Logo branding 0x2ec6d6
const outerBgClass = computed(() => {
  return isDark.value ? "bg-[#0a0e17] text-slate-300" : "bg-zinc-50 text-zinc-700";
});

const innerCardBgClass = computed(() => {
  return isDark.value ? "bg-slate-900/60 border-slate-800/80" : "bg-white border-zinc-200/80";
});
</script>

<template>
  <div :class="['min-h-screen font-sans transition-colors duration-300 relative flex flex-col', outerBgClass]">

    <!-- Modern Compact Header -->
    <header :class="['sticky top-0 z-40 backdrop-blur-md border-b transition-all', isDark ? 'bg-[#0a0e17]/85 border-slate-800/80' : 'bg-white/85 border-zinc-200']">
      <div class="max-w-[1400px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        
        <!-- Logo Brand Area -->
        <div class="flex items-center gap-3">
          <div class="relative flex items-center justify-center w-9 h-9 rounded-lg bg-cyan-950/40 border border-cyan-400 text-[#2ec6d6] overflow-hidden shadow-inner">
            <span class="font-display font-black text-sm tracking-wider">Ω</span>
            <div class="absolute inset-0 bg-[#2ec6d6] opacity-10 animate-pulse" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h1 class="font-display font-extrabold text-sm sm:text-base tracking-tight text-white logo-glow uppercase flex items-center">
                <span class="text-[#2ec6d6]">NEXUS</span>&nbsp;
                <span :class="isDark ? 'text-slate-300' : 'text-zinc-800'">SCARA</span>
              </h1>
              <span class="text-[9px] font-mono font-bold bg-[#2ec6d6]/10 text-[#2ec6d6] px-1 py-0.2 rounded border border-[#2ec6d6]/20">
                SINGLE ARM
              </span>
            </div>
            <p class="text-[10px] text-slate-500 font-mono hidden sm:block">
              {{ t.subtitle }}
            </p>
          </div>
        </div>

        <!-- Quick HUD Stats panel -->
        <div v-if="connected" class="hidden lg:flex items-center gap-3.5 font-mono text-[10px] bg-slate-950/40 px-3 py-1.5 rounded-lg border border-slate-800/30">
          <span class="text-slate-500">ARM: <span class="text-[#2ec6d6] font-bold">{{ ip || "192.168.1.220" }}</span></span>
          <span class="text-slate-600">|</span>
          <span class="text-slate-500">BACKEND: <span class="text-amber-400 font-bold">{{ backendAddress || window.location.host }}</span></span>
          <span class="text-slate-600">|</span>
          <span class="text-slate-500">INIT: <span :class="initialized ? 'text-[#2ec6d6]' : 'text-amber-500'">{{ initialized ? "OK" : "NULL" }}</span></span>
          <span class="text-slate-600">|</span>
          <span class="text-slate-500">POSE: <span class="text-[#2ec6d6]">X:{{ pose.x.toFixed(1) }} Y:{{ pose.y.toFixed(1) }} Z:{{ pose.z.toFixed(1) }}</span></span>
          <button 
            id="header_disconnect_btn"
            @click="connected = false"
            class="ml-1 px-1.5 py-0.5 bg-rose-950/45 text-rose-400 border border-rose-800/40 hover:bg-rose-900/60 rounded text-[9px] cursor-pointer transition-all active:scale-95"
          >
            {{ language === 'zh' ? '断开并重配' : 'Disconnect' }}
          </button>
        </div>

        <!-- Language and Actions Panel -->
        <div class="flex items-center gap-2.5">
          
          <!-- 1. Api Document Button -->
          <button
            id="view_api_docs_btn"
            @click="showDocs = true"
            class="p-2 rounded-lg border text-slate-400 hover:text-white transition-all cursor-pointer border-slate-700/80 hover:border-cyan-400/40 bg-slate-900/30"
            :title="t.apiDoc"
          >
            <div class="flex items-center gap-1.5 px-0.5 font-mono text-[11px] font-semibold text-cyan-300">
              <FileText :size="15" />
              <span class="hidden md:inline">{{ t.apiDoc }}</span>
            </div>
          </button>

          <!-- 2. Style Theme Switch (明暗转换) -->
          <button
            id="mode_theme_toggle"
            @click="isDark = !isDark"
            class="p-2 rounded-lg border border-slate-700/80 hover:border-cyan-400/40 bg-slate-900/30 text-slate-400 hover:text-white transition-all cursor-pointer active:scale-95"
            :title="isDark ? 'Light Mode' : 'Dark Mode'"
          >
            <Sun v-if="isDark" :size="15" class="text-[#2ec6d6]" />
            <Moon v-else :size="15" class="text-cyan-600" />
          </button>

          <!-- 3. Internationalization languages Select (中英日韩) -->
          <div class="flex items-center border border-slate-700/80 rounded-lg p-0.5 bg-slate-900/30">
            <button
              v-for="lang in (['zh', 'en', 'ja', 'ko'] as Language[])"
              :id="`lang_switch_${lang}`"
              :key="lang"
              @click="language = lang"
              :class="['px-2.5 py-1 text-[10px] font-display font-medium rounded transition-all cursor-pointer', language === lang ? 'bg-[#2ec6d6] text-cyan-950 font-bold shadow-xs' : 'text-slate-400 hover:text-white']"
            >
              {{ lang.toUpperCase() }}
            </button>
          </div>

        </div>

      </div>
    </header>

    <!-- Main Container Area -->
    <main class="flex-1 max-w-[1400px] mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
      
      <div v-if="connected" class="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        
        <!-- LEFT HALF COLUMN: TELEMETRY AND LIVESTEP ANIMATOR -->
        <div class="xl:col-span-5 space-y-6">
          
          <CameraView
            :language="language"
            :connected="connected"
            :isDark="isDark"
            :roi="roi"
            @teach-roi-click="handleTeachRoiClick"
            @teach-roi-save="handleTeachRoiSave"
            :teachRoiActive="teachRoiActive"
            :wsBinaryBlob="wsBinaryBlob"
          />

          <ArmVisualizer
            :language="language"
            :pose="pose"
            :robotStatus="robotStatus"
            :isDark="isDark"
            :visionRunning="visionRunning"
          />

        </div>

        <!-- RIGHT COLUMN: CONFIGURATION CONTROLLERS -->
        <div class="xl:col-span-7 space-y-6">
          
          <div class="grid grid-cols-1 md:grid-cols-1 gap-6">
            
            <ControlDashboard
              :language="language"
              :connected="connected"
              :ip="ip"
              @connect="handleConnect"
              :initialized="initialized"
              @initialize="handleInitialize"
              :robotStatus="robotStatus"
              :robotStatusCode="robotStatusCode"
              @enable="handleEnable"
              @disable="handleDisable"
              @clear-error="handleClearError"
              @trigger-sim-error="handleTriggerSimError"
              :speedRatio="speedRatio"
              @speed-ratio-change="handleSpeedRatioChange"
              @jog="handleJog"
              :calib="calib"
              @trigger-calibration="handleTriggerCalibration"
              :isDark="isDark"
            />

            <VisionSheduler
              :language="language"
              :connected="connected"
              :visionRunning="visionRunning"
              @start-vision="handleStartSorting"
              @stop-vision="handleStopSorting"
              :pose="pose"
              :isDark="isDark"
              :getApiUrl="getApiUrl"
            />

            <LogsPanel
              :language="language"
              :connected="connected"
              :isDark="isDark"
              :getApiUrl="getApiUrl"
            />

          </div>

        </div>

      </div>

      <!-- Offline Connection Gateway Setup Card -->
      <div v-else class="max-w-md mx-auto my-12 animate-in fade-in zoom-in-95 duration-300">
        <div :class="['p-6 rounded-2xl border space-y-5 text-center', innerCardBgClass, 'box-glow']">
          
          <div class="mx-auto w-12 h-12 rounded-full bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-center text-[#2ec6d6]">
            <Settings class="animate-spin" :size="24" />
          </div>

          <div class="space-y-1">
            <h3 :class="['font-display font-extrabold text-lg', isDark ? 'text-white' : 'text-zinc-800']">
              {{ t.title }}
            </h3>
            <p class="text-xs text-slate-400">
              {{ language === 'zh' ? '请填写网卡连接参数以启动 NEXUS 控制网关' : 'Configure control endpoints and start NEXUS operations gateway' }}
            </p>
          </div>

          <div class="space-y-4 pt-2 text-left">
            <!-- 1. Robotic Arm IP -->
            <div class="space-y-1.5">
              <label class="text-[10px] uppercase font-bold text-slate-500 tracking-wider font-mono block">
                {{ t.armIpAddress }}
              </label>
              <input
                id="gateway_ip_input"
                type="text"
                v-model="ip"
                :class="['w-full px-4 py-2 font-mono text-sm rounded-xl border outline-none text-center', isDark ? 'bg-slate-950 border-slate-800 text-[#2ec6d6] focus:border-cyan-400' : 'bg-zinc-50 border-zinc-200 text-zinc-800 focus:border-[#2ec6d6]']"
                placeholder="192.168.1.220"
              />
            </div>

            <!-- 2. Backend Service Host IP -->
            <div class="space-y-1.5">
              <label class="text-[10px] uppercase font-bold text-slate-500 tracking-wider font-mono block">
                {{ t.backendAddress }}
              </label>
              <input
                id="backend_host_ip_input"
                type="text"
                :value="backendAddress"
                @input="e => updateBackendAddress((e.target as HTMLInputElement).value)"
                :class="['w-full px-4 py-2 font-mono text-sm rounded-xl border outline-none text-center', isDark ? 'bg-slate-950 border-slate-800 text-[#ccc] focus:border-cyan-400' : 'bg-zinc-50 border-zinc-200 text-zinc-800 focus:border-[#2ec6d6]']"
                :placeholder="t.backendAddressPlaceholder"
              />
              <span class="text-[9px] text-slate-400 font-mono block leading-normal text-center">
                {{ language === 'zh' ? '💡 真正提供后端接口的业务服务主机 IP 地址(留空则默认当前网页地址)' : '💡 Host executing backend control proxy (Leave empty for current host)' }}
              </span>
            </div>
          </div>

          <button
            id="connect_gateway_btn"
            @click="handleConnect(ip || '192.168.1.220')"
            class="w-full py-3 bg-[#2ec6d6] text-cyan-950 font-display font-bold rounded-xl hover:bg-[#2ec6d6]/80 active:scale-95 transition-all text-sm cursor-pointer shadow-md mt-2"
          >
            {{ t.connectBtn }}
          </button>

          <div class="pt-2 text-[10px] text-slate-500 font-mono uppercase tracking-wider text-center flex justify-center gap-1.5 items-center">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span>NEXUS CONTROLLER OFFLINE</span>
          </div>

        </div>
      </div>

    </main>

    <!-- Floating API Docs Modal -->
    <ApiDocsModal
      v-if="showDocs"
      :language="language"
      @close="showDocs = false"
    />

    <!-- Industrial Footer Branding -->
    <footer :class="['mt-auto py-4 border-t text-center font-mono text-[9px] hover:text-white text-slate-500 transition-colors', isDark ? 'bg-[#070b12] border-slate-800/40' : 'bg-zinc-100 border-zinc-200']">
      <div class="max-w-[1400px] mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>&copy; 2026 NEXUS INDUSTRIAL SYSTEM TECHNOLOGY INC.</span>
        <span class="text-[#2ec6d6]">SYS_PORT: 3000 | CORE_WS: VALIDATED</span>
      </div>
    </footer>

  </div>
</template>
