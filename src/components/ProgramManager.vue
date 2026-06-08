<script setup>
import { ref, computed } from "vue";
import { translations } from "../translations";
import { Program } from "../api";
import { Play, Pause, Square, Cpu, Layers, CheckCircle2, AlertCircle } from "lucide-vue-next";

const props = defineProps({
  language: { type: String, default: "zh" },
  connected: { type: Boolean, default: false },
  robotStatus: { type: String, default: "braking" },
  programStatus: { type: String, default: "idle" }
});

const emit = defineEmits(["status-message", "refresh"]);

const t = computed(() => translations[props.language]);

const selectedTask = ref(255);

const tasks = computed(() => [
  { id: 1, name: t.value.taskDesc2 },
  { id: 2, name: t.value.taskDesc3 },
  { id: 255, name: t.value.taskDesc1 },
]);

const currentTaskName = computed(() => {
  const task = tasks.value.find(tk => tk.id === selectedTask.value);
  return task ? task.name : "";
});

// Front-end state safety constraints as specified in the industrial document
// 1. Run Task: robot status is not "running" AND program is not paused
const canRun = computed(() => {
  return props.connected && props.robotStatus !== "running" && props.programStatus !== "pause";
});

// 2. Pause Task: program is actively running
const canPause = computed(() => {
  return props.connected && props.programStatus === "run";
});

// 3. Resume Task: program must be in "pause" state
const canResume = computed(() => {
  return props.connected && props.programStatus === "pause";
});

// 4. Stop Task: program is either running or paused
const canStop = computed(() => {
  return props.connected && (props.programStatus === "run" || props.programStatus === "pause");
});

const actionPending = ref(false);
const operationLog = ref([]);

const logAction = (msg) => {
  const time = new Date().toLocaleTimeString();
  operationLog.value.unshift(`[${time}] ${msg}`);
  if (operationLog.value.length > 20) {
    operationLog.value.pop();
  }
};

const triggerRun = async () => {
  if (!canRun.value) return;
  actionPending.value = true;
  try {
    const res = await Program.run(selectedTask.value);
    if (res.data && res.data.success) {
      logAction(`${t.value.runSuccessMsg} (Task ${selectedTask.value})`);
      emit("status-message", { text: t.value.runSuccessMsg, type: "success" });
    } else {
      const err = res.data?.data || "API Error";
      logAction(`ERR: ${err}`);
      emit("status-message", { text: `Error: ${err}`, type: "error" });
    }
  } catch (error) {
    logAction(`ERR: ${error.message}`);
    emit("status-message", { text: error.message, type: "error" });
  } finally {
    actionPending.value = false;
  }
};

const triggerPause = async () => {
  if (!canPause.value) return;
  actionPending.value = true;
  try {
    const res = await Program.pause(selectedTask.value);
    if (res.data && res.data.success) {
      logAction(`${t.value.pauseSuccessMsg} (Task ${selectedTask.value})`);
      emit("status-message", { text: t.value.pauseSuccessMsg, type: "success" });
    } else {
      const err = res.data?.data || "API Error";
      logAction(`ERR: ${err}`);
      emit("status-message", { text: `Error: ${err}`, type: "error" });
    }
  } catch (error) {
    logAction(`ERR: ${error.message}`);
    emit("status-message", { text: error.message, type: "error" });
  } finally {
    actionPending.value = false;
  }
};

const triggerResume = async () => {
  if (!canResume.value) return;
  actionPending.value = true;
  try {
    const res = await Program.resume(selectedTask.value);
    if (res.data && res.data.success) {
      logAction(`${t.value.resumeSuccessMsg} (Task ${selectedTask.value})`);
      emit("status-message", { text: t.value.resumeSuccessMsg, type: "success" });
    } else {
      const err = res.data?.data || "API Error";
      logAction(`ERR: ${err}`);
      emit("status-message", { text: `Error: ${err}`, type: "error" });
    }
  } catch (error) {
    logAction(`ERR: ${error.message}`);
    emit("status-message", { text: error.message, type: "error" });
  } finally {
    actionPending.value = false;
  }
};

