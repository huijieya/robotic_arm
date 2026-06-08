<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from "vue";
import { translations } from "./translations";
import ApiDocsModal from "./components/ApiDocsModal.vue";
import CameraView from "./components/CameraView.vue";
import ControlDashboard from "./components/ControlDashboard.vue";
import VisionSheduler from "./components/VisionSheduler.vue";
import LogsPanel from "./components/LogsPanel.vue";
import ProgramManager from "./components/ProgramManager.vue";
import { Settings, FileText, X } from "lucide-vue-next";
import { Controller, Vision, updateApiBaseUrl } from "./api/index";

const language = ref("zh");
const showDocs = ref(false);

// Connection & status states
const connected = ref(false);
const ip = ref("192.168.1.220");
const backendAddress = ref((typeof window !== "undefined" && typeof localStorage !== "undefined") ? (localStorage.getItem("NEXUS_BACKEND_ADDRESS") || "") : "");
const showGatewayModal = ref(false);
const wsConnected = ref(false);

const getApiUrl = (path) => {
  if (!backendAddress.value) return path;
  let host = backendAddress.value.trim();
  if (host.startsWith("http://")) host = host.replace("http://", "");
  if (host.startsWith("https://")) host = host.replace("https://", "");
  if (!host.includes(":")) host = `${host}:3000`;
  const protocol = (typeof window !== "undefined" && window.location) ? window.location.protocol : "http:";
  return `${protocol}//${host}${path}`;
};

const getWsUrl = () => {
  const isBrowser = typeof window !== "undefined" && window.location;
  if (!backendAddress.value) {
    const wsProto = isBrowser && window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = isBrowser ? window.location.host : "localhost:3000";
    return `${wsProto}//${host}`;
  }
  let host = backendAddress.value.trim();
  if (host.startsWith("http://")) host = host.replace("http://", "");
  if (host.startsWith("https://")) host = host.replace("https://", "");
  
  let wsHost = host;
  if (host.includes(":")) {
    const parts = host.split(":");
    const ipPart = parts[0];
    const portPart = parseInt(parts[1], 10);
    if (!isNaN(portPart)) {
      wsHost = `${ipPart}:${portPart + 1}`;
    }
  } else {
    wsHost = `${host}:8081`;
  }
  const wsProto = isBrowser && window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${wsProto}//${wsHost}`;
};

const initialized = computed(() => controllerState.value === "allow_operation");
const robotStatus = ref("unknown");
const controllerState = ref("unknown");
const pose = ref({
  x: 0.0,
  y: 0.0,
  z: 0.0,
  u: 0.0
});
const speedRatio = ref(0);
const programStatus = ref("unknown");
const visionRunning = ref(false);
const teachRoiActive = ref(false);
const roi = ref({
  valid: true,
  x: 100,
  y: 120,
  w: 300,
  h: 240
});

