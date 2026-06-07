<script setup lang="ts">
import { ref, watch, computed, onUnmounted } from "vue";
import { Language } from "../types";
import { translations } from "../translations";
import { Zap, Disc } from "lucide-vue-next";

interface ArmVisualizerProps {
  language: Language;
  pose: { x: number; y: number; z: number; u: number };
  robotStatus: string;
  isDark: boolean;
  visionRunning: boolean;
}

const props = defineProps<ArmVisualizerProps>();

const cargoPos = ref(0);
const grabbing = ref(false);
const targetBox = ref(-1);

const t = computed(() => translations[props.language]);

// Math equations mapping physical pose coordinates to SVG visual anchors
const normalizedX = computed(() => {
  return Math.min(Math.max(((props.pose.x - 400) / 300) * 150 + 150, 80), 280);
});

const normalizedY = computed(() => {
  return Math.min(Math.max(((Math.abs(props.pose.y) - 600) / 200) * 100 + 40, 30), 150);
});

const jointZHeight = computed(() => {
  return Math.min(Math.max((props.pose.z / 30) * 40, 2), 60); // height offset for Z axis
});

const angleTheta = computed(() => {
  return props.pose.u; // Rotation joint angle
});

let interval: any = null;

watch(() => props.visionRunning, (isRunning) => {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
  if (isRunning) {
    interval = setInterval(() => {
      cargoPos.value += 3;
      if (cargoPos.value > 110) {
        grabbing.value = true;
        const boxIdx = Math.floor(Math.random() * 3);
        targetBox.value = boxIdx;
        setTimeout(() => {
          grabbing.value = false;
        }, 1200);
        cargoPos.value = 0;
      }
    }, 100);
  } else {
    cargoPos.value = 0;
    grabbing.value = false;
    targetBox.value = -1;
  }
}, { immediate: true });

onUnmounted(() => {
  if (interval) clearInterval(interval);
});
</script>