const triggerStop = async () => {
  if (!canStop.value) return;
  actionPending.value = true;
  try {
    const res = await Program.stop(selectedTask.value);
    if (res.data && res.data.success) {
      logAction(`${t.value.stopSuccessMsg} (Task ${selectedTask.value})`);
      emit("status-message", { text: t.value.stopSuccessMsg, type: "success" });
    } else {
      const err = res.data?.data || "API Error";
      logAction(`ERR: ${err}`);
      emit("status-message", { text: `Error: ${err}`, type: "error" });
    }
  } catch (error) {
    logAction(`ERR: ${error.message}`);
    emit("status-message", { text: error.message, type: "error" });
  } finally {
    actionPending.value = false;
  }
};

const statusColorClass = computed(() => {
  if (props.programStatus === "run") return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
  if (props.programStatus === "pause") return "text-amber-400 bg-amber-500/10 border-amber-500/20";
  if (props.programStatus === "error") return "text-rose-400 bg-rose-500/10 border-rose-500/20";
  return "text-slate-400 bg-slate-950/60 border-slate-800/40";
});

const statusText = computed(() => {
  if (props.programStatus === "run") return t.value.taskRunning;
  if (props.programStatus === "pause") return t.value.taskPaused;
  if (props.programStatus === "error") return t.value.taskError;
  return t.value.taskIdle;
});
</script>

