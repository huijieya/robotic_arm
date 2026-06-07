<script setup>
import { ref, computed } from "vue";
import { translations } from "../translations";
import { X, Copy, Check, Terminal, Search, Info } from "lucide-vue-next";

const props = defineProps({
  language: {
    type: String,
    default: "zh"
  }
});
const emit = defineEmits(["close"]);

const ENDPOINTS = [
  {
    method: "GET",
    path: "/connect?ip=192.168.1.220",
    desc: {
      zh: "通过指定的 IP 地址连接至单机械臂控制器",
      en: "Connect to the single robotic arm controller with specified IP address",
      ja: "指定されたIPアドレスでアームコントローラーに接続します",
      ko: "지정된 IP 주소로 단일 로봇암 컨트롤러에 연결"
    },
    params: "ip (string, required): 机械臂控制器 IP 默认192.168.1.220",
    response: `{ "success": true, "code": 0, "data": null }`
  },
  {
    method: "GET",
    path: "/init",
    desc: {
      zh: "复位并初始化机械臂，准备进行程序操作",
      en: "Reset and initialize robotic arm, preparing controller for action",
      ja: "ロボットアームを自动复位・初期化し、各种动作に备えます",
      ko: "로봇암 리셋 및 초기화 수행, 프로그램 기동 가능 상태 정비"
    },
    params: "None",
    response: `{ "success": true, "code": 0, "data": null }`
  },
  {
    method: "GET",
    path: "/start",
    desc: {
      zh: "机械臂上使能（启动电机），进入可操控、自由点动及自动状态",
      en: "Enable arm (Servo-ON), entering moveable, jogging, and auto states",
      ja: "アームサーボを有効化し、主电源(可动状态)に入ります",
      ko: "로봇암 서보 온 활성화, 자유 수동 이송 및 프로그램 기동 제어"
    },
    params: "None",
    response: `{ "success": true, "code": 0, "data": null }`
  },
  {
    method: "GET",
    path: "/stop",
    desc: {
      zh: "强制制动机械臂（急停），使其立即断开使能并抱闸锁定",
      en: "Force-stop robotic arm immediately (Emergency brake & Servo-OFF)",
      ja: "急停止コマンド(即座に动作をストップしサーボオフ)",
      ko: "로봇암 동작 정지 및 서보 오프 강제 정지"
    },
    params: "None",
    response: `{ "success": true, "code": 0, "data": null }`
  },
  {
    method: "GET",
    path: "/clear_error",
    desc: {
      zh: "解除报警并清除当前机械臂由于限位、急停造成的错误状态",
      en: "Clear alarms and clear active errors resulting from limits or E-stops",
      ja: "リミット超过や非常停止によるエラーアラームを解除・リセット",
      ko: "로봇암 에러 제로화, 리미트 오버 또는 이머전시 에러 클리어"
    },
    params: "None",
    response: `{ "success": true, "code": 0, "data": null }`
  },
  {
    method: "GET",
    path: "/status",
    desc: {
      zh: "查询机械臂当前系统工作状态",
      en: "Query current mechanical system operating status",
      ja: "アーム現在のステータスを読み取ります",
      ko: "현재 로봇암 전체 종합 동작 상태 계수 조회"
    },
    params: "None",
    response: `{ "success": true, "code": 0, "data": "使能" / "制动" / "错误" / "运行" }`
  },
  {
    method: "GET",
    path: "/pose_realtime",
    desc: {
      zh: "获取机械臂当前位置的实时 4 轴三维坐标位姿 (X, Y, Z, U 角度)",
      en: "Retrieve real-time 4-axis 3D spatial coordinates (X, Y, Z, U angles)",
      ja: "現在の4轴のリアルタイム座标位置姿勢(X, Y, Z, U)を表示",
      ko: "현재 로봇암 실시간 4축 좌표 값 조회"
    },
    params: "None",
    response: `{ "success": true, "code": 0, "data": { "x": 528.61, "y": -701.51, "z": 0.47, "u": -1.68 } }`
  },
  {
    method: "GET",
    path: "/speedratio?value=50",
    desc: {
      zh: "设置机械臂全局运行速度比率 (0 - 100%)",
      en: "Set public motor velocity ratio overrides (0 to 100%)",
      ja: "ロボットアーム运动の全体速度倍率を設定 (0〜100%)",
      ko: "로봇암 전체 이동 동작 비율 설정 (0 ~ 100)"
    },
    params: "value (int, required): 0~100 的整数数值",
    response: `{ "success": true, "code": 0, "data": null }`
  },
  {
    method: "GET",
    path: "/jog_step?axis=X&dir=1&dist=10.5",
    desc: {
      zh: "沿选定运动轴方向单次位移指定的步长距离",
      en: "Displace once along chosen axis coordinate by specified offset distance",
      ja: "指定轴方向に、指定ピッチ分だけワンショット移動(ジョグ)",
      ko: "선택한 기하 이송축 방향으로 지정한 피치만큼 단발 이동 교시"
    },
    params: "axis (X/Y/Z/U); dir (1/-1); dist (float > 0)",
    response: `{ "success": true, "code": 0, "data": null }`
  },
  {
    method: "GET",
    path: "/autocalib",
    desc: {
      zh: "触发全自动手眼标定(示教点移动 → 采集 → 模型结算)，接口同步阻塞",
      en: "Trigger automatic calibration chain (hand-eye calculations, blocks response)",
      ja: "手动/自动ハンドアイキャリブレーション実行(计算完了までブロック)",
      ko: "자동 장치 캘리브레이션 트리거 실행 (완료 시까지 동기 블로킹)"
    },
    params: "None",
    response: `{ "success": true, "code": 0, "data": null }`
  },
  {
    method: "POST",
    path: "/set_roi",
    desc: {
      zh: "配置相机关注兴趣区域像素坐标 (旧版格式，文本返回)",
      en: "Configure optical camera interest boundary parameters (legacy text)",
      ja: "カメラ関心領域座标指定 (旧规格テキストレスポンス)",
      ko: "카메라 ROI 픽셀 범위 기준 파라메터 설정 (텍스트 반환)"
    },
    params: 'JSON Body: { "x": 100, "y": 200, "w": 300, "h": 250 }',
    response: "ROI SAVED"
  },
  {
    method: "POST",
    path: "/teach_point",
    desc: {
      zh: "示教并保存当前位姿为特定作用点 (pick表示抓取, place表示放置)",
      en: "Teach current mechanical coordinate to designated slot (pick/place-index)",
      ja: "現在の姿勢をティーチング点として保存(pick/place指定)",
      ko: "현재 로봇암 공간 물리 좌표를 지점 파라메터로 티칭"
    },
    params: 'JSON Body: { "type": "pick" } OR { "type": "place", "index": 1 }',
    response: "OK"
  }
];

