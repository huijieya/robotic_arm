import Axios from "axios";

const getBaseUrl = (backendAddr) => {
  if (!backendAddr) return "";
  let host = backendAddr.trim();
  if (host.startsWith("http://")) host = host.replace("http://", "");
  if (host.startsWith("https://")) host = host.replace("https://", "");
  if (!host.includes(":")) host = `${host}:3000`;
  const protocol = (typeof window !== "undefined" && window.location) ? window.location.protocol : "http:";
  return `${protocol}//${host}`;
};

const initialHost = (typeof window !== "undefined" && typeof localStorage !== "undefined")
  ? localStorage.getItem("NEXUS_BACKEND_ADDRESS") || ""
  : "";

export const Request = Axios.create({
  baseURL: getBaseUrl(initialHost),
  timeout: 30000,
  headers: {
    "Content-Type": "application/json;charset=UTF-8"
  }
});

/**
 * Dynamic configuration updater for backend network IP changes
 */
export const updateApiBaseUrl = (backendAddr) => {
  Request.defaults.baseURL = getBaseUrl(backendAddr);
};

/**
 * 机械臂控制与状态接口 (Industrial Arm Kinematics & Servo Controls)
 */
export const Controller = {
  connect(ip) {
    return Request.get(`/connect?ip=${encodeURIComponent(ip)}`);
  },
  init() {
    return Request.get("/init");
  },
  start() {
    return Request.get("/start");
  },
  stop() {
    return Request.get("/stop");
  },
  clearError() {
    return Request.get("/clear_error");
  },
  simTriggerError() {
    return Request.get("/sim_trigger_error");
  },
  getRealtimePose() {
    return Request.get("/pose_realtime");
  },
  setSpeedRatio(value) {
    return Request.get(`/speedratio?value=${value}`);
  },
  jogStep(axis, dir, dist) {
    return Request.get(`/jog_step?axis=${axis}&dir=${dir}&dist=${dist}`);
  },
  triggerAutoCalib() {
    return Request.get("/autocalib");
  }
};

/**
 * 视觉检测与 ROI 关注区域配置 (Industrial Vision Analysis & ROI Teaching)
 */
export const Vision = {
  getStatus() {
    return Request.get("/vision/status");
  },
  start() {
    return Request.post("/vision/start");
  },
  stop() {
    return Request.post("/vision/stop");
  },
  startRoiTeach() {
    return Request.post("/teach_roi/start");
  },
  getRoi() {
    return Request.get("/get_roi");
  },
  setRoi(dimensions) {
    return Request.post("/set_roi", dimensions);
  }
};

/**
 * 工件示教点位置管理器 (Workspace Hand-Eye Sorting Points Teaching)
 */
export const Teach = {
  getPoints() {
    return Request.get("/get_points");
  },
  teachPoint(type, index) {
    const payload = { type };
    if (index !== undefined) {
      payload.index = index;
    }
    return Request.post("/teach_point", payload);
  }
};

/**
 * 系统工业运行日志管理 (Factory Audit Trail & Diagnostic Logs)
 */
export const Logs = {
  list(types) {
    return Request.post("/log/list", { types });
  },
  download(scaraControlFiles, visionSorterFiles) {
    return Request.post(
      "/log/download",
      {
        ScaraControl: scaraControlFiles,
        VisionSorter: visionSorterFiles
      },
      { responseType: "blob" }
    );
  }
};
