<script setup>
import { ref, watch, computed, onUnmounted } from "vue";
import { translations } from "../translations";
import { Eye, Focus, RefreshCw, AlertTriangle, ShieldCheck } from "lucide-vue-next";

const props = defineProps({
  language: { type: String, default: "zh" },
  connected: { type: Boolean, default: false },
  roi: { type: Object, default: () => ({ valid: true, x: 100, y: 120, w: 300, h: 240 }) },
  teachRoiActive: { type: Boolean, default: false },
  wsBinaryBlob: { type: null, default: null }
});

const emit = defineEmits(["teach-roi-click", "teach-roi-save"]);

const t = computed(() => translations[props.language]);
const frameId = ref(0);
const resolution = ref("1280 x 960 | 60 FPS");
const latency = ref(12);
const cameraImage = ref("");
const isHovered = ref(false);
const imageRevokeUrl = ref("");

// Simulated slider coordinates for ROI setting when teachRoiActive is true
const editX = ref(props.roi.x);
const editY = ref(props.roi.y);
const editW = ref(props.roi.w);
const editH = ref(props.roi.h);

// Sync edits if ROI changes from outer scope
watch(() => props.roi, (newRoi) => {
  if (!props.teachRoiActive) {
    editX.value = newRoi.x;
    editY.value = newRoi.y;
    editW.value = newRoi.w;
    editH.value = newRoi.h;
  }
}, { deep: true, immediate: true });

// Read binary blob stream from websocket to update camera view
watch(() => props.wsBinaryBlob, (newBlob) => {
  if (newBlob) {
    const url = URL.createObjectURL(newBlob);
    if (imageRevokeUrl.value) {
      URL.revokeObjectURL(imageRevokeUrl.value);
    }
    cameraImage.value = url;
    imageRevokeUrl.value = url;
    frameId.value = (frameId.value + 1) % 99999;
    latency.value = parseFloat((4 + Math.random() * 6).toFixed(1));
  }
});

onUnmounted(() => {
  if (imageRevokeUrl.value) {
    URL.revokeObjectURL(imageRevokeUrl.value);
  }
});

const handleSaveRoi = () => {
  emit("teach-roi-save", { x: editX.value, y: editY.value, w: editW.value, h: editH.value });
};
</script>

<template>
  <div 
    id="camera_viewport_container"
    class="rounded-xl border border-slate-800 p-4 transition-all relative overflow-hidden bg-slate-900/80"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <!-- Title -->
    <div class="flex items-center justify-between mb-3 border-b pb-2 border-cyan-500/10">
      <div class="flex items-center gap-2">
        <Eye class="text-[#2ec6d6]" :size="18" />
        <span class="font-display font-bold text-sm text-white">
          {{ t.cameraFeed }}
        </span>
      </div>
    </div>

    <!-- Screen Frame -->
    <div class="relative w-full aspect-video rounded-lg overflow-hidden bg-slate-950 border border-slate-800/80">
      
      <!-- Live Camera Image Feed -->
      <template v-if="props.connected">
        <img 
          v-if="cameraImage"
          id="live_camera_feed_img"
          :src="cameraImage" 
          alt="Industrial Camera Stream" 
          class="w-full h-full object-cover opacity-85 select-none"
          referrerpolicy="no-referrer"
        />
        <div v-else class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950 text-slate-500 font-mono text-xs">
          <RefreshCw class="animate-spin text-[#2ec6d6]" :size="20" />
          <span>Receiving Blob Flow ...</span>
        </div>
      </template>
      <div v-else class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950 px-6 text-center text-slate-500 font-mono text-xs">
        <AlertTriangle class="text-amber-500/60 animate-pulse" :size="32" />
        <span class="max-w-xs">{{ props.language === 'zh' ? '尚未建立遥测。请连接左侧IP以启动相机流。' : 'No telemetry linked. Connect IP on control board to initiate camera view stream.' }}</span>
      </div>

      <!-- High Tech Telemetry HUD Overlay -->
      <div class="absolute inset-0 pointer-events-none select-none flex flex-col justify-between p-3 font-mono text-[10px] text-cyan-400/80">
        
        <!-- Top header stats -->
        <div class="flex justify-between items-start">
          <div class="space-y-0.5 bg-black/40 p-1 rounded backdrop-blur-xs border border-white/5">
            <div>LATENCY: <span class="text-white font-bold">{{ latency }}ms</span></div>
            <div>RESL: <span class="text-[#2ec6d6] font-bold">{{ resolution }}</span></div>
          </div>
          <div class="text-right space-y-0.5 bg-black/40 p-1 rounded backdrop-blur-xs border border-white/5">
            <div>FRAME: <span class="text-white font-bold">{{ frameId }}</span></div>
            <div class="flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
              <span>CAM_ONLINE</span>
            </div>
          </div>
        </div>

        <!-- Crosshair grid center -->
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="relative w-8 h-8 flex items-center justify-center">
            <div class="absolute w-full h-[1px] bg-cyan-400/40" />
            <div class="absolute h-full w-[1px] bg-cyan-400/40" />
            <div class="w-1.5 h-1.5 rounded-full bg-cyan-500" />
          </div>
        </div>

        <!-- Dashed target ROI bounding box -->
        <div 
          v-if="props.roi.valid"
          :style="{
            position: 'absolute',
            left: `${(props.roi.x / 400) * 100}%`,
            top: `${(props.roi.y / 350) * 100}%`,
            width: `${(props.roi.w / 400) * 100}%`,
            height: `${(props.roi.h / 350) * 100}%`,
            border: '1.5px dashed #2ec6d6',
          }"
          class="pointer-events-none transition-all flex items-start p-1 bg-cyan-500/5 select-none"
        >
          <span class="bg-[#2ec6d6] text-[8px] text-cyan-950 font-extrabold px-1 py-0.2 rounded-xs select-none">
            ROI BOUNDARY
          </span>
        </div>

        <!-- Bottom details footer -->
        <div class="flex justify-between items-end">
          <div class="bg-black/40 p-1 rounded backdrop-blur-xs border border-white/5">
            <div>AXIS SPEED: <span class="text-emerald-400 font-bold">OPTIMIZED</span></div>
          </div>
          <div class="text-right bg-black/40 p-1 rounded backdrop-blur-xs border border-white/5 text-[9px] text-[#2ec6d6]">
            ISO 100 | S: 1/800 | F: 2.8
          </div>
        </div>
      </div>
    </div>

    <!-- ROI Teaching Controls -->
    <div class="mt-4 space-y-3">
      <div class="flex items-center justify-between">
        <div class="flex flex-col">
          <span class="text-xs font-semibold text-slate-300">
            {{ t.teachRoiTitle }}
          </span>
          <span class="text-[10px] text-slate-400">
            {{ props.roi.valid ? `X:${props.roi.x} Y:${props.roi.y} W:${props.roi.w} H:${props.roi.h}` : t.notSet }}
          </span>
        </div>
        <button
          v-if="props.teachRoiActive"
          id="save_roi_mode_btn"
          @click="handleSaveRoi"
          class="px-3.5 py-1.5 text-xs font-display font-medium rounded-lg bg-[#2ec6d6] hover:bg-[#2ec6d6]/80 text-cyan-950 transition-all cursor-pointer shadow-md"
        >
          {{ t.exitRoiBtn }}
        </button>
        <button
          @click="emit('teach-roi-click')"
          v-else
          id="enter_roi_mode_btn"
          :disabled="!props.connected"
          :class="['px-3.5 py-1.5 text-xs font-display font-medium border rounded-lg transition-all cursor-pointer', props.connected ? 'border-[#2ec6d6] text-[#2ec6d6] hover:bg-[#2ec6d6]/10 active:scale-95' : 'border-slate-800 text-slate-500 cursor-not-allowed']"
        >
          <div class="flex items-center gap-1.5">
            <Focus :size="13" />
            <span>{{ t.teachRoiBtn }}</span>
          </div>
        </button>
      </div>

      <!-- ROI adjusting sliders -->
      <div v-if="props.teachRoiActive" class="p-3 bg-cyan-950/20 border border-cyan-500/20 rounded-lg space-y-2.5 font-mono text-[11px]">
        <p class="text-[#2ec6d6] text-xs font-semibold flex items-center gap-1.5">
          <Focus :size="14" class="animate-pulse" />
          <span>{{ t.roiDesc }}</span>
        </p>
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1">
            <div class="flex justify-between">
              <span class="text-slate-400">OFFSET X:</span>
              <span class="text-white font-bold">{{ editX }} px</span>
            </div>
            <input
              id="roi_slider_x"
              type="range"
              min="0"
              max="100"
              v-model.number="editX"
              class="w-full accent-[#2ec6d6] bg-slate-800 rounded-lg appearance-none h-1.5"
            />
          </div>
          <div class="space-y-1">
            <div class="flex justify-between">
              <span class="text-slate-400">OFFSET Y:</span>
              <span class="text-white font-bold">{{ editY }} px</span>
            </div>
            <input
              id="roi_slider_y"
              type="range"
              min="0"
              max="120"
              v-model.number="editY"
              class="w-full accent-[#2ec6d6] bg-slate-800 rounded-lg appearance-none h-1.5"
            />
          </div>
          <div class="space-y-1">
            <div class="flex justify-between">
              <span class="text-slate-400">WIDTH:</span>
              <span class="text-white font-bold">{{ editW }} px</span>
            </div>
            <input
              id="roi_slider_w"
              type="range"
              min="10"
              max="290"
              v-model.number="editW"
              class="w-full accent-[#2ec6d6] bg-slate-800 rounded-lg appearance-none h-1.5"
            />
          </div>
          <div class="space-y-1">
            <div class="flex justify-between">
              <span class="text-slate-400">HEIGHT:</span>
              <span class="text-white font-bold">{{ editH }} px</span>
            </div>
            <input
              id="roi_slider_h"
              type="range"
              min="10"
              max="240"
              v-model.number="editH"
              class="w-full accent-[#2ec6d6] bg-slate-800 rounded-lg appearance-none h-1.5"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
