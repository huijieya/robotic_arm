<script setup>
import { ref, computed } from "vue";
import { translations } from "../translations";
import { Database, Download, FileText } from "lucide-vue-next";
import { Logs } from "../api/index";

const props = defineProps({
  language: { type: String, default: "zh" },
  connected: { type: Boolean, default: false },
  getApiUrl: { type: Function, default: null }
});

const t = computed(() => translations[props.language]);

const types = ref(["ScaraControl", "VisionSorter"]);
const queriedLogs = ref(null);
const loading = ref(false);
const downloading = ref(false);

const handleCheckboxChange = (type) => {
  if (types.value.includes(type)) {
    types.value = types.value.filter((t) => t !== type);
  } else {
    types.value.push(type);
  }
};

const handleQueryLogs = async () => {
  if (!props.connected) return;
  loading.value = true;
  try {
    const res = await Logs.list(types.value);
    if (res.data && res.data.success && res.data.data) {
      queriedLogs.value = res.data.data;
    }
  } catch (e) {
    // ignore
  } finally {
    loading.value = false;
  }
};

const handleDownloadLogs = async () => {
  if (!props.connected || !queriedLogs.value) return;
  downloading.value = true;
  
  const scaraNames = (queriedLogs.value.ScaraControl || []).map((file) => file.name);
  const visionNames = (queriedLogs.value.VisionSorter || []).map((file) => file.name);

  try {
    const res = await Logs.download(scaraNames, visionNames);
    if (res.data) {
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `scara_industrial_logs_2026_06_05.tar`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }
  } catch (e) {
    alert(`Export failed: ${e}`);
  } finally {
    downloading.value = false;
  }
};

const formatSize = (bytes) => {
  return `${(bytes / 1024).toFixed(1)} KB`;
};
</script>

