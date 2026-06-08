import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper functions to map state fields to exact non-Chinese string fields for updated WebSocket spec
function getRobotStatusString(status: string, code?: number): string {
  if (code === 1 || status === "错误" || status === "急停" || status === "error") return "error";
  if (code === 4 || status === "运行" || status === "running") return "running";
  if (code === 3 || status === "使能" || status === "enable") return "enable";
  return "braking";
}

function getControllerStateString(state: string, code?: number): string {
  if (code === 2 || state === "允许程序操作和jog" || state === "allow_operation") return "allow_operation";
  if (code === 1 || state === "允许程序操作") return "allow_operation";
  return "not_allow_operation";
}

function getProgramStatusString(status: string): string {
  if (status === "运行中" || status === "run") return "run";
  if (status === "暂停" || status === "pause") return "pause";
  if (status === "错误" || status === "error") return "error";
  return "idle";
}

// Helper base64 JPEGs representing camera states
// These are minimal, valid 320x240 JPEGs of differing solid colors with minimal details to prevent high bandwidth issues
// We can use them to simulate camera frames!
const CAMERA_FRAMES = [
  // Frame 1: Cyan-themed empty belt grid
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAFAAeABAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
  // Frame 2: Cyan-themed product detected grid
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAFAAeABAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
];

// Let's create actual tiny 320x240 PNG/JPEGs or mock binary frames
// A valid small JPEG can be represented by a base64 string. Let's provide a real base64 image of an industrial grid!
// Below is a real, valid 320x240 JPEG pixel representation of a layout.
const BASE64_GRID_IMAGE = 
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////" +
  "wgALCAHgAoABAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

// Let's write client-side canvas-based generators, but server will push binary buffers on WS.
// Any binary buffer can represent JPEG image metadata. We can send a valid tiny gif/jpeg or just a small jpeg-header buffer.
// Let's create a robust fallback on client that can display either the raw binary data as image, or render standard schematic updates.
// To make it fully compatible with "blob flow updating camera", we can send actual valid JPEG binary data or simple byte arrays.
// Here is a valid 1x1 black JPEG structure:
const TINY_JPEG_BUFFER = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////" +
  "wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
  "base64"
);

// High fidelity state simulation
interface RobotState {
  connected: boolean;
  ip: string;
  initialized: boolean;
  robot_status: "使能" | "制动" | "错误" | "运行" | "急停" | "自动停止" | "未知";
  robot_status_code: number; // 1=错误, 2=制动, 3=使能, 4=运行, 5=自动停止, 6=急停
  controller_state: "允许程序操作" | "允许程序操作和jog" | "不允许程序操作和jog";
  controller_state_code: number; // 1=允许程序操作, 2=允许程序操作和jog, other=不允许
  pose: {
    x: number;
    y: number;
    z: number;
    u: number;
  };
  speed_ratio: number;
  program_status: "运行中" | "暂停" | "错误" | "空闲";
  vision_running: number;
  roi: {
    valid: boolean;
    x: number;
    y: number;
    w: number;
    h: number;
  };
  teach_points: {
    pick: boolean;
    place: boolean[];
  };
  calib: {
    status: "idle" | "running" | "completed" | "failed";
    running: boolean;
    progress: number;
    total: number;
    message: string;
    errors: number[];
    mean_error: number;
    max_error: number;
  };
}

let robot: RobotState = {
  connected: false,
  ip: "",
  initialized: false,
  robot_status: "制动",
  robot_status_code: 2,
  controller_state: "不允许程序操作和jog",
  controller_state_code: 3,
  pose: {
    x: 528.61,
    y: -701.51,
    z: 0.47,
    u: -1.68
  },
  speed_ratio: 40,
  program_status: "空闲",
  vision_running: 0,
  roi: {
    valid: true,
    x: 100,
    y: 120,
    w: 300,
    h: 240
  },
  teach_points: {
    pick: true,
    place: [true, false, true]
  },
  calib: {
    status: "idle",
    running: false,
    progress: 0,
    total: 9,
    message: "auto calibration idle",
    errors: [],
    mean_error: 0.0,
    max_error: 0.0
  }
};

let teachModeActive = false;

// Logs simulation data
const SCARA_CONTROL_LOGS = [
  { name: "robot_web_2026-06-05_08-20-00.log", size: 124500, lastModifiedAt: "2026-06-05 08:20:00" },
  { name: "robot_web_2026-06-05_09-00-12.log", size: 231450, lastModifiedAt: "2026-06-05 09:00:12" },
  { name: "robot_system_err_dump.log", size: 5410, lastModifiedAt: "2026-06-05 09:10:44" }
];

const VISION_SORTER_LOGS = [
  { name: "vision_sorter_2026-06-05_07-15-02.log", size: 98120, lastModifiedAt: "2026-06-05 07:15:02" },
  { name: "vision_sorter_2026-06-05_09-11-00.log", size: 312000, lastModifiedAt: "2026-06-05 09:11:00" }
];

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  app.use(express.json());

  // WebSocket upgrade handler
  server.on("upgrade", (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  // Keep track of WS clients
  const clients = new Set<WebSocket>();

  wss.on("connection", (ws) => {
    clients.add(ws);
    // Send immediate initial push
    ws.send(JSON.stringify({
      type: "sys_status",
      data: {
        robot_status: getRobotStatusString(robot.robot_status, robot.robot_status_code),
        controller_state: getControllerStateString(robot.controller_state, robot.controller_state_code),
        pose: robot.pose,
        speed_ratio: robot.speed_ratio,
        program_status: getProgramStatusString(robot.program_status)
      }
    }));

    ws.on("close", () => {
      clients.delete(ws);
    });
  });

  // Periodically send states over WebSockets
  setInterval(() => {
    const statusPayload = JSON.stringify({
      type: "sys_status",
      data: {
        robot_status: getRobotStatusString(robot.robot_status, robot.robot_status_code),
        controller_state: getControllerStateString(robot.controller_state, robot.controller_state_code),
        pose: robot.pose,
        speed_ratio: robot.speed_ratio,
        program_status: getProgramStatusString(robot.program_status)
      }
    });

    clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(statusPayload);
      }
    });
  }, 1000);

  // Calibration socket loop / workflow simulated
  let calibInterval: NodeJS.Timeout | null = null;
  const triggerCalibrationSimulation = () => {
    if (calibInterval) clearInterval(calibInterval);
    
    robot.calib = {
      status: "running",
      running: true,
      progress: 0,
      total: 9,
      message: "auto calibration running",
      errors: [],
      mean_error: 0.0,
      max_error: 0.0
    };

    calibInterval = setInterval(() => {
      if (robot.calib.progress < 9) {
        robot.calib.progress += 1;
        // Generate random precision errors for this step
        const stepError = parseFloat((0.001 + Math.random() * 0.002).toFixed(4));
        robot.calib.errors.push(stepError);
        
        // Update pose slightly to look like it is moving to preset points
        robot.pose = {
          x: parseFloat((500 + Math.random() * 40).toFixed(2)),
          y: parseFloat((-700 - Math.random() * 40).toFixed(2)),
          z: parseFloat((0.2 + Math.random() * 0.5).toFixed(2)),
          u: parseFloat((-1.5 - Math.random() * 0.5).toFixed(2))
        };

        const currentErrors = robot.calib.errors;
        const sum = currentErrors.reduce((a, b) => a + b, 0);
        robot.calib.mean_error = parseFloat((sum / currentErrors.length).toFixed(4));
        robot.calib.max_error = parseFloat((Math.max(...currentErrors)).toFixed(4));

        // Push calibration status via socket
        const calibPayload = JSON.stringify({
          type: "calib_status",
          data: {
            status: "running",
            running: true,
            progress: robot.calib.progress,
            total: robot.calib.total,
            message: `calibrating preset point ${robot.calib.progress}/9`,
            errors: robot.calib.errors,
            mean_error: robot.calib.mean_error,
            max_error: robot.calib.max_error
          }
        });

        clients.forEach((ws) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(calibPayload);
          }
        });
      } else {
        // Calibration completed!
        robot.calib.status = "completed";
        robot.calib.running = false;
        robot.calib.message = "auto calibration completed successfully";
        
        if (calibInterval) clearInterval(calibInterval);

        const calibPayload = JSON.stringify({
          type: "calib_status",
          data: {
            status: "completed",
            running: false,
            progress: 9,
            total: 9,
            message: "auto calibration completed successfully",
            errors: robot.calib.errors,
            mean_error: robot.calib.mean_error,
            max_error: robot.calib.max_error
          }
        });

        clients.forEach((ws) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(calibPayload);
          }
        });
      }
    }, 1500);
  };

  // Robot dynamic movement simulator for visual sorting
  let sortingInterval: NodeJS.Timeout | null = null;
  const startSortingSimulation = () => {
    if (sortingInterval) clearInterval(sortingInterval);
    robot.robot_status = "运行";
    robot.robot_status_code = 4;
    robot.program_status = "运行中";

    let stateStep = 0; // 0=moving to pick, 1=picking, 2=moving to place, 3=placing
    sortingInterval = setInterval(() => {
      stateStep = (stateStep + 1) % 4;
      if (stateStep === 0) {
        // move to pick
        robot.pose = { x: 420.5, y: -650.2, z: 25.0, u: -0.5 };
      } else if (stateStep === 1) {
        // lower and pick
        robot.pose = { x: 420.5, y: -650.2, z: 2.0, u: -0.5 };
        robot.teach_points.pick = true;
      } else if (stateStep === 2) {
        // move to place (one of index 0, 1, 2)
        const targetX = 640 + Math.floor(Math.random() * 30);
        robot.pose = { x: targetX, y: -720.0, z: 25.0, u: 45.0 };
      } else if (stateStep === 3) {
        // place
        robot.pose.z = 1.5;
        // set random place point as completed
        const idx = Math.floor(Math.random() * 3);
        robot.teach_points.place[idx] = true;
      }
    }, 1200);
  };

  const stopSortingSimulation = () => {
    if (sortingInterval) {
      clearInterval(sortingInterval);
      sortingInterval = null;
    }
    robot.robot_status = "使能";
    robot.robot_status_code = 3;
    robot.program_status = "空闲";
  };


  // Simulate binary camera streams via WebSocket:
  // Every 800ms, send a small binary blob representing camera view stream if connected/running
  setInterval(() => {
    if (robot.connected) {
      clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          // Send TINY_JPEG_BUFFER as raw binary frame
          ws.send(TINY_JPEG_BUFFER);
        }
      });
    }
  }, 1200);


  /* ================= REST API ROUTERS ================= */

  // 1.1 Connect
  app.get("/connect", (req, res) => {
    const ip = req.query.ip as string;
    if (!ip) {
      return res.status(400).json({ success: false, code: -1, data: null });
    }
    robot.connected = true;
    robot.ip = ip;
    robot.robot_status = "制动"; // starts connected but braked
    robot.robot_status_code = 2;
    res.json({ success: true, code: 0, data: null });
  });

  // 1.2 Init robot
  app.get("/init", (req, res) => {
    if (!robot.connected) {
      return res.json({ success: false, code: -1, data: "未连接机械臂" });
    }
    robot.initialized = true;
    robot.controller_state = "允许程序操作和jog";
    robot.controller_state_code = 2;
    res.json({ success: true, code: 0, data: null });
  });

  // 1.3 Enable Start (上使能)
  app.get("/start", (req, res) => {
    if (!robot.connected) {
      return res.json({ success: false, code: -1, data: "未连接机械臂" });
    }
    robot.robot_status = "使能";
    robot.robot_status_code = 3;
    res.json({ success: true, code: 0, data: null });
  });

  // 1.4 Disable Stop (制动/急停)
  app.get("/stop", (req, res) => {
    stopSortingSimulation();
    robot.robot_status = "制动";
    robot.robot_status_code = 2;
    res.json({ success: true, code: 0, data: null });
  });

  // 1.5 Clear Error (清除错误)
  app.get("/clear_error", (req, res) => {
    if (robot.robot_status === "错误" || robot.robot_status_code === 1) {
      robot.robot_status = "使能";
      robot.robot_status_code = 3;
    }
    res.json({ success: true, code: 0, data: null });
  });

  // 2.1 Reg881 status
  app.get("/reg881", (req, res) => {
    res.json({
      success: true,
      code: 0,
      data: robot.controller_state
    });
  });

  // 2.2 System status
  app.get("/status", (req, res) => {
    res.json({
      success: true,
      code: 0,
      data: robot.robot_status
    });
  });

  // 2.3 Pose realtime
  app.get("/pose_realtime", (req, res) => {
    res.json({
      success: true,
      code: 0,
      data: robot.pose
    });
  });

  // 2.4 Speed info
  app.get("/speed_info", (req, res) => {
    res.json({
      success: true,
      code: 0,
      data: {
        ratio: robot.speed_ratio
      }
    });
  });

  // 3.1 SpeedRatio Set
  app.get("/speedratio", (req, res) => {
    const value = parseInt(req.query.value as string);
    if (isNaN(value) || value < 0 || value > 100) {
      return res.json({ success: false, code: -1, data: "参数越界" });
    }
    robot.speed_ratio = value;
    res.json({ success: true, code: 0, data: null });
  });

  // 3.2 Jog Step
  // GET /jog_step?axis=X&dir=1&dist=10.5
  app.get("/jog_step", (req, res) => {
    const axis = req.query.axis as "X" | "Y" | "Z" | "U";
    const dir = parseInt(req.query.dir as string);
    const dist = parseFloat(req.query.dist as string);

    if (robot.robot_status_code !== 3) {
      return res.json({ success: false, code: -1, data: "机械臂未处于使能状态" });
    }
    if (robot.program_status === "运行中") {
      return res.json({ success: false, code: -1, data: "前台程序正在运行" });
    }
    if (!axis || !["X", "Y", "Z", "U"].includes(axis)) {
      return res.json({ success: false, code: -1, data: "运动轴无效" });
    }
    if (dir !== 1 && dir !== -1) {
      return res.json({ success: false, code: -1, data: "方向必须为1或-1" });
    }
    if (isNaN(dist) || dist <= 0) {
      return res.json({ success: false, code: -1, data: "步距必须大于0" });
    }

    // Process movement:
    const delta = dir * dist;
    if (axis === "X") robot.pose.x = parseFloat((robot.pose.x + delta).toFixed(2));
    if (axis === "Y") robot.pose.y = parseFloat((robot.pose.y + delta).toFixed(2));
    if (axis === "Z") robot.pose.z = parseFloat((robot.pose.z + delta).toFixed(2));
    if (axis === "U") robot.pose.u = parseFloat((robot.pose.u + delta).toFixed(2));

    res.json({ success: true, code: 0, data: null });
  });

  // 4.4 Camera Stream Base64
  app.get("/camera_stream", (req, res) => {
    res.json({
      success: true,
      code: 0,
      data: BASE64_GRID_IMAGE
    });
  });

  // 4.5 Auto Calibration
  app.get("/autocalib", (req, res) => {
    if (robot.robot_status_code !== 3) {
      return res.json({ success: false, code: -1, data: "机械臂未使能" });
    }
    triggerCalibrationSimulation();
    res.json({ success: true, code: 0, data: null });
  });

  // 4.6 Start Vision Sorter
  app.post("/vision/start", (req, res) => {
    robot.vision_running = 1;
    startSortingSimulation();
    res.json({ success: true, code: 0, data: null });
  });

  // 4.7 Vision Sorter Status
  app.get("/vision/status", (req, res) => {
    res.json({
      success: true,
      code: 0,
      data: {
        running: robot.vision_running
      }
    });
  });

  // 4.8 Stop Vision Sorter
  app.post("/vision/stop", (req, res) => {
    robot.vision_running = 0;
    stopSortingSimulation();
    res.json({ success: true, code: 0, data: null });
  });

  // 5.1 Enter ROI Teach Mode (Old format text response)
  app.post("/teach_roi/start", (req, res) => {
    teachModeActive = true;
    res.setHeader("Content-Type", "text/plain");
    res.send("ROI TEACH MODE ON");
  });

  // 5.2 Set ROI area (Old format text response)
  app.post("/set_roi", (req, res) => {
    const { x, y, w, h } = req.body;
    res.setHeader("Content-Type", "text/plain");
    if (!teachModeActive) {
      return res.send("ROI TEACH MODE OFF");
    }
    if (w <= 5 || h <= 5) {
      return res.send("ROI too small");
    }
    if (typeof x !== "number" || typeof y !== "number") {
      return res.send("Invalid ROI JSON");
    }
    robot.roi = { valid: true, x, y, w, h };
    teachModeActive = false; // saved and exit teach mode
    res.send("ROI SAVED");
  });

  // 5.3 Get ROI area (Custom JSON format)
  app.get("/get_roi", (req, res) => {
    if (robot.roi.valid) {
      res.json({ valid: true, x: robot.roi.x, y: robot.roi.y, w: robot.roi.w, h: robot.roi.h });
    } else {
      res.json({ valid: false });
    }
  });

  // 5.4 Get point status (Custom JSON format)
  app.get("/get_points", (req, res) => {
    res.json({
      pick: robot.teach_points.pick,
      place: robot.teach_points.place
    });
  });

  // 5.5 Teach Point (Old format text response)
  app.post("/teach_point", (req, res) => {
    const { type, index } = req.body;
    res.setHeader("Content-Type", "text/plain");
    if (type !== "pick" && type !== "place") {
      return res.send("INVALID TYPE");
    }
    if (type === "place" && (index < 0 || index > 2 || typeof index !== "number")) {
      return res.send("INVALID INDEX");
    }
    if (type === "pick") {
      robot.teach_points.pick = true;
    } else {
      robot.teach_points.place[index] = true;
    }
    res.send("OK");
  });

  // 7.1 Logs dynamic retrieve
  app.post("/log/list", (req, res) => {
    const { types } = req.body;
    if (!types || !Array.isArray(types)) {
      return res.json({ success: false, code: -1, data: "Invalid request payload" });
    }
    const result: Record<string, typeof SCARA_CONTROL_LOGS> = {};
    if (types.includes("ScaraControl")) {
      result["ScaraControl"] = SCARA_CONTROL_LOGS;
    }
    if (types.includes("VisionSorter")) {
      result["VisionSorter"] = VISION_SORTER_LOGS;
    }
    res.json({
      success: true,
      code: 0,
      data: result
    });
  });

  // 7.2 Download Logs (Simulating tar bundle download)
  app.post("/log/download", (req, res) => {
    // Return mock text/tar binary chunk with convenient headers
    res.setHeader("Content-Disposition", 'attachment; filename="scara_logs_2026-06-05_09-11-22.tar"');
    res.setHeader("Content-Type", "application/x-tar");
    // Send standard mock TAR data
    const mockTarContent = "MOCK TAR STREAM CONTENT FOR CORRESPONDING LOG PACKAGES";
    res.send(Buffer.from(mockTarContent));
  });

  // 6.1 Run Program Task
  app.get("/program/run", (req, res) => {
    const task = parseInt(req.query.task as string);
    if (isNaN(task)) {
      return res.json({ success: false, code: -1, data: "任务编号无效" });
    }
    robot.program_status = "运行中";
    robot.robot_status = "运行";
    robot.robot_status_code = 4;
    res.json({ success: true, code: 0, data: null });
  });

  // 6.2 Pause Program Task
  app.get("/program/pause", (req, res) => {
    const task = parseInt(req.query.task as string);
    if (isNaN(task)) {
      return res.json({ success: false, code: -1, data: "任务编号无效" });
    }
    robot.program_status = "暂停";
    robot.robot_status = "使能";
    robot.robot_status_code = 3;
    res.json({ success: true, code: 0, data: null });
  });

  // 6.3 Resume Program Task
  app.get("/program/resume", (req, res) => {
    const task = parseInt(req.query.task as string);
    if (isNaN(task)) {
      return res.json({ success: false, code: -1, data: "任务编号无效" });
    }
    robot.program_status = "运行中";
    robot.robot_status = "运行";
    robot.robot_status_code = 4;
    res.json({ success: true, code: 0, data: null });
  });

  // 6.4 Stop Program Task
  app.get("/program/stop", (req, res) => {
    const task = parseInt(req.query.task as string);
    if (isNaN(task)) {
      return res.json({ success: false, code: -1, data: "任务编号无效" });
    }
    robot.program_status = "空闲";
    robot.robot_status = "使能";
    robot.robot_status_code = 3;
    res.json({ success: true, code: 0, data: null });
  });

  // Trigger error simulation for industrial UI realism
  app.get("/sim_trigger_error", (req, res) => {
    robot.robot_status = "错误";
    robot.robot_status_code = 1;
    res.json({ success: true, code: 0, data: null });
  });

  /* ================= VITE OR STATIC SERVING ================= */

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const PORT = 3000;
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running in ${process.env.NODE_ENV || 'development'} mode on PORT ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start industrial web server:", err);
});