const copiedId = ref(null);
const searchQuery = ref("");
const selectedIndex = ref(0);

const t = translations[props.language];
const backendAddress = (typeof window !== "undefined" && typeof localStorage !== "undefined") ? (localStorage.getItem("NEXUS_BACKEND_ADDRESS") || "") : "";

// Filter endpoints dynamically on search query
const filteredEndpoints = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return ENDPOINTS;
  return ENDPOINTS.filter(item => {
    const isPathMatch = item.path.toLowerCase().includes(query);
    const isMethodMatch = item.method.toLowerCase().includes(query);
    const zhDesc = item.desc.zh?.toLowerCase() || "";
    const enDesc = item.desc.en?.toLowerCase() || "";
    const jaDesc = item.desc.ja?.toLowerCase() || "";
    const koDesc = item.desc.ko?.toLowerCase() || "";
    const paramMatch = item.params.toLowerCase().includes(query);
    return isPathMatch || isMethodMatch || zhDesc.includes(query) || enDesc.includes(query) || jaDesc.includes(query) || koDesc.includes(query) || paramMatch;
  });
});

// Currently selected API based on list click
const currentEndpoint = computed(() => {
  const filtered = filteredEndpoints.value;
  if (filtered.length === 0) return null;
  // Guard index overflow
  if (selectedIndex.value >= filtered.length) {
    selectedIndex.value = 0;
  }
  return filtered[selectedIndex.value];
});

const getFullUrl = (path) => {
  if (!backendAddress) {
    const host = (typeof window !== "undefined" && window.location) ? window.location.host : "localhost:3000";
    return `http://${host}${path}`;
  }
  let host = backendAddress.trim();
  if (host.startsWith("http://")) host = host.replace("http://", "");
  if (host.startsWith("https://")) host = host.replace("https://", "");
  if (!host.includes(":")) host = `${host}:3000`;
  return `http://${host}${path}`;
};

const handleCopy = (text, id) => {
  navigator.clipboard.writeText(text);
  copiedId.value = id;
  setTimeout(() => {
    copiedId.value = null;
  }, 2000);
};

const handleSelectEndpoint = (index) => {
  selectedIndex.value = index;
};
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
    <div class="relative w-full max-w-5xl h-[85vh] bg-slate-900 border border-cyan-500/30 rounded-xl overflow-hidden flex flex-col box-glow">
      
      <!-- Modal Header -->
      <div class="flex items-center justify-between p-4 border-b border-cyan-500/20 bg-slate-950 flex-shrink-0">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-cyan-950/50 border border-cyan-400/40 rounded text-[#2ec6d6]">
            <Terminal :size="20" />
          </div>
          <div>
            <h3 class="font-display font-bold text-lg text-white">
              {{ t.title }} - {{ t.apiDoc }}
            </h3>
            <p class="text-xs text-cyan-400/70 font-mono">
              API Version: 3.0 Standardized | Host: <span class="text-amber-400 font-bold">{{ backendAddress || (typeof window !== 'undefined' && window.location ? window.location.host : 'localhost:3000') }}</span>
            </p>
          </div>
        </div>
        <button
          id="close_docs_btn"
          @click="emit('close')"
          class="p-1.5 rounded-lg border border-slate-700 hover:border-cyan-400/40 text-slate-400 hover:text-white transition-all cursor-pointer bg-transparent"
        >
          <X :size="18" />
        </button>
      </div>

      <!-- Main Layout Body (Two Columns) -->
      <div class="flex-1 min-h-0 flex flex-col md:flex-row bg-slate-900 overflow-hidden">
        
        <!-- LEFT COLUMN: API LIST WITH SEARCH -->
        <div class="w-full md:w-80 border-b md:border-b-0 md:border-r border-[#1e293b] flex flex-col flex-shrink-0 bg-slate-950/40">
          
          <!-- Search Header Block -->
          <div class="p-3.5 border-b border-[#1e293b] space-y-2">
            <div class="relative">
              <input
                id="api_search_input"
                type="text"
                v-model="searchQuery"
                :placeholder="props.language === 'zh' ? '搜索接口路径/描述...' : 'Search endpoints...'"
                class="w-full pl-8 pr-3 py-1.5 text-xs font-mono rounded-lg border border-slate-800 bg-slate-950 text-cyan-300 focus:border-[#2ec6d6] outline-none placeholder-slate-500 transition-all"
              />
              <Search :size="13" class="absolute left-2.5 top-2.5 text-slate-500" />
            </div>
            <div class="flex items-center justify-between text-[10px] text-slate-500 font-mono">
              <span>{{ filteredEndpoints.length }} ENDPOINTS</span>
              <span v-if="searchQuery" class="text-[#2ec6d6] bg-[#2ec6d6]/10 px-1.5 py-0.2 rounded font-sans scale-90">FILTERED</span>
            </div>
          </div>

          <!-- Endpoints List -->
          <div class="flex-1 overflow-y-auto p-1.5 space-y-1 select-none no-scrollbar">
            <div v-if="filteredEndpoints.length === 0" class="p-6 text-center text-xs text-slate-500 font-mono">
              No APIs found.
            </div>
            <button
              v-else
              v-for="(endpoint, idx) in filteredEndpoints"
              :id="`api_list_btn_${idx}`"
              :key="endpoint.path"
              @click="handleSelectEndpoint(idx)"
              :class="[
                'w-full p-2.5 rounded-lg border text-left font-mono transition-all flex items-start gap-2.5 outline-none cursor-pointer',
                selectedIndex === idx 
                  ? 'bg-[#2ec6d6]/10 border-[#2ec6d6]/40 text-[#2ec6d6]' 
                  : 'bg-transparent border-transparent hover:bg-slate-800/40 text-slate-300'
              ]"
            >
              <span 
                :class="[
                  'px-1.5 py-0.5 text-[9px] uppercase rounded font-black font-mono scale-90 tracking-wide mt-0.5',
                  endpoint.method === 'GET' 
                    ? 'bg-[#2ec6d6]/20 text-[#2ec6d6]' 
                    : 'bg-purple-600/20 text-purple-400'
                ]"
              >
                {{ endpoint.method }}
              </span>
              <div class="flex-1 min-w-0">
                <div class="text-xs font-bold leading-tight truncate">
                  {{ endpoint.path.split('?')[0] }}
                </div>
                <div class="text-[10px] text-slate-400 truncate mt-0.5 font-sans">
                  {{ endpoint.desc[props.language] }}
                </div>
              </div>
            </button>
          </div>
        </div>

        <!-- RIGHT COLUMN: SELECTED API DETAILS -->
        <div class="flex-1 min-w-0 flex flex-col bg-slate-900 overflow-y-auto p-5 space-y-5">
          <div v-if="!currentEndpoint" class="flex-1 flex flex-col items-center justify-center text-center text-slate-500 p-8 space-y-3">
            <Info :size="32" class="text-slate-600 animate-pulse" />
            <p class="font-mono text-xs">{{ props.language === 'zh' ? '未选中接口，请在左侧列表点击。' : 'Please select an API on the left panel.' }}</p>
          </div>

          <div v-else class="space-y-5 animate-fadeIn">
            
            <!-- Quick overview pill bar -->
            <div class="bg-slate-950 p-4 border border-slate-800 rounded-lg space-y-3">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="flex items-center gap-2.5 font-mono">
                  <span :class="['px-2 py-0.5 text-xs text-white uppercase rounded font-extrabold tracking-wider', currentEndpoint.method === 'GET' ? 'bg-[#2ec6d6] text-cyan-950' : 'bg-purple-600']">
                    {{ currentEndpoint.method }}
                  </span>
                  <span class="text-[#2ec6d6] font-bold text-sm md:text-base break-all">
                    {{ currentEndpoint.path }}
                  </span>
                </div>
                
                <button
                  @click="handleCopy(getFullUrl(currentEndpoint.path), currentEndpoint.path)"
                  class="flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-400 font-mono transition-colors bg-slate-900 border border-slate-800 px-2.5 py-1 rounded"
                >
                  <template v-if="copiedId === currentEndpoint.path">
                    <Check :size="12" class="text-emerald-400" />
                    <span class="text-emerald-400 font-medium">{{ t.copied }}</span>
                  </template>
                  <template v-else>
                    <Copy :size="12" />
                    <span>Copy URL</span>
                  </template>
                </button>
              </div>

              <div class="text-xs font-mono text-slate-400 flex items-center gap-2 select-all break-all bg-slate-900/60 p-2 rounded border border-white/5">
                <span class="text-[#2ec6d6] select-none text-[10px]">FULL URL:</span>
                <span>{{ getFullUrl(currentEndpoint.path) }}</span>
              </div>
            </div>

            <!-- Description -->
            <div class="space-y-1.5">
              <h4 class="text-xs uppercase font-extrabold text-slate-400 tracking-wider font-mono">
                {{ t.apiDesc }}
              </h4>
              <p class="text-slate-200 text-sm leading-relaxed p-3.5 rounded-lg border border-slate-800/80 bg-slate-950/40">
                {{ currentEndpoint.desc[props.language] }}
              </p>
            </div>

            <!-- Details Parameters & Payload -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              
              <!-- Parameters -->
              <div class="p-3 bg-slate-950 rounded-lg border border-slate-800 flex flex-col justify-between">
                <div>
                  <span class="text-orange-400 font-bold block mb-2 tracking-wide uppercase text-[10px]">
                    {{ t.apiParam }}:
                  </span>
                  <p class="text-slate-300 text-[11px] whitespace-pre-wrap leading-relaxed">
                    {{ currentEndpoint.params }}
                  </p>
                </div>
              </div>

              <!-- Response -->
              <div class="p-3 bg-slate-950 rounded-lg border border-slate-800 flex flex-col justify-between">
                <div>
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-emerald-400 font-bold tracking-wide uppercase text-[10px]">
                      {{ t.apiResponse }}:
                    </span>
                    <button
                      @click="handleCopy(currentEndpoint.response, currentEndpoint.path + '_resp')"
                      class="text-slate-600 hover:text-[#2ec6d6] transition-colors"
                      title="Copy response body"
                    >
                      <template v-if="copiedId === currentEndpoint.path + '_resp'">
                        <Check :size="11" class="text-emerald-400" />
                      </template>
                      <template v-else>
                        <Copy :size="11" />
                      </template>
                    </button>
                  </div>
                  <pre class="text-[#2ec6d6] text-[11px] font-mono leading-relaxed bg-slate-900/40 p-2 rounded border border-white/5 overflow-x-auto">{{ currentEndpoint.response }}</pre>
                </div>
              </div>

            </div>

            <!-- Global Envelope Standard helper -->
            <div class="p-3.5 bg-cyan-950/10 rounded-lg border border-cyan-500/10 text-[11px] font-mono text-cyan-300 flex flex-col gap-1.5 leading-relaxed">
              <span class="font-bold text-cyan-400 text-xs">💡 Base Response Envelope Pattern:</span>
              <span>{</span>
              <span class="pl-4">"success": <span class="text-amber-300">true</span>,</span>
              <span class="pl-4">"code": <span class="text-amber-300">0</span>,</span>
              <span class="pl-4">"data": { ... } <span class="text-slate-500">// {{ props.language === 'zh' ? '成功时为具体内容，失败可能为 null' : 'Data payload on success, null on error' }}</span></span>
              <span>}</span>
            </div>

          </div>
        </div>

      </div>

      <!-- Modal Footer -->
      <div class="p-4 border-t border-cyan-500/10 bg-slate-950 text-right flex-shrink-0">
        <button
          id="close_docs_footer"
          @click="emit('close')"
          class="px-5 py-2 font-display text-xs font-semibold rounded-lg bg-zinc-800 text-white hover:bg-[#2ec6d6] hover:text-cyan-950 transition-all cursor-pointer border border-transparent shadow-md"
        >
          {{ props.language === 'zh' ? '关闭文档' : 'Close References' }}
        </button>
      </div>

    </div>
  </div>
</template>

<style scoped>
.box-glow {
  box-shadow: 0 0 25px rgba(46, 198, 214, 0.15);
}
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fadeIn {
  animation: fadeIn 0.25s ease-out forwards;
}
</style>