<template>
  <div class="p-4 rounded-xl border border-slate-800 transition-all bg-slate-900/80">
    
    <!-- Title -->
    <div class="flex items-center justify-between mb-3 border-b pb-2 border-cyan-500/10">
      <div class="flex items-center gap-2">
        <Database class="text-[#2ec6d6]" :size="18" />
        <span class="font-display font-bold text-sm text-white">
          {{ t.logsTitle }}
        </span>
      </div>
      <div class="font-mono text-[10px] text-slate-500">
        LOG RETRIEVAL ENGINE v2
      </div>
    </div>

    <!-- Select Options types checkboxes -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 text-xs font-mono">
      <label class="p-3 rounded-lg border border-slate-800 flex items-center justify-between cursor-pointer transition-all bg-slate-950/40 text-slate-300 hover:border-cyan-500/30">
        <div class="flex items-center gap-2">
          <input
            id="checkbox_scara_control"
            type="checkbox"
            :checked="types.includes('ScaraControl')"
            @change="handleCheckboxChange('ScaraControl')"
            class="accent-[#2ec6d6] cursor-pointer"
          />
          <span>ScaraControl Logs</span>
        </div>
        <span class="text-[10px] text-slate-500">/logs</span>
      </label>

      <label class="p-3 rounded-lg border border-slate-800 flex items-center justify-between cursor-pointer transition-all bg-slate-950/40 text-slate-300 hover:border-cyan-500/30">
        <div class="flex items-center gap-2">
          <input
            id="checkbox_vision_sorter"
            type="checkbox"
            :checked="types.includes('VisionSorter')"
            @change="handleCheckboxChange('VisionSorter')"
            class="accent-[#2ec6d6] cursor-pointer"
          />
          <span>VisionSorter Logs</span>
        </div>
        <span class="text-[10px] text-slate-500">/build/log</span>
      </label>
    </div>

    <!-- Query logs button trigger -->
    <div class="flex gap-3 mb-4">
      <button
        id="query_logs_btn"
        @click="handleQueryLogs"
        :disabled="!props.connected || loading || types.length === 0"
        :class="['flex-1 py-2 text-xs font-display font-semibold rounded-lg shadow-sm cursor-pointer transition-all', props.connected && types.length > 0 ? 'bg-[#2ec6d6] text-cyan-950 hover:bg-[#2ec6d6]/80 active:scale-95' : 'bg-slate-800 text-slate-600 cursor-not-allowed']"
      >
        {{ loading ? "SEARCHING..." : t.queryLogs }}
      </button>

      <button
        v-if="queriedLogs"
        id="download_logs_btn"
        @click="handleDownloadLogs"
        :disabled="downloading"
        class="px-4 py-2 bg-slate-800 border border-slate-700 hover:border-[#2ec6d6] text-white hover:text-[#2ec6d6] rounded-lg text-xs font-display font-semibold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
      >
        <Download :size="13" />
        <span>{{ downloading ? "PACKING..." : t.downloadLogs }}</span>
      </button>
    </div>

    <!-- Log files table list section -->
    <div v-if="queriedLogs" class="space-y-4 max-h-[220px] overflow-y-auto pr-1 no-scrollbar font-mono text-xs">
      
      <!-- ScaraControl logs -->
      <div v-if="types.includes('ScaraControl') && queriedLogs.ScaraControl" id="scara_logs_group" class="space-y-1.5">
        <span class="text-[10px] uppercase font-bold text-[#2ec6d6] block">
          📦 Directory: ScaraControl Logs (/workspace/logs)
        </span>
        <template v-if="queriedLogs.ScaraControl.length > 0">
          <div 
            v-for="file in queriedLogs.ScaraControl"
            :id="`scara_log_${file.name.replace(/[^a-zA-Z0-9]/g, '_')}`"
            :key="file.name"
            class="p-2.5 rounded border border-slate-800 flex items-center justify-between text-[11px] bg-slate-955 bg-slate-950 text-slate-300"
          >
            <div class="flex items-center gap-2">
              <FileText :size="14" class="text-[#2ec6d6]" />
              <span class="font-semibold text-slate-200">{{ file.name }}</span>
            </div>
            <div class="flex items-center gap-3 text-slate-500">
              <span>{{ formatSize(file.size) }}</span>
              <span>{{ file.lastModifiedAt }}</span>
            </div>
          </div>
        </template>
        <div v-else class="text-[10px] text-slate-500 pl-3">No Scara logs found.</div>
      </div>

      <!-- VisionSorter logs -->
      <div v-if="types.includes('VisionSorter') && queriedLogs.VisionSorter" id="vision_logs_group" class="space-y-1.5 mt-2">
        <span class="text-[10px] uppercase font-bold text-amber-500 block">
          📦 Directory: VisionSorter Logs (/scara_control/build/log)
        </span>
        <template v-if="queriedLogs.VisionSorter.length > 0">
          <div 
            v-for="file in queriedLogs.VisionSorter"
            :id="`vision_log_${file.name.replace(/[^a-zA-Z0-9]/g, '_')}`"
            :key="file.name"
            class="p-2.5 rounded border border-slate-800 flex items-center justify-between text-[11px] bg-slate-950 text-slate-300"
          >
            <div class="flex items-center gap-2">
              <FileText :size="14" class="text-amber-500" />
              <span class="font-semibold text-slate-200">{{ file.name }}</span>
            </div>
            <div class="flex items-center gap-3 text-slate-500">
              <span>{{ formatSize(file.size) }}</span>
              <span>{{ file.lastModifiedAt }}</span>
            </div>
          </div>
        </template>
        <div v-else class="text-[10px] text-slate-500 pl-3">No Vision logs found.</div>
      </div>

    </div>
    <div v-else class="p-4 rounded-lg text-center font-mono text-xs border bg-slate-950/20 border-slate-900 text-slate-500">
      {{ props.language === 'zh' ? '尚未发起查询。点击“查询选定日志”提取系统实时生成的文件信息。' : 'Logs catalog offline. Send search query to retrieve file indexing tables.' }}
    </div>
  </div>
</template>
