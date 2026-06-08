<script setup>
import { ref, watch, computed, onUnmounted } from "vue";
import { translations } from "../translations";
import { 
  Link, Play, Square, AlertTriangle, Settings, 
  Gauge, Sparkles, Navigation2, ZapOff, CheckCircle 
} from "lucide-vue-next";

const props = defineProps({
  language: { type: String, default: "zh" },
  connected: { type: Boolean, default: false },
  ip: { type: String, default: "192.168.1.220" },
  initialized: { type: Boolean, default: false },
  robotStatus: { type: String, default: "braking" },
  speedRatio: { type: Number, default: 40 },
  calib: { type: Object, default: () => ({ status: "idle", running: false, progress: 0, total: 9, message: "", errors: [], mean_error: 0.0, max_error: 0.0 }) }
});

const emit = defineEmits([
  "connect", "initialize", "enable", "disable", 
  "clear-error", "trigger-sim-error", "speed-ratio-change", 
  "jog", "trigger-calibration"
]);

const t = computed(() => translations[props.language]);

const isRobotEnabled = computed(() => props.robotStatus === "enable");
const isRobotRunning = computed(() => props.robotStatus === "running");
const isRobotError = computed(() => props.robotStatus === "error");

const inputIp = ref(props.ip || "192.168.1.220");
const connecting = ref(false);
const localSpeedRatio = ref(props.speedRatio);

watch(() => props.speedRatio, (newRatio) => {
  localSpeedRatio.value = newRatio;
});

watch(() => props.ip, (newIp) => {
  if (newIp) {
    inputIp.value = newIp;
  }
});

const showApplyConfirm = ref(false);

const handleSpeedSliderChange = (e) => {
  localSpeedRatio.value = parseInt(e.target.value);
};

const handleSpeedRelease = () => {
  showApplyConfirm.value = true;
};

const confirmSpeedChange = () => {
  emit("speed-ratio-change", localSpeedRatio.value);
  showApplyConfirm.value = false;
};

const cancelSpeedChange = () => {
  showApplyConfirm.value = false;
  localSpeedRatio.value = props.speedRatio;
};

// Jog parameters states
const jogDist = ref(10);

const handleConnectClick = async () => {
  connecting.value = true;
  emit("connect", inputIp.value);
  setTimeout(() => {
    connecting.value = false;
  }, 1000);
};

// Continuous jog handling (supports click & long press)
let jogTimeout = null;
let jogInterval = null;
let isJoggingActive = false;

const startContinuousJog = (axis, dir) => {
  if (!props.connected || !isRobotEnabled.value) return;
  if (isJoggingActive) return;
  isJoggingActive = true;

  // 1. Immediately trigger once
  emit("jog", axis, dir, jogDist.value);

  // 2. Set timeout for continuous movement if held down
  jogTimeout = setTimeout(() => {
    jogInterval = setInterval(() => {
      emit("jog", axis, dir, jogDist.value);
    }, 250);
  }, 500);
};

const stopContinuousJog = () => {
  isJoggingActive = false;
  if (jogTimeout) {
    clearTimeout(jogTimeout);
    jogTimeout = null;
  }
  if (jogInterval) {
    clearInterval(jogInterval);
    jogInterval = null;
  }
};

onUnmounted(() => {
  stopContinuousJog();
});
</script>

