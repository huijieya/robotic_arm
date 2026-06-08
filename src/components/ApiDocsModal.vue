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
    path: "/jog_start?axis=X&dir=1",
    desc: {
      zh: "开始连续移动（SCARA 连续 Jog 接口：按住动、松手停）",
      en: "Start continuous Jog movement along target axis",
      ja: "指定軸方向へ連続ジョグ動作を起動する (長押し制御用)",
      ko: "지정 축 방향으로 연속 조그 동작 시작"
    },
    params: "axis (string): X/Y/Z/U; dir (int): 1 (正向) / -1 (负向)",
    response: `{ "success": true, "code": 0, "data": null }`
  },
  {
    method: "GET",
    path: "/jog_stop",
    desc: {
      zh: "停止连续移动",
      en: "Stop current continuous Jog movement",
      ja: "連続ジョグ動作を停止する",
      ko: "현재 연속 조그 동작 정지"
    },
    params: "None",
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
      ja: "当前的姿勢をティーチング点として保存(pick/place指定)",
      ko: "현재 로봇암 공간 물리 좌표를 지점 파라메터로 티칭"
    },
    params: 'JSON Body: { "type": "pick" } OR { "type": "place", "index": 1 }',
    response: "OK"
  },
  {
    method: "GET",
    path: "/program/run?task=1",
    desc: {
      zh: "启动指定前台程序任务",
      en: "Run designated foreground program task",
      ja: "指定された前台プログラムタスクを起動",
      ko: "지정된 전태 프로그램 태스크 기동 수행"
    },
    params: "task (int, required): 任务编号 (1, 2, 3)",
    response: `{ "success": true, "code": 0, "data": null }`
  },
  {
    method: "GET",
    path: "/program/pause?task=1",
    desc: {
      zh: "暂停正在运行的前台任务",
      en: "Pause actively running program task",
      ja: "実行中の前台タスクを一時停止",
      ko: "동작 중인 전태 프로그램 태스크 일시정지"
    },
    params: "task (int, required): 任务编号",
    response: `{ "success": true, "code": 0, "data": null }`
  },
  {
    method: "GET",
    path: "/program/resume?task=1",
    desc: {
      zh: "恢复已暂停的前台任务",
      en: "Resume previously paused program task",
      ja: "一時停止された前台タスクを再開",
      ko: "일시정지된 전태 프로그램 태스크 재개"
    },
    params: "task (int, required): 任务编号",
    response: `{ "success": true, "code": 0, "data": null }`
  },
  {
    method: "GET",
    path: "/program/stop?task=1",
    desc: {
      zh: "停止当前前台任务",
      en: "Stop actively running or paused program task",
      ja: "実行中または一時停止中の前台タスクを停止",
      ko: "실행 중 또는 일시정지된 전태 프로그램 태스크 완전 정지"
    },
    params: "task (int, required): 任务编号",
    response: `{ "success": true, "code": 0, "data": null }`
  },
  {
    method: "POST",
    path: "/log/list",
    desc: {
      zh: "根据指定的类型获取服务器日志文件列表",
      en: "Fetch list of log files matching specified types",
      ja: "指定タイプに基づいてログファイル一覧を取得",
      ko: "지정된 로그 범주에 필터링해 파일 리스트 조회"
    },
    params: 'JSON Body: { "types": ["ScaraControl", "VisionSorter"] }',
    response: `{ "success": true, "code": 0, "data": { "ScaraControl": [...], "VisionSorter": [...] } }`
  },
  {
    method: "POST",
    path: "/log/download",
    desc: {
      zh: "打包下载选定的日志文件，返回 .tar 二进制归档",
      en: "Archive selected log files into a download-ready .tar tarball",
      ja: "選択したログを .tar ファイルとしてダウンロード",
      ko: "선택된 파일들을 일괄 압축 적용하여 .tar 다운로드 수행"
    },
    params: 'JSON Body: { "ScaraControl": ["robot_web.log"], "VisionSorter": ["vision.log"] }',
    response: "Binary Stream (application/x-tar)"
  },
  {
    method: "GET",
    path: "/vision/status",
    desc: {
      zh: "获取视觉检测与分拣模块当前是否在运行",
      en: "Check if the optical inspection & sorting module is currently active",
      ja: "ビジョン自動選別モジュールが稼働中か確認",
      ko: "비전 분류 모듈 동작 수행 중 인지 여부 조회"
    },
    params: "None",
    response: `{ "success": true, "code": 0, "data": { "running": 1 } }`
  },
  {
    method: "POST",
    path: "/vision/start",
    desc: {
      zh: "启动视觉检测分拣循环",
      en: "Initiate optical inspection & sorting cycle",
      ja: "ビジョン自動選択選別の巡回動作を開始",
      ko: "비전 자동 분류 피킹 플레이스 사이클 시동"
    },
    params: "None",
    response: `{ "success": true, "code": 0, "data": null }`
  },
  {
    method: "POST",
    path: "/vision/stop",
    desc: {
      zh: "关闭并停止视觉分拣循环",
      en: "Deactivate optical inspection & sorting cycle",
      ja: "ビジョン自動選択選別動作を無効化停止",
      ko: "비전 자동 분류 피킹 플레이스 사이클 일시 정제"
    },
    params: "None",
    response: `{ "success": true, "code": 0, "data": null }`
  },
  {
    method: "POST",
    path: "/teach_roi/start",
    desc: {
      zh: "进入 ROI 检测区域示教模式，锁定相机捕获",
      en: "Enter ROI camera teach mode with lock",
      ja: "ROI ティーチモードをロック開始",
      ko: "ROI 검출 영역 교시 모드 활성화 진입"
    },
    params: "None",
    response: '"ROI TEACH MODE ON"'
  },
  {
    method: "GET",
    path: "/get_roi",
    desc: {
      zh: "获取当前相机像素区域关注参数",
      en: "Fetch active camera sub-region parameters",
      ja: "現在のアクティブなROI関心座标情報を取得",
      ko: "현재 정의된 관심 ROI 데이터 조회"
    },
    params: "None",
    response: `{ "valid": true, "x": 100, "y": 120, "w": 300, "h": 240 }`
  },
  {
    method: "GET",
    path: "/get_points",
    desc: {
      zh: "检索抓取和放置示教点位设置状态",
      en: "Retrieve teaching coverage map for pick and place positions",
      ja: "ピッキング点とプレーシング点の設定状態をクエリ",
      ko: "현재 포인트 교시 완료 유무 맵 조회"
    },
    params: "None",
    response: `{ "pick": true, "place": [true, false, true] }`
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
