import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [vue(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      
      // 【重要】配置代理
      proxy: {
        // 策略：将所有非静态资源、非 html 的请求，且符合后端接口特征的，转发到后端
        // 这里列出所有已知的后端接口前缀
        '/connect': {
          target: 'http://192.168.131.154:8080',
          changeOrigin: true,
        },
        '/init': {
          target: 'http://192.168.131.154:8080',
          changeOrigin: true,
        },
        '/start': {
          target: 'http://192.168.131.154:8080',
          changeOrigin: true,
        },
        '/stop': {
          target: 'http://192.168.131.154:8080',
          changeOrigin: true,
        },
        '/clear_error': {
          target: 'http://192.168.131.154:8080',
          changeOrigin: true,
        },
        '/sim_trigger_error': {
          target: 'http://192.168.131.154:8080',
          changeOrigin: true,
        },
        '/pose_realtime': {
          target: 'http://192.168.131.154:8080',
          changeOrigin: true,
        },
        '/speedratio': {
          target: 'http://192.168.131.154:8080',
          changeOrigin: true,
        },
        '/jog_step': {
          target: 'http://192.168.131.154:8080',
          changeOrigin: true,
        },
        '/autocalib': {
          target: 'http://192.168.131.154:8080',
          changeOrigin: true,
        },
        '/vision': {
          target: 'http://192.168.131.154:8080',
          changeOrigin: true,
        },
        '/teach_roi': {
          target: 'http://192.168.131.154:8080',
          changeOrigin: true,
        },
        '/get_roi': {
          target: 'http://192.168.131.154:8080',
          changeOrigin: true,
        },
        '/set_roi': {
          target: 'http://192.168.131.154:8080',
          changeOrigin: true,
        },
        '/get_points': {
          target: 'http://192.168.131.154:8080',
          changeOrigin: true,
        },
        '/teach_point': {
          target: 'http://192.168.131.154:8080',
          changeOrigin: true,
        },
        '/log': {
          target: 'http://192.168.131.154:8080',
          changeOrigin: true,
        },
        '/program': {
          target: 'http://192.168.131.154:8080',
          changeOrigin: true,
        },
        '/jog_start': {
          target: 'http://192.168.131.154:8080',
          changeOrigin: true,
        },
        '/jog_stop': {
          target: 'http://192.168.131.154:8080',
          changeOrigin: true,
        },
      }
    },
  };
});