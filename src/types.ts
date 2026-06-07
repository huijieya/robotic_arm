export type Language = "zh" | "en" | "ja" | "ko";

export interface RobotPose {
  x: number;
  y: number;
  z: number;
  u: number;
}

export interface CalibrationData {
  status: "idle" | "running" | "completed" | "failed";
  running: boolean;
  progress: number;
  total: number;
  message: string;
  errors: number[];
  mean_error: number;
  max_error: number;
}

export interface LogFile {
  name: string;
  size: number;
  lastModifiedAt: string;
}

export interface LogList {
  ScaraControl: LogFile[];
  VisionSorter: LogFile[];
}

export interface SystemStatusData {
  robot_status: "使能" | "制动" | "错误" | "运行" | "急停" | "自动停止" | "未知";
  robot_status_code: number;
  controller_state: "允许程序操作" | "允许程序操作和jog" | "不允许程序操作和jog";
  controller_state_code: number;
  pose: RobotPose;
  speed_ratio: number;
  program_status: "运行中" | "暂停" | "错误" | "空闲";
}