<template>
  <div class="space-y-6">
    
    <!-- 1. Device Connections Bento Item -->
    <div class="p-4 rounded-xl border border-slate-800 transition-all bg-slate-900/80">
      <h4 class="text-base sm:text-lg font-bold text-slate-100 mb-3 select-none tracking-tight">
        <span>{{ t.step1Connect }}</span>
      </h4>

      <div class="flex flex-col sm:flex-row items-stretch gap-3">
        <div class="relative flex-1">
          <input
            id="controller_ip_input"
            type="text"
            v-model="inputIp"
            placeholder="192.168.1.220"
            :disabled="props.connected"
            class="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-800 transition-all outline-none bg-slate-950 text-slate-200 focus:border-cyan-500"
          />
        </div>
        <button
          id="connect_ip_btn"
          @click="handleConnectClick"
          :disabled="props.connected || connecting"
          :class="['px-5 py-2 text-xs font-display font-semibold rounded-lg shadow-sm transition-all cursor-pointer', props.connected ? 'bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 cursor-default font-bold' : 'bg-cyan-600 hover:bg-cyan-500 text-white active:scale-95']"
        >
          {{ connecting ? t.connecting : props.connected ? t.connected : t.connectBtn }}
        </button>
      </div>
    </div>

    <!-- 2. Arm Status & Activation Bento Item -->
    <div class="p-4 rounded-xl border border-slate-800 transition-all bg-slate-900/80">
      <h4 class="text-base sm:text-lg font-bold text-slate-100 mb-4 select-none tracking-tight">
        <span>{{ t.step23InitEnable }}</span>
      </h4>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        <!-- Quick Stats Pillar -->
        <div class="space-y-2.5">
          <div class="text-xs text-slate-400 font-medium select-none">
            {{ t.controllerState }}
          </div>
          <div class="p-3 rounded-lg border border-slate-800 font-mono text-center flex flex-col justify-center min-h-[70px] bg-slate-950">
            <span :class="['text-[11.5px] font-bold', props.initialized ? 'text-slate-100' : 'text-amber-500 animate-pulse']">
              {{ props.initialized ? t.initSuccess : t.notSet }}
            </span>
            <span class="text-[9px] text-slate-500 mt-1">
              {{ props.initialized ? "allow_operation" : "not_allow_operation" }}
            </span>
          </div>

          <!-- Arm status pill -->
          <div class="text-xs text-slate-400 font-medium select-none">
            {{ t.mechanicalArmStatus }}
          </div>
          <div :class="['p-3 rounded-lg border font-mono text-center flex items-center justify-center gap-2 min-h-[50px]', isRobotEnabled || isRobotRunning ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : isRobotError ? 'bg-rose-500/10 border-rose-500/30 text-rose-500 animate-pulse' : 'bg-amber-500/10 border-amber-500/30 text-amber-500']">
            <template v-if="isRobotEnabled || isRobotRunning">
              <CheckCircle :size="14" class="text-emerald-400" />
              <span class="text-xs font-bold">{{ t.enabled }}</span>
            </template>
            <template v-else-if="isRobotError">
              <AlertTriangle :size="14" class="animate-bounce" />
              <span class="text-xs font-bold">{{ t.errorState }}</span>
            </template>
            <template v-else>
              <ZapOff :size="14" />
              <span class="text-xs font-bold">{{ t.disabled }}</span>
            </template>
          </div>
        </div>

        <!-- Core Controls Actions Pillar -->
        <div class="flex flex-col gap-2 justify-center">
          <button
            id="init_arm_btn"
            @click="emit('initialize')"
            :disabled="!props.connected"
            :class="['w-full py-2 text-xs font-semibold rounded-lg font-display transition-all cursor-pointer', props.initialized ? 'bg-slate-800 text-slate-400 border border-slate-700 cursor-default' : props.connected ? 'border border-cyan-400 text-cyan-300 hover:bg-cyan-500/10 active:scale-95' : 'border border-slate-800 text-slate-600 cursor-not-allowed']"
          >
            {{ t.initBtn }}
          </button>

          <button
            id="enable_servo_btn"
            @click="emit('enable')"
            :disabled="!props.connected || !props.initialized"
            :class="['w-full py-2 text-xs font-semibold rounded-lg font-display transition-all cursor-pointer', props.connected && props.initialized ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm active:scale-95' : 'bg-slate-800 text-slate-600 cursor-not-allowed']"
          >
            <div class="flex items-center justify-center gap-1.5">
              <Play :size="13" fill="currentColor" />
              <span>{{ t.enableBtn }}</span>
            </div>
          </button>

          <button
            id="brake_servo_btn"
            @click="emit('disable')"
            :disabled="!props.connected"
            :class="['w-full py-2 text-xs font-semibold rounded-lg font-display transition-all cursor-pointer', props.connected ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm active:scale-95' : 'bg-slate-800 text-slate-600 cursor-not-allowed']"
          >
            <div class="flex items-center justify-center gap-1.5">
              <Square :size="13" fill="currentColor" />
              <span>{{ t.disableBtn }}</span>
            </div>
          </button>

          <!-- Error management block -->
          <div class="pt-2 border-t border-slate-800/60 grid grid-cols-2 gap-2">
            <button
              id="clear_arm_error_btn"
              @click="emit('clear-error')"
              :disabled="!props.connected"
              class="w-full py-1.5 text-[10px] font-mono font-bold border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
            >
              {{ t.clearError }}
            </button>
            <button
              id="trigger_sim_error_btn"
              @click="emit('trigger-sim-error')"
              :disabled="!props.connected"
              class="w-full py-1.5 text-[10px] bg-red-950/40 hover:bg-red-900/40 border border-red-800/40 font-mono text-red-300 rounded-lg transition-all cursor-pointer"
            >
              {{ t.triggerError }}
            </button>
          </div>
        </div>

      </div>
    </div>

    <!-- 3. Global Speed Overrides Slider -->
    <div class="p-4 rounded-xl border border-slate-800 transition-all bg-slate-900/80">
      <div class="flex items-center justify-between mb-2">
        <h4 class="text-base sm:text-lg font-bold text-slate-100 select-none tracking-tight">
          <span>{{ t.speedRatio }}</span>
        </h4>
        <div class="flex items-center gap-2 text-[10px] font-mono select-none">
          <span class="text-slate-400">{{ t.currentValLabel }} <span class="text-white font-bold">{{ props.speedRatio }}%</span></span>
          <span class="text-slate-600">|</span>
          <span class="text-slate-400">{{ t.adjustValLabel }} <span class="text-cyan-400 font-bold">{{ localSpeedRatio }}%</span></span>
        </div>
      </div>

      <div class="flex items-center gap-4">
        <input
          id="speed_ratio_slider"
          type="range"
          min="0"
          max="100"
          :value="localSpeedRatio"
          :disabled="!props.connected || showApplyConfirm"
          @input="handleSpeedSliderChange"
          class="flex-1 accent-cyan-500 bg-slate-800 rounded-lg appearance-none h-2 cursor-pointer disabled:cursor-not-allowed"
        />
        <button
          id="apply_speed_ratio_btn"
          @click="handleSpeedRelease"
          :disabled="!props.connected || localSpeedRatio === props.speedRatio || showApplyConfirm"
          class="px-3 py-1.5 text-xs font-display font-medium rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 disabled:bg-slate-850 disabled:text-slate-600 border border-transparent disabled:border-transparent active:scale-95 transition-all cursor-pointer flex-shrink-0"
        >
          {{ props.language === 'zh' ? '应用' : props.language === 'ja' ? '適用' : props.language === 'ko' ? '적용' : 'Apply' }}
        </button>
      </div>

      <!-- Second level confirmation prompt -->
      <div v-if="showApplyConfirm" class="mt-3 p-2.5 bg-cyan-950/20 border border-cyan-500/10 rounded-lg flex items-center justify-between text-xs font-mono animate-fadeIn">
        <span class="text-cyan-300">
          {{ t.confirmApplySpeed.replace('{speed}', localSpeedRatio) }}
        </span>
        <div class="flex items-center gap-2">
          <button
            id="confirm_speed_btn"
            @click="confirmSpeedChange"
            class="px-2.5 py-1 bg-emerald-550 hover:bg-emerald-500 text-white font-extrabold rounded text-[10px] cursor-pointer"
          >
            {{ t.confirmBtn }}
          </button>
          <button
            id="cancel_speed_btn"
            @click="cancelSpeedChange"
            class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded text-[10px] cursor-pointer"
          >
            {{ t.cancelBtn }}
          </button>
        </div>
      </div>

      <div class="flex justify-between text-[10px] text-slate-500 font-mono mt-1 select-none">
        <span>0 (SLOW)</span>
        <span>50 (OPTIMIZED)</span>
        <span>100 (HIGH SPEED)</span>
      </div>
    </div>

    <!-- 4. Auto Calibration Panel -->
    <div class="p-4 rounded-xl border border-slate-800 transition-all bg-slate-900/80">
      <div class="flex items-center justify-between mb-3">
        <h4 class="text-base sm:text-lg font-bold text-slate-100 select-none tracking-tight">
          <span>{{ t.autoCalib }}</span>
        </h4>
        <button
          id="start_autocalib_btn"
          @click="emit('trigger-calibration')"
          :disabled="!props.connected || !isRobotEnabled || props.calib.running"
          :class="['px-3 py-1.5 text-[11px] font-semibold rounded-lg shadow-sm transition-all cursor-pointer', props.connected && isRobotEnabled && !props.calib.running ? 'bg-cyan-600 text-white hover:bg-cyan-500 active:scale-95' : 'bg-slate-800 text-slate-600 cursor-not-allowed']"
        >
          {{ props.calib.running ? t.calibRunningBtn : t.startCalibBtn }}
        </button>
      </div>

      <!-- Live progress -->
      <div class="space-y-3 font-mono text-xs">
        <div class="flex justify-between text-[11px] text-slate-400">
          <span>{{ t.calibProgress }}:</span>
          <span :class="['font-bold', props.calib.status === 'completed' ? 'text-emerald-400' : 'text-cyan-400']">
            {{ props.calib.status === 'idle' ? t.calibIdle : props.calib.status === 'running' ? `${props.calib.progress}/${props.calib.total}` : props.calib.status === 'completed' ? t.calibCompleted : t.calibFailed }}
          </span>
        </div>
        
        <!-- Progress Bar container -->
        <div class="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
          <div 
            id="calib_progress_filling"
            :style="{ width: `${(props.calib.progress / props.calib.total) * 100}%` }"
            class="bg-cyan-400 h-full transition-all duration-300" 
          />
        </div>

        <!-- Residual point residuals errors list -->
        <div v-if="props.calib.progress > 0" class="p-3 bg-slate-950 rounded-lg border border-slate-800/80 space-y-2 text-[10px]">
          <div class="flex justify-between items-center text-[#2ec6d6] border-b border-slate-800 pb-1 font-semibold">
            <span>{{ t.errorsList }}</span>
            <span>COUNT: {{ props.calib.errors.length }}</span>
          </div>
          <div class="grid grid-cols-5 gap-1 text-[9px] text-slate-400">
            <span v-for="(err, idx) in props.calib.errors" :id="`calib_error_point_${idx}`" :key="idx" class="bg-slate-900 p-1 text-center rounded border border-slate-800">
              P{{ idx+1 }}: {{ err.toFixed(4) }}
            </span>
          </div>
          <div class="grid grid-cols-2 gap-4 items-center border-t border-slate-800/60 pt-2 text-slate-300">
            <div>
              <span class="text-slate-500 block text-[9px]">{{ t.meanError }}:</span>
              <span class="font-bold text-[#2ec6d6]">{{ props.calib.mean_error.toFixed(4) }} mm</span>
            </div>
            <div class="text-right">
              <span class="text-slate-500 block text-[9px]">{{ t.maxError }}:</span>
              <span class="font-bold text-amber-500">{{ props.calib.max_error.toFixed(4) }} mm</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 5. Jog Interactive Step controls (Manual Teleoperation) -->
    <div class="p-4 rounded-xl border border-slate-800 transition-all bg-slate-900/80">
      <h4 class="text-base sm:text-lg font-bold text-slate-100 mb-3.5 select-none tracking-tight">
        <span>{{ t.manualOption }}</span>
      </h4>

      <!-- Step configuration layout similar to reference attachment -->
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4 text-xs font-mono select-none">
        <div class="flex items-center gap-2.5">
          <span class="text-slate-300 font-bold whitespace-nowrap">
            {{ t.jogStepDist }}:
          </span>
          <input
            id="jog_dist_input"
            type="number"
            v-model.number="jogDist"
            class="w-16 px-2 py-1 rounded border border-slate-800 bg-slate-950 text-slate-100 text-xs font-bold text-center outline-none focus:border-cyan-500/50"
          />
        </div>
        <!-- Rapid click presets -->
        <div class="flex items-center gap-1.5 bg-slate-950/40 p-1 rounded-md border border-slate-850">
          <span class="text-[9px] text-slate-500 font-bold px-1 uppercase tracking-wider">
            {{ props.language === 'zh' ? '快捷' : props.language === 'ja' ? 'プリセット' : props.language === 'ko' ? '기본값' : 'Presets' }}
          </span>
          <button
            v-for="num in [1, 10, 50]"
            :id="`quick_preset_${num}`"
            :key="num"
            @click="jogDist = num"
            :class="['px-2 py-0.5 text-[9px] rounded font-bold border transition-all cursor-pointer', jogDist === num ? 'bg-cyan-600 text-white border-cyan-500' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white']"
          >
            {{ num }}
          </button>
        </div>
      </div>

      <!-- Combined Joint button control matrix which supports Tap and Hold down continuous action -->
      <div class="p-3 bg-slate-950/50 rounded-lg border border-slate-800/80 space-y-3">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 items-center justify-between text-xs font-mono">
          
          <!-- Axis X -->
          <div class="flex items-center justify-between bg-slate-950/60 p-2 rounded-lg border border-slate-900/85">
            <span class="text-slate-300 font-extrabold text-sm w-4 select-none">X</span>
            <div class="flex gap-1">
              <button
                id="jog_btn_x_neg"
                @mousedown="startContinuousJog('X', -1)"
                @mouseup="stopContinuousJog"
                @mouseleave="stopContinuousJog"
                @touchstart.prevent="startContinuousJog('X', -1)"
                @touchend="stopContinuousJog"
                @touchcancel="stopContinuousJog"
                :disabled="!props.connected || !isRobotEnabled"
                class="w-10 h-8 flex items-center justify-center p-0 border border-slate-700 bg-slate-900 text-slate-300 hover:text-[#2ec6d6] hover:border-[#2ec6d6] disabled:border-slate-800 disabled:text-slate-600 rounded text-xs font-black transition-all select-none active:scale-95 cursor-pointer disabled:cursor-not-allowed disabled:active:scale-100"
              >
                X-
              </button>
              <button
                id="jog_btn_x_pos"
                @mousedown="startContinuousJog('X', 1)"
                @mouseup="stopContinuousJog"
                @mouseleave="stopContinuousJog"
                @touchstart.prevent="startContinuousJog('X', 1)"
                @touchend="stopContinuousJog"
                @touchcancel="stopContinuousJog"
                :disabled="!props.connected || !isRobotEnabled"
                class="w-10 h-8 flex items-center justify-center p-0 border border-slate-700 bg-slate-900 text-slate-300 hover:text-[#2ec6d6] hover:border-[#2ec6d6] disabled:border-slate-800 disabled:text-slate-600 rounded text-xs font-black transition-all select-none active:scale-95 cursor-pointer disabled:cursor-not-allowed disabled:active:scale-100"
              >
                X+
              </button>
            </div>
          </div>

          <!-- Axis Y -->
          <div class="flex items-center justify-between bg-slate-950/60 p-2 rounded-lg border border-slate-900/85">
            <span class="text-slate-300 font-extrabold text-sm w-4 select-none">Y</span>
            <div class="flex gap-1">
              <button
                id="jog_btn_y_neg"
                @mousedown="startContinuousJog('Y', -1)"
                @mouseup="stopContinuousJog"
                @mouseleave="stopContinuousJog"
                @touchstart.prevent="startContinuousJog('Y', -1)"
                @touchend="stopContinuousJog"
                @touchcancel="stopContinuousJog"
                :disabled="!props.connected || !isRobotEnabled"
                class="w-10 h-8 flex items-center justify-center p-0 border border-slate-700 bg-slate-900 text-slate-300 hover:text-[#2ec6d6] hover:border-[#2ec6d6] disabled:border-slate-800 disabled:text-slate-600 rounded text-xs font-black transition-all select-none active:scale-95 cursor-pointer disabled:cursor-not-allowed disabled:active:scale-100"
              >
                Y-
              </button>
              <button
                id="jog_btn_y_pos"
                @mousedown="startContinuousJog('Y', 1)"
                @mouseup="stopContinuousJog"
                @mouseleave="stopContinuousJog"
                @touchstart.prevent="startContinuousJog('Y', 1)"
                @touchend="stopContinuousJog"
                @touchcancel="stopContinuousJog"
                :disabled="!props.connected || !isRobotEnabled"
                class="w-10 h-8 flex items-center justify-center p-0 border border-slate-700 bg-slate-900 text-slate-300 hover:text-[#2ec6d6] hover:border-[#2ec6d6] disabled:border-slate-800 disabled:text-slate-600 rounded text-xs font-black transition-all select-none active:scale-95 cursor-pointer disabled:cursor-not-allowed disabled:active:scale-100"
              >
                Y+
              </button>
            </div>
          </div>

          <!-- Axis Z -->
          <div class="flex items-center justify-between bg-slate-950/60 p-2 rounded-lg border border-slate-900/85">
            <span class="text-slate-300 font-extrabold text-sm w-4 select-none">Z</span>
            <div class="flex gap-1">
              <button
                id="jog_btn_z_neg"
                @mousedown="startContinuousJog('Z', -1)"
                @mouseup="stopContinuousJog"
                @mouseleave="stopContinuousJog"
                @touchstart.prevent="startContinuousJog('Z', -1)"
                @touchend="stopContinuousJog"
                @touchcancel="stopContinuousJog"
                :disabled="!props.connected || !isRobotEnabled"
                class="w-10 h-8 flex items-center justify-center p-0 border border-slate-700 bg-slate-900 text-slate-300 hover:text-[#2ec6d6] hover:border-[#2ec6d6] disabled:border-slate-800 disabled:text-slate-600 rounded text-xs font-black transition-all select-none active:scale-95 cursor-pointer disabled:cursor-not-allowed disabled:active:scale-100"
              >
                Z-
              </button>
              <button
                id="jog_btn_z_pos"
                @mousedown="startContinuousJog('Z', 1)"
                @mouseup="stopContinuousJog"
                @mouseleave="stopContinuousJog"
                @touchstart.prevent="startContinuousJog('Z', 1)"
                @touchend="stopContinuousJog"
                @touchcancel="stopContinuousJog"
                :disabled="!props.connected || !isRobotEnabled"
                class="w-10 h-8 flex items-center justify-center p-0 border border-slate-700 bg-slate-900 text-slate-300 hover:text-[#2ec6d6] hover:border-[#2ec6d6] disabled:border-slate-800 disabled:text-slate-600 rounded text-xs font-black transition-all select-none active:scale-95 cursor-pointer disabled:cursor-not-allowed disabled:active:scale-100"
              >
                Z+
              </button>
            </div>
          </div>

          <!-- Axis U -->
          <div class="flex items-center justify-between bg-slate-950/60 p-2 rounded-lg border border-slate-900/85">
            <span class="text-slate-300 font-extrabold text-sm w-4 select-none">U</span>
            <div class="flex gap-1">
              <button
                id="jog_btn_u_neg"
                @mousedown="startContinuousJog('U', -1)"
                @mouseup="stopContinuousJog"
                @mouseleave="stopContinuousJog"
                @touchstart.prevent="startContinuousJog('U', -1)"
                @touchend="stopContinuousJog"
                @touchcancel="stopContinuousJog"
                :disabled="!props.connected || !isRobotEnabled"
                class="w-10 h-8 flex items-center justify-center p-0 border border-slate-700 bg-slate-900 text-slate-300 hover:text-[#2ec6d6] hover:border-[#2ec6d6] disabled:border-slate-800 disabled:text-slate-600 rounded text-xs font-black transition-all select-none active:scale-95 cursor-pointer disabled:cursor-not-allowed disabled:active:scale-100"
              >
                U-
              </button>
              <button
                id="jog_btn_u_pos"
                @mousedown="startContinuousJog('U', 1)"
                @mouseup="stopContinuousJog"
                @mouseleave="stopContinuousJog"
                @touchstart.prevent="startContinuousJog('U', 1)"
                @touchend="stopContinuousJog"
                @touchcancel="stopContinuousJog"
                :disabled="!props.connected || !isRobotEnabled"
                class="w-10 h-8 flex items-center justify-center p-0 border border-slate-700 bg-slate-900 text-slate-300 hover:text-[#2ec6d6] hover:border-[#2ec6d6] disabled:border-slate-800 disabled:text-slate-600 rounded text-xs font-black transition-all select-none active:scale-95 cursor-pointer disabled:cursor-not-allowed disabled:active:scale-100"
              >
                U+
              </button>
            </div>
          </div>

        </div>
      </div>

      <div class="text-[10px] text-slate-500 font-sans italic text-center select-none pt-2.5 leading-normal">
        {{ props.language === 'zh' ? '※ 手动遥控：点击进行短距离移动；按住不放可连续高速移动。' : '※ Teleoperation advice: Tap button for single step; hold down for high-frequency continuous motion.' }}
      </div>
    </div>

  </div>
</template>