<template>
  <div :class="['rounded-xl border p-4 transition-all relative overflow-hidden', props.isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-zinc-200 shadow-sm']">
    
    <!-- Title -->
    <div class="flex items-center justify-between mb-3 border-b pb-2 border-cyan-500/10">
      <div class="flex items-center gap-2">
        <Zap class="text-[#2ec6d6]" :size="18" />
        <span :class="['font-display font-bold text-sm', props.isDark ? 'text-white' : 'text-zinc-800']">
          {{ t.conveyorAnim }}
        </span>
      </div>
      <div class="flex items-center gap-1.5 font-mono text-[10px]">
        <span :class="['px-2 py-0.5 rounded font-bold', props.robotStatus === '运行' || props.visionRunning ? 'bg-[#2ec6d6]/20 text-[#2ec6d6] animate-pulse' : 'bg-slate-700/20 text-slate-400']">
          {{ props.robotStatus === "运行" || props.visionRunning ? "ACTIVE MOTION" : "MOTOR DISARMED" }}
        </span>
      </div>
    </div>

    <!-- Vector Arm Scene -->
    <div class="relative w-full aspect-[4/3] rounded-lg overflow-hidden bg-slate-950 border border-slate-800/60 p-2 select-none">
      
      <!-- Background industrial coordinates schema grids -->
      <div class="absolute inset-0 grid grid-cols-8 grid-rows-6 pointer-events-none opacity-[0.03]">
        <div v-for="idx in 48" :key="idx" class="border-r border-b border-cyan-400" />
      </div>

      <!-- Telemetry readout -->
      <div class="absolute top-2 left-3 font-mono text-[10px] text-slate-600/80 space-y-0.5">
        <div>FEED RATE: {{ props.visionRunning ? "1.2 M/S" : "0.0 M/S" }}</div>
        <div>INSPECTION MODEL: RESNET_SCARA_V3</div>
        <div>SORT COUNTER: <span class="text-[#2ec6d6]">1,284 OK</span></div>
      </div>

      <!-- SVG -->
      <svg class="w-full h-full" viewBox="0 0 320 240">
        <!-- Legend marker lines -->
        <line x1="20" y1="210" x2="300" y2="210" stroke="#1e293b" stroke-width="2" stroke-dasharray="4 4" />
        
        <!-- Conveyor Belt bottom tracks -->
        <rect x="20" y="170" width="120" height="12" rx="3" fill="#1e293b" />
        <!-- Conveyor rotating spindles -->
        <circle cx="30" cy="176" r="4" fill="#64748b" class="animate-spin" />
        <circle cx="70" cy="176" r="4" fill="#64748b" class="animate-spin" />
        <circle cx="110" cy="176" r="4" fill="#64748b" class="animate-spin" />
        <line x1="20" y1="176" x2="130" y2="176" stroke="#475569" stroke-width="1.5" />

        <!-- Place boxes -->
        <g>
          <!-- Box 0 -->
          <rect x="180" y="165" width="30" height="20" rx="2" fill="none" :stroke="targetBox === 0 && grabbing ? '#2ec6d6' : '#475569'" stroke-width="1.5" />
          <text x="195" y="179" fill="#64748b" font-size="8" font-family="monospace" text-anchor="middle">PL0</text>
          
          <!-- Box 1 -->
          <rect x="220" y="165" width="30" height="20" rx="2" fill="none" :stroke="targetBox === 1 && grabbing ? '#2ec6d6' : '#475569'" stroke-width="1.5" />
          <text x="235" y="179" fill="#64748b" font-size="8" font-family="monospace" text-anchor="middle">PL1</text>
          
          <!-- Box 2 -->
          <rect x="260" y="165" width="30" height="20" rx="2" fill="none" :stroke="targetBox === 2 && grabbing ? '#2ec6d6' : '#475569'" stroke-width="1.5" />
          <text x="275" y="179" fill="#64748b" font-size="8" font-family="monospace" text-anchor="middle">PL2</text>
        </g>

        <!-- Material sorting package sliding block -->
        <g v-if="props.visionRunning" :transform="`translate(${20 + cargoPos}, 156)`">
          <rect v-if="!grabbing" x="0" y="0" width="14" height="10" rx="1.5" fill="#2ec6d6" opacity="0.8" class="animate-pulse" />
        </g>

        <!-- Robotic Arm Render -->
        <g>
          <!-- 1. Arm Pedestal Base -->
          <rect x="140" y="120" width="40" height="25" rx="3" fill="#334155" />
          <rect x="150" y="105" width="20" height="15" fill="#475569" />
          <circle cx="160" cy="115" r="5" fill="#2ec6d6" />

          <!-- 2. Main Segments Arm -->
          <line 
            x1="160" 
            y1="115" 
            :x2="normalizedX" 
            :y2="normalizedY" 
            stroke="#64748b" 
            stroke-width="7" 
            stroke-linecap="round" 
          />
          <line 
            x1="160" 
            y1="115" 
            :x2="normalizedX" 
            :y2="normalizedY" 
            stroke="#2ec6d6" 
            stroke-width="2.5" 
            stroke-linecap="round" 
          />

          <!-- 3. Joint 2: elbow -->
          <circle :cx="normalizedX" :cy="normalizedY" r="6" fill="#334155" stroke="#2ec6d6" stroke-width="1" />

          <!-- 4. Second Segment (Forearm / Z Shaft) -->
          <line 
            :x1="normalizedX" 
            :y1="normalizedY" 
            :x2="normalizedX" 
            :y2="normalizedY + jointZHeight" 
            stroke="#94a3b8" 
            stroke-width="4" 
            stroke-linecap="round" 
          />
          <!-- Horizontal Tool Holder -->
          <line 
            :x1="normalizedX - 8" 
            :y1="normalizedY + jointZHeight" 
            :x2="normalizedX + 8" 
            :y2="normalizedY + jointZHeight" 
            stroke="#475569" 
            stroke-width="2.5" 
          />

          <!-- 5. Tool Gripper -->
          <g :transform="`translate(${normalizedX}, ${normalizedY + jointZHeight}) rotate(${angleTheta * 20})`">
            <!-- Gripper core -->
            <rect x="-4" y="0" width="8" height="4" fill="#334155" />
            <!-- Left Prong -->
            <line x1="-4" y1="4" x2="-4" y2="10" stroke="#2ec6d6" stroke-width="1.5" />
            <!-- Right Prong -->
            <line x1="4" y1="4" x2="4" y2="10" stroke="#2ec6d6" stroke-width="1.5" />

            <!-- Cargo block inside claw -->
            <rect v-if="grabbing" x="-6" y="6" width="12" height="8" rx="1.5" fill="#2ec6d6" class="animate-pulse" />
          </g>
        </g>

        <!-- Coordinate text Overlay near end effector -->
        <g :transform="`translate(${normalizedX + 15}, ${normalizedY + jointZHeight + 10})`">
          <rect x="-4" y="-8" width="65" height="11" rx="2" fill="#0f172a" opacity="0.8" />
          <text x="2" y="0" fill="#2ec6d6" font-size="7" font-family="monospace">
            Z:{{ props.pose.z.toFixed(1) }} U:{{ props.pose.u.toFixed(1) }}°
          </text>
        </g>

        <!-- Base Coordinates Telemetry -->
        <text x="160" y="155" fill="#64748b" font-size="8" font-family="monospace" text-anchor="middle">
          X:{{ props.pose.x.toFixed(1) }} Y:{{ props.pose.y.toFixed(1) }}
        </text>
      </svg>

      <!-- Indicatorcircular widgets -->
      <div class="absolute bottom-2 right-3 flex items-center gap-2 font-mono text-[9px] text-[#2ec6d6]">
        <Disc :size="11" class="animate-spin text-cyan-400" />
        <span>AXIS RETRIEVER: REAL-TIME SECURED</span>
      </div>
    </div>

    <!-- Manual coordinates reading -->
    <div class="mt-3 grid grid-cols-4 gap-2 font-mono text-center">
      <div :class="['p-2 rounded border', props.isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-zinc-100']">
        <div class="text-[10px] text-slate-400">COORD X</div>
        <div class="text-xs font-bold text-[#2ec6d6]">{{ props.pose.x.toFixed(2) }}</div>
      </div>
      <div :class="['p-2 rounded border', props.isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-zinc-100']">
        <div class="text-[10px] text-slate-400">COORD Y</div>
        <div class="text-xs font-bold text-[#2ec6d6]">{{ props.pose.y.toFixed(2) }}</div>
      </div>
      <div :class="['p-2 rounded border', props.isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-zinc-100']">
        <div class="text-[10px] text-slate-400">COORD Z</div>
        <div class="text-xs font-bold text-[#2ec6d6]">{{ props.pose.z.toFixed(2) }}</div>
      </div>
      <div :class="['p-2 rounded border', props.isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-zinc-100']">
        <div class="text-[10px] text-slate-400">ANGLE U</div>
        <div class="text-xs font-bold text-[#2ec6d6]">{{ props.pose.u.toFixed(2) }}°</div>
      </div>
    </div>
  </div>
</template>