<template>
  <div class="p-5 rounded-2xl border bg-slate-900/60 border-slate-800/80 shadow-xl relative transition-all duration-200 hover:border-cyan-500/10 box-glow space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between pb-1 select-none">
      <h3 class="text-base sm:text-lg font-bold text-slate-100 tracking-tight">
        {{ t.programManagerTitle }}
      </h3>
      <!-- Telemetry Status Pill -->
      <span :class="['px-2.5 py-0.5 rounded-full text-[10px] font-semibold border', statusColorClass]">
        {{ statusText }}
      </span>
    </div>

    <!-- Active Program Task Selector -->
    <div class="space-y-2">
      <label class="text-[10px] uppercase font-bold text-slate-500 tracking-wider font-mono block select-none">
        {{ t.selectTaskLabel }}
      </label>
      <div class="grid grid-cols-1 gap-2">
        <button
          v-for="task in tasks"
          :id="`program_task_select_btn_${task.id}`"
          :key="task.id"
          @click="selectedTask = task.id"
          :disabled="props.robotStatus === 'running' || props.programStatus === 'run' || props.programStatus === 'pause'"
          :class="[
            'p-3 text-left rounded-xl border text-xs font-medium cursor-pointer transition-all flex items-start gap-2.5',
            selectedTask === task.id
              ? 'bg-cyan-955/20 border-cyan-500/25 text-slate-100 shadow-sm'
              : 'bg-slate-950/40 border-slate-800/50 text-slate-400 hover:text-white hover:border-slate-700',
            (props.robotStatus === 'running' || props.programStatus === 'run' || props.programStatus === 'pause')
              ? 'opacity-65 cursor-not-allowed hover:text-slate-400 hover:border-slate-850'
              : ''
          ]"
        >
          <span :class="['h-4 w-4 rounded-full border flex items-center justify-center mt-0.5 font-bold font-mono text-[9px] shrink-0', selectedTask === task.id ? 'border-cyan-500/40 text-cyan-400 bg-cyan-500/10' : 'border-slate-700 text-slate-500']">
            {{ task.id }}
          </span>
          <div class="space-y-0.5 leading-tight">
            <span class="font-semibold block text-[11.5px] select-none">
              {{ t.taskTitleName.replace('{id}', task.id) }}
            </span>
            <span class="text-[10px] text-slate-400 font-normal">
              {{ task.name }}
            </span>
          </div>
        </button>
      </div>
    </div>

    <!-- Multi-state Action Row Controls -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
      <!-- 1. RUN -->
      <button
        id="program_btn_run"
        @click="triggerRun"
        :disabled="!canRun || actionPending"
        :class="[
          'py-2 px-1 rounded-lg border text-[11px] font-semibold flex flex-col items-center justify-center gap-1 transition-all select-none cursor-pointer',
          canRun && !actionPending
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 active:scale-95'
            : 'bg-slate-950/20 border-slate-850/40 text-slate-600 cursor-not-allowed'
        ]"
      >
        <Play :size="13" class="shrink-0" />
        <span>{{ t.runTaskBtn }}</span>
      </button>

      <!-- 2. PAUSE -->
      <button
        id="program_btn_pause"
        @click="triggerPause"
        :disabled="!canPause || actionPending"
        :class="[
          'py-2 px-1 rounded-lg border text-[11px] font-semibold flex flex-col items-center justify-center gap-1 transition-all select-none cursor-pointer',
          canPause && !actionPending
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20 active:scale-95'
            : 'bg-slate-950/20 border-slate-850/40 text-slate-600 cursor-not-allowed'
        ]"
      >
        <Pause :size="13" class="shrink-0" />
        <span>{{ t.pauseTaskBtn }}</span>
      </button>

      <!-- 3. RESUME -->
      <button
        id="program_btn_resume"
        @click="triggerResume"
        :disabled="!canResume || actionPending"
        :class="[
          'py-2 px-1 rounded-lg border text-[11px] font-semibold flex flex-col items-center justify-center gap-1 transition-all select-none cursor-pointer',
          canResume && !actionPending
            ? 'bg-[#2ec6d6]/10 border-[#2ec6d6]/30 text-cyan-300 hover:bg-[#2ec6d6]/20 active:scale-95'
            : 'bg-slate-950/20 border-slate-850/40 text-slate-600 cursor-not-allowed'
        ]"
      >
        <Play :size="13" class="shrink-0 animate-pulse text-[#2ec6d6]" />
        <span>{{ t.resumeTaskBtn }}</span>
      </button>

      <!-- 4. STOP -->
      <button
        id="program_btn_stop"
        @click="triggerStop"
        :disabled="!canStop || actionPending"
        :class="[
          'py-2 px-1 rounded-lg border text-[11px] font-semibold flex flex-col items-center justify-center gap-1 transition-all select-none cursor-pointer',
          canStop && !actionPending
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20 active:scale-95'
            : 'bg-slate-950/20 border-slate-850/40 text-slate-600 cursor-not-allowed'
        ]"
      >
        <Square :size="13" class="shrink-0 text-rose-400" />
        <span>{{ t.stopTaskBtn }}</span>
      </button>
    </div>

    <!-- Mini Telemetry Event Logger -->
    <div class="space-y-1 pt-1">
      <div class="flex items-center justify-between text-[10px] text-slate-500 font-mono font-bold select-none">
        <span>LOGS</span>
        <span class="text-[9px] font-normal text-slate-600 uppercase">Interactive Timeline</span>
      </div>
      <div class="bg-slate-950/80 rounded-lg p-2.5 border border-slate-800/50 font-mono text-[9px] text-slate-400 h-[70px] overflow-y-auto space-y-1 shadow-inner scrollbar-thin">
        <div v-if="operationLog.length === 0" class="text-slate-600 italic select-none text-center pt-3">
          SYSTEM IDLE | SELECT A TASK PROGRAM TO INITIATE RUN
        </div>
        <div v-for="(log, idx) in operationLog" :key="idx" :class="[log.includes('ERR') ? 'text-rose-400' : 'text-slate-400']">
          {{ log }}
        </div>
      </div>
    </div>
  </div>
</template>