// Calibration outcomes
const calib = ref({
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
const wsBinaryBlob = ref(null);

// WS instance reference
let socket = null;
let reconnectTimeout = null;

const t = computed(() => translations[language.value]);

// High compatibility checkers for robot and program states
const isError = computed(() => robotStatus.value === "error");
const isRunning = computed(() => robotStatus.value === "running");
const isEnabled = computed(() => robotStatus.value === "enable");
const isBraking = computed(() => robotStatus.value === "braking");

const isControllerAllowed = computed(() => controllerState.value === "allow_operation");

const isProgramRunning = computed(() => programStatus.value === "run");
const isProgramPaused = computed(() => programStatus.value === "pause");
const isProgramError = computed(() => programStatus.value === "error");

const translatedRobotStatus = computed(() => {
  if (!connected.value) return t.value.disconnected;
  if (isError.value) return t.value.errorState;
  if (isRunning.value) return t.value.running;
  if (isEnabled.value) return t.value.enabled;
  return t.value.disabled;
});

const translatedProgramStatus = computed(() => {
  if (!connected.value) return t.value.disconnected;
  if (isProgramRunning.value) return t.value.taskRunning;
  if (isProgramPaused.value) return t.value.taskPaused;
  if (isProgramError.value) return t.value.taskError;
  return t.value.taskIdle;
});

const translatedControllerState = computed(() => {
  if (!connected.value) return t.value.disconnected;
  if (isControllerAllowed.value) {
    return t.value.ctrlStateProgJog;
  }
  return t.value.ctrlStateNone;
});

// Initialize and maintain WebSocket subscriptions
const linkTelemetryStream = () => {
  wsConnected.value = false;
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
  console.log("Connecting to WebSocket:", wsUrl);
  
  socket = new WebSocket(wsUrl);
  socket.binaryType = "blob";

  socket.onopen = () => {
    console.log("ws 连接成功，等待数据中...");
    wsConnected.value = true;
  };

  socket.onmessage = async (event) => {
    console.log("收到ws消息:", event.data);
    if (event.data instanceof Blob) {
      // Binary frame representing camera stream update
      wsBinaryBlob.value = event.data;
    } else {
      // Text frame representing system JSON telemetry status
      let textData = event.data;
      if (typeof textData !== "string") {
        try {
          textData = await textData.text();
        } catch (e) {
          return;
        }
      }
      try {
        const payload = JSON.parse(textData);
        if (payload.type === "sys_status" && payload.data) {
          const d = payload.data;
          robotStatus.value = d.robot_status;
          controllerState.value = d.controller_state;
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
    wsConnected.value = false;
    reconnectTimeout = setTimeout(linkTelemetryStream, 3000);
  };

  socket.onerror = (err) => {
    console.error("Industrial line socket exception:", err);
    wsConnected.value = false;
  };
};

// Initial sync of connection status & vision module running state to make sure frontend has initial states
const syncStatus = async () => {
  try {
    const resPose = await Controller.getRealtimePose();
    if (resPose.data && resPose.data.success) {
      connected.value = true;
      pose.value = resPose.data.data;
    }

    const resVision = await Vision.getStatus();
    if (resVision.data && resVision.data.success && resVision.data.data) {
      visionRunning.value = resVision.data.data.running === 1;
    }

    const resRoi = await Vision.getRoi();
    if (resRoi.data && resRoi.data.valid) {
      roi.value = resRoi.data;
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
});

onUnmounted(() => {
  if (socket) socket.close();
  if (reconnectTimeout) clearTimeout(reconnectTimeout);
});

// REST API Actions
const handleConnect = async (targetIp) => {
  try {
    const res = await Controller.connect(targetIp);
    if (res.data && res.data.success) {
      connected.value = true;
      ip.value = targetIp;
      showGatewayModal.value = false;
      return true;
    }
  } catch (e) {
    console.error(e);
  }
  return false;
};

const handleDisconnect = () => {
  connected.value = false;
  showGatewayModal.value = true;
};

const handleInitialize = async () => {
  try {
    const res = await Controller.init();
    if (res.data && res.data.success) {
      controllerState.value = "allow_operation";
      return true;
    }
  } catch (e) {
    console.error(e);
  }
  return false;
};

const handleEnable = async () => {
  try {
    const res = await Controller.start();
    if (res.data && res.data.success) {
      robotStatus.value = "enable";
      return true;
    }
  } catch (e) {
    console.error(e);
  }
  return false;
};

const handleDisable = async () => {
  try {
    const res = await Controller.stop();
    if (res.data && res.data.success) {
      robotStatus.value = "braking";
      visionRunning.value = false;
      return true;
    }
  } catch (e) {
    console.error(e);
  }
  return false;
};

const handleClearError = async () => {
  try {
    const res = await Controller.clearError();
    if (res.data && res.data.success) {
      robotStatus.value = "enable";
      return true;
    }
  } catch (e) {
    console.error(e);
  }
  return false;
};

const handleTriggerSimError = async () => {
  try {
    await Controller.simTriggerError();
    robotStatus.value = "error";
  } catch (e) {
    console.error(e);
  }
};

const handleSpeedRatioChange = async (val) => {
  try {
    const res = await Controller.setSpeedRatio(val);
    if (res.data && res.data.success) {
      speedRatio.value = val;
      return true;
    }
  } catch (e) {
    console.error(e);
  }
  return false;
};

const handleJog = async (axis, dir, dist) => {
  try {
    const res = await Controller.jogStep(axis, dir, dist);
    if (res.data && res.data.success) {
      const offset = dir * dist;
      const cur = { ...pose.value };
      if (axis === "X") cur.x = parseFloat((cur.x + offset).toFixed(2));
      if (axis === "Y") cur.y = parseFloat((cur.y + offset).toFixed(2));
      if (axis === "Z") cur.z = parseFloat((cur.z + offset).toFixed(2));
      if (axis === "U") cur.u = parseFloat((cur.u + offset).toFixed(2));
      pose.value = cur;
      return true;
    } else {
      alert(`Jog failed: ${res.data?.data || 'Servo check required'}`);
    }
  } catch (e) {
    console.error(e);
  }
  return false;
};

const handleJogStart = async (axis, dir) => {
  try {
    const res = await Controller.jogStart(axis, dir);
    if (res.data && res.data.success) {
      return true;
    } else {
      console.warn("Continuous jog start failed:", res.data?.data);
    }
  } catch (e) {
    console.error(e);
  }
  return false;
};

const handleJogStop = async () => {
  try {
    const res = await Controller.jogStop();
    if (res.data && res.data.success) {
      return true;
    }
  } catch (e) {
    console.error(e);
  }
  return false;
};

const handleTriggerCalibration = async () => {
  try {
    const res = await Controller.triggerAutoCalib();
    return res.data && res.data.success;
  } catch (e) {
    console.error(e);
  }
  return false;
};

const handleStartSorting = async () => {
  try {
    const res = await Vision.start();
    if (res.data && res.data.success) {
      visionRunning.value = true;
      robotStatus.value = "running";
      return true;
    }
  } catch (e) {
    console.error(e);
  }
  return false;
};

const handleStopSorting = async () => {
  try {
    const res = await Vision.stop();
    if (res.data && res.data.success) {
      visionRunning.value = false;
      robotStatus.value = "enable";
      return true;
    }
  } catch (e) {
    console.error(e);
  }
  return false;
};

const handleTeachRoiSave = async (dimensions) => {
  try {
    const res = await Vision.setRoi(dimensions);
    if (res.data && typeof res.data === "string" && res.data.includes("ROI SAVED")) {
      roi.value = { valid: true, ...dimensions };
      teachRoiActive.value = false;
    } else if (res.data && res.data.success) {
      roi.value = { valid: true, ...dimensions };
      teachRoiActive.value = false;
    } else {
      alert(`ROI save outcome: ${res.data}`);
    }
  } catch (err) {
    console.error(err);
  }
};

const handleTeachRoiClick = async () => {
  try {
    const res = await Vision.startRoiTeach();
    if (res.data && typeof res.data === "string" && res.data.includes("ROI TEACH MODE ON")) {
      teachRoiActive.value = true;
    } else if (res.data && res.data.success) {
      teachRoiActive.value = true;
    }
  } catch (err) {
    console.error(err);
  }
};

const updateBackendAddress = (val) => {
  backendAddress.value = val;
  localStorage.setItem("NEXUS_BACKEND_ADDRESS", val);
  updateApiBaseUrl(val);
};

// Styles mapping matching Logo branding 0x2ec6d6
const outerBgClass = computed(() => {
  return "bg-[#0a0e17] text-slate-300";
});

const innerCardBgClass = computed(() => {
  return "bg-slate-900/60 border-slate-800/80";
});
</script>

<template>
  <div :class="['min-h-screen font-sans transition-colors duration-300 relative flex flex-col', outerBgClass]">

    <!-- Modern Compact Header -->
    <header class="sticky top-0 z-40 backdrop-blur-md border-b transition-all bg-[#0a0e17]/85 border-slate-800/80">
      <div class="max-w-[1400px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        
        <!-- Logo Brand Area -->
        <div class="flex items-center gap-3">
          <div>
            <div class="flex items-center gap-2">
              <h1 class="font-display font-extrabold text-sm sm:text-base tracking-tight text-white logo-glow uppercase flex items-center">
                <span class="text-[#2ec6d6]">Hyperleap</span>&nbsp;
                <span class="text-slate-300">SCARA</span>
              </h1>
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
          <span class="text-slate-500">BACKEND: <span class="text-amber-400 font-bold">{{ backendAddress || (typeof window !== 'undefined' && window.location ? window.location.host : 'localhost:3000') }}</span></span>
          <span class="text-slate-600">|</span>
          <span class="text-slate-500">WS: <span :class="wsConnected ? 'text-[#2ec6d6]' : 'text-rose-500 animate-pulse'">{{ wsConnected ? 'CONNECTED' : 'DISCONNECTED' }}</span></span>
        </div>

        <!-- Language and Actions Panel -->
        <div class="flex items-center gap-2.5">
          
          <!-- Gateway Config Button -->
          <button
            id="header_config_gateway_btn"
            @click="showGatewayModal = true"
            class="p-2 rounded-lg border text-slate-400 hover:text-white transition-all cursor-pointer border-slate-700/80 hover:border-cyan-400/40 bg-slate-900/30"
            :title="language === 'zh' ? '网关设置' : 'Gateway Config'"
          >
            <div class="flex items-center gap-1.5 px-0.5 font-mono text-[11px] font-semibold text-cyan-300">
              <Settings :size="15" />
              <span class="hidden md:inline">{{ language === 'zh' ? '网关设置' : 'Gateway' }}</span>
            </div>
          </button>

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

          <!-- 2. Internationalization languages Select (中英日韩) -->
          <div class="flex items-center border border-slate-700/80 rounded-lg p-0.5 bg-slate-900/30">
            <button
              v-for="lang in ['zh', 'en', 'ja', 'ko']"
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
      
      <div class="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        
        <!-- LEFT HALF COLUMN: TELEMETRY AND LIVESTEP ANIMATOR -->
        <div class="xl:col-span-5 space-y-6">

          <!-- 1. System Status Info Overview (系统状态总览) -->
          <div :class="['p-5 rounded-2xl border space-y-4 shadow-xl relative transition-all duration-200 hover:border-cyan-500/10', innerCardBgClass, 'box-glow']">
            <div class="flex items-center justify-between pb-1 select-none">
              <h3 class="text-[17px] font-bold text-slate-100 tracking-tight">
                {{ t.systemStatusOverview }}
              </h3>
            </div>

            <div class="space-y-4 text-sm font-sans pt-1">
              <!-- 1.1 机械臂状态 -->
              <div class="flex items-center justify-between">
                <span class="text-slate-400 font-normal text-sm md:text-[15px]">{{ t.robotStateLabel }}</span>
                <span :class="[
                  'px-3.5 py-1 rounded-full text-xs font-semibold shadow-xs border text-center transition-all min-w-[70px]',
                  isError ? 'bg-rose-950/40 text-rose-400 border-rose-500/20 shadow-rose-950/10' :
                  isRunning ? 'bg-emerald-950/45 text-emerald-400 border-emerald-500/20' :
                  isEnabled ? 'bg-emerald-900/40 text-emerald-400 border-emerald-500/20' : 'bg-slate-800/40 text-slate-300 border-slate-700/20'
                ]">
                  {{ translatedRobotStatus }}
                </span>
              </div>

              <!-- 1.2 当前位姿 -->
              <div class="flex items-center justify-between">
                <span class="text-slate-400 font-normal text-sm md:text-[15px]">{{ t.currentPoseLabel }}</span>
                <span class="font-mono text-[#2ec6d6] font-semibold text-sm md:text-[15px] tracking-tight selection:bg-cyan-500/10">
                  <template v-if="connected">
                    X={{ pose.x.toFixed(2) }}, Y={{ pose.y.toFixed(2) }}, Z={{ pose.z.toFixed(2) }}, U={{ pose.u.toFixed(2) }}
                  </template>
                  <template v-else>
                    X=---, Y=---, Z=---, U=---
                  </template>
                </span>
              </div>

              <!-- 1.3 速度比 (实时) -->
              <div class="flex items-center justify-between">
                <span class="text-slate-400 font-normal text-sm md:text-[15px]">{{ t.speedRatioRealtime }}</span>
                <span class="font-mono text-slate-100 font-medium text-sm md:text-[15px]">
                  {{ connected ? `${speedRatio} %` : '---' }}
                </span>
              </div>

              <!-- 1.4 程序状态 -->
              <div class="flex items-center justify-between">
                <span class="text-slate-400 font-normal text-sm md:text-[15px]">{{ t.programStatusLabel }}</span>
                <div class="flex items-center gap-1.5 justify-end">
                  <span :class=" [
                    'font-medium text-sm md:text-[15px]',
                    isProgramRunning ? 'text-emerald-400' : 'text-slate-100'
                  ]">
                    {{ translatedProgramStatus }}
                  </span>
                  <span v-if="isProgramRunning" class="text-emerald-400 text-xs font-bold font-mono animate-pulse">▶</span>
                </div>
              </div>

              <!-- 1.5 控制器当前状态 -->
              <div class="flex items-center justify-between">
                <span class="text-slate-400 font-normal text-sm md:text-[15px]">{{ t.controllerStateLabel }}</span>
                <span class="text-slate-100 font-medium text-sm md:text-[15px] max-w-[240px] truncate text-right font-sans" :title="translatedControllerState">
                  {{ translatedControllerState }}
                </span>
              </div>
            </div>
          </div>
          
          <CameraView
            :language="language"
            :connected="connected"
            :roi="roi"
            @teach-roi-click="handleTeachRoiClick"
            @teach-roi-save="handleTeachRoiSave"
            :teachRoiActive="teachRoiActive"
            :wsBinaryBlob="wsBinaryBlob"
          />

          <ProgramManager
            :language="language"
            :connected="connected"
            :robotStatus="robotStatus"
            :programStatus="programStatus"
            @refresh="linkTelemetryStream"
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
              @enable="handleEnable"
              @disable="handleDisable"
              @clear-error="handleClearError"
              @trigger-sim-error="handleTriggerSimError"
              :speedRatio="speedRatio"
              @speed-ratio-change="handleSpeedRatioChange"
              @jog="handleJog"
              @jog-start="handleJogStart"
              @jog-stop="handleJogStop"
              :calib="calib"
              @trigger-calibration="handleTriggerCalibration"
            />

            <VisionSheduler
              :language="language"
              :connected="connected"
              :visionRunning="visionRunning"
              @start-vision="handleStartSorting"
              @stop-vision="handleStopSorting"
              :pose="pose"
              :getApiUrl="getApiUrl"
            />

            <LogsPanel
              :language="language"
              :connected="connected"
              :getApiUrl="getApiUrl"
            />

          </div>

        </div>

      </div>

    </main>

    <!-- Offline Connection Gateway Setup Modal Overlays -->
    <div v-if="showGatewayModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div :class="['w-full max-w-md p-6 rounded-2xl border space-y-5 text-center relative animate-in fade-in zoom-in-95 duration-200 shadow-2xl', innerCardBgClass, 'box-glow']">
        
        <!-- Close Button -->
        <button
          id="close_gateway_modal_btn"
          @click="showGatewayModal = false"
          class="absolute top-4 right-4 p-1 rounded-lg border border-slate-700/80 hover:border-cyan-400 text-slate-400 hover:text-white transition-colors cursor-pointer"
          title="关闭窗口并查看界面"
        >
          <X :size="16" />
        </button>


        <div class="space-y-1">
          <h3 class="font-display font-extrabold text-lg text-white">
            {{ t.title }} - {{ t.ipDoc }}
          </h3>
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
              class="w-full px-4 py-2 font-mono text-sm rounded-xl border outline-none text-center bg-slate-950 border-slate-800 text-[#2ec6d6] focus:border-cyan-400"
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
              @input="e => updateBackendAddress(e.target.value)"
              class="w-full px-4 py-2 font-mono text-sm rounded-xl border outline-none text-center bg-slate-950 border-slate-800 text-[#ccc] focus:border-cyan-400"
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

        <!-- Dismiss Skip Option -->
        <button
          id="dismiss_gateway_modal_btn"
          @click="showGatewayModal = false"
          class="w-full py-2 bg-transparent border border-slate-700/80 hover:border-cyan-400 text-slate-400 hover:text-white font-medium rounded-xl hover:bg-slate-800 transition-all text-xs cursor-pointer"
        >
          {{ language === 'zh' ? '直接进入系统主界面' : 'Enter Dashboard Directly' }}
        </button>

      </div>
    </div>

    <!-- Floating API Docs Modal -->
    <ApiDocsModal
      v-if="showDocs"
      :language="language"
      @close="showDocs = false"
    />

  </div>
</template>
