<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { Language, CalibrationData } from "../types";
import { translations } from "../translations";
import { 
  Link, Play, Square, AlertTriangle, Settings, 
  Gauge, Sparkles, Navigation2, ZapOff, CheckCircle 
} from "lucide-vue-next";

interface ControlDashboardProps {
  language: Language;
  connected: boolean;
  ip: string;
  initialized: boolean;
  robotStatus: string;
  robotStatusCode: number;
  speedRatio: number;
  calib: CalibrationData;
  isDark: boolean;
}

const props = defineProps<ControlDashboardProps>();
const emit = defineEmits([
  "connect", "initialize", "enable", "disable", 
  "clear-error", "trigger-sim-error", "speed-ratio-change", 
  "jog", "trigger-calibration"
]);

const t = computed(() => translations[props.language]);

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

// Jog parameters states
const selectedAxis = ref<"X" | "Y" | "Z" | "U">("X");
const jogDir = ref<1 | -1>(1);
const jogDist = ref<number>(10);

const handleConnectClick = async () => {
  connecting.value = true;
  emit("connect", inputIp.value);
  setTimeout(() => {
    connecting.value = false;
  }, 1000);
};

const handleSpeedSliderChange = (e: any) => {
  localSpeedRatio.value = parseInt(e.target.value);
};

const handleSpeedRelease = () => {
  emit("speed-ratio-change", localSpeedRatio.value);
};

const handleJogClick = () => {
  emit("jog", selectedAxis.value, jogDir.value, jogDist.value);
};
</script>

<template>
  <div class="space-y-6">
    
    <!-- 1. Device Connections Bento Item -->
    <div :class="['p-4 rounded-xl border transition-all', props.isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-zinc-200 shadow-sm']">
      <h4 class="flex items-center gap-2 font-display font-bold text-sm mb-3 text-[#2ec6d6]">
        <Link :size="16" />
        <span>{{ props.language === 'zh' ? '第一步：建立通信连接' : 'Step 1: Connect Controller' }}</span>
      </h4>

      <div class="flex flex-col sm:flex-row items-stretch gap-3">
        <div class="relative flex-1">
          <input
            id="controller_ip_input"
            type="text"
            v-model="inputIp"
            placeholder="192.168.1.220"
            :disabled="props.connected"
            :class="['w-full px-3 py-2 text-xs font-mono rounded-lg border transition-all outline-none', props.isDark ? 'bg-slate-950 border-slate-800 text-cyan-300 focus:border-cyan-500' : 'bg-slate-50 border-zinc-300 text-zinc-800 focus:border-[#2ec6d6]']"
          />
        </div>
        <button
          id="connect_ip_btn"
          @click="handleConnectClick"
          :disabled="props.connected || connecting"
          :class="['px-5 py-2 text-xs font-display font-semibold rounded-lg shadow-sm transition-all cursor-pointer', props.connected ? 'bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 cursor-default' : 'bg-[#2ec6d6] text-cyan-950 hover:bg-[#2ec6d6]/80 active:scale-95']"
        >
          {{ connecting ? t.connecting : props.connected ? t.connected : t.connectBtn }}
        </button>
      </div>
    </div>

    <!-- 2. Arm Status & Activation Bento Item -->
    <div :class="['p-4 rounded-xl border transition-all', props.isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-zinc-200 shadow-sm']">
      <h4 class="flex items-center gap-2 font-display font-bold text-sm mb-4 text-[#2ec6d6]">
        <Settings :size="16" />
        <span>{{ props.language === 'zh' ? '第二步与第三步：控制与使能状态' : 'Step 2 & 3: Initialization & Enable Controls' }}</span>
      </h4>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        <!-- Quick Stats Pillar -->
        <div class="space-y-2.5">
          <div class="text-xs text-slate-400 font-medium">
            {{ t.controllerState }}:
          </div>
          <div :class="['p-3 rounded-lg border font-mono text-center flex flex-col justify-center min-h-[70px]', props.isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-zinc-200']">
            <span :class="['text-[11px] font-bold', props.initialized ? 'text-[#2ec6d6]' : 'text-amber-500 animate-pulse']">
              {{ props.initialized ? t.initSuccess : t.notSet }}
            </span>
            <span class="text-[9px] text-slate-500 mt-1">
              {{ props.initialized ? "PROG_ALLOW_JOG (reg881 = 2)" : "WAIT_INITIAL_HANDSHAKE" }}
            </span>
          </div>

          <!-- Arm status pill -->
          <div class="text-xs text-slate-400 font-medium">
            {{ props.language === 'zh' ? '机械臂当前状态' : 'Mechanical Arm Status' }}:
          </div>
          <div :class="['p-3 rounded-lg border font-mono text-center flex items-center justify-center gap-2 min-h-[50px]', props.robotStatusCode === 3 || props.robotStatusCode === 4 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : props.robotStatusCode === 1 ? 'bg-rose-500/10 border-rose-500/30 text-rose-500 animate-pulse' : 'bg-amber-500/10 border-amber-500/30 text-amber-500']">
            <template v-if="props.robotStatusCode === 3 || props.robotStatusCode === 4">
              <CheckCircle :size="14" class="animate-spin text-emerald-400" />
              <span class="text-xs font-bold">{{ t.enabled }}</span>
            </template>
            <template v-else-if="props.robotStatusCode === 1">
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
    <div :class="['p-4 rounded-xl border transition-all', props.isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-zinc-200 shadow-sm']">
      <div class="flex items-center justify-between mb-2">
        <h4 class="flex items-center gap-2 font-display font-bold text-sm text-[#2ec6d6]">
          <Gauge :size="16" />
          <span>{{ t.speedRatio }}</span>
        </h4>
        <span class="font-mono text-xs font-extrabold text-[#2ec6d6] px-2 py-0.5 rounded bg-[#2ec6d6]/10">
          {{ localSpeedRatio }}%
        </span>
      </div>

      <input
        id="speed_ratio_slider"
        type="range"
        min="0"
        max="100"
        :value="localSpeedRatio"
        :disabled="!props.connected"
        @input="handleSpeedSliderChange"
        @mouseup="handleSpeedRelease"
        @touchend="handleSpeedRelease"
        class="w-full accent-[#2ec6d6] bg-slate-800 rounded-lg appearance-none h-2 cursor-pointer disabled:cursor-not-allowed"
      />
      <div class="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
        <span>0 (SLOW)</span>
        <span>50 (OPTIMIZED)</span>
        <span>100 (HIGH SPEED)</span>
      </div>
    </div>

    <!-- 4. Auto Calibration Panel -->
    <div :class="['p-4 rounded-xl border transition-all', props.isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-zinc-200 shadow-sm']">
      <div class="flex items-center justify-between mb-3 pb-2 border-b border-cyan-500/10">
        <h4 class="flex items-center gap-2 font-display font-bold text-sm text-[#2ec6d6]">
          <Sparkles :size="16" />
          <span>{{ t.autoCalib }}</span>
        </h4>
        <button
          id="start_autocalib_btn"
          @click="emit('trigger-calibration')"
          :disabled="!props.connected || props.robotStatusCode !== 3 || props.calib.running"
          :class="['px-3 py-1.5 text-[11px] font-display font-semibold rounded-lg shadow-sm transition-all cursor-pointer', props.connected && props.robotStatusCode === 3 && !props.calib.running ? 'bg-[#2ec6d6] text-cyan-950 hover:bg-[#2ec6d6]/80 active:scale-95' : 'bg-slate-800 text-slate-600 cursor-not-allowed']"
        >
          {{ props.calib.running ? "CALIBRATING..." : "START CALIBRATION" }}
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

    <!-- 5. Jog Interactive Step controls -->
    <div :class="['p-4 rounded-xl border transition-all', props.isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-zinc-200 shadow-sm']">
      <h4 class="flex items-center gap-2 font-display font-bold text-sm mb-3 text-[#2ec6d6]">
        <Navigation2 :size="16" class="rotate-45" />
        <span>{{ t.manualOption }}</span>
      </h4>

      <div class="grid grid-cols-3 gap-3 text-xs mb-3 font-mono">
        <div class="space-y-1">
          <span class="text-slate-400 block text-[10px]">{{ t.jogAxis }}:</span>
          <select
            id="jog_axis_select"
            v-model="selectedAxis"
            :class="['w-full px-2 py-1.5 rounded-md border text-[11px]', props.isDark ? 'bg-slate-950 border-slate-800 text-cyan-300' : 'bg-white border-zinc-300 text-zinc-800']"
          >
            <option value="X">AXIS X (X-axis)</option>
            <option value="Y">AXIS Y (Y-axis)</option>
            <option value="Z">AXIS Z (Vertical)</option>
            <option value="U">AXIS U (Flange °)</option>
          </select>
        </div>

        <div class="space-y-1">
          <span class="text-slate-400 block text-[10px]">{{ t.jogDirection }}:</span>
          <select
            id="jog_dir_select"
            v-model.number="jogDir"
            :class="['w-full px-2 py-1.5 rounded-md border text-[11px]', props.isDark ? 'bg-slate-950 border-slate-800 text-cyan-300' : 'bg-white border-zinc-300 text-zinc-800']"
          >
            <option :value="1">+ dir (Positive)</option>
            <option :value="-1">- dir (Negative)</option>
          </select>
        </div>

        <div class="space-y-1">
          <span class="text-slate-400 block text-[10px]">{{ t.jogStepDist }}:</span>
          <input
            id="jog_dist_input"
            type="number"
            v-model.number="jogDist"
            :class="['w-full px-2 py-1 rounded border text-[11px]', props.isDark ? 'bg-slate-950 border-slate-800 text-cyan-300' : 'bg-white border-zinc-300 text-zinc-850']"
          />
        </div>
      </div>

      <!-- Rapid presets -->
      <div class="flex items-center gap-1.5 mb-3 font-mono">
        <span class="text-[10px] text-slate-500">QUICK PRESET:</span>
        <button
          v-for="num in [0.5, 1, 10, 50]"
          :id="`quick_preset_${num}`"
          :key="num"
          @click="jogDist = num"
          :class="['px-2 py-0.5 text-[9px] rounded font-bold border transition-all cursor-pointer', jogDist === num ? 'bg-[#2ec6d6] text-cyan-950 border-cyan-400' : props.isDark ? 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 border-zinc-200 text-zinc-600 hover:bg-slate-200']"
        >
          {{ num }}{{ selectedAxis === 'U' ? '°' : 'mm' }}
        </button>
      </div>

      <button
        id="trigger_jog_step_btn"
        @click="handleJogClick"
        :disabled="!props.connected || props.robotStatusCode !== 3"
        :class="['w-full py-2.5 rounded-lg text-xs font-display font-bold shadow-sm cursor-pointer transition-all', props.connected && props.robotStatusCode === 3 ? 'bg-[#2ec6d6]/25 border border-[#2ec6d6] text-[#2ec6d6] hover:bg-[#2ec6d6]/35 active:scale-95' : 'bg-slate-800 text-slate-600 border border-transparent cursor-not-allowed']"
      >
        {{ t.triggerJog }}
      </button>
    </div>

  </div>
</template>
