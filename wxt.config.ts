import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Workana Job Monitor',
    description: 'Monitor Workana job listings and get Discord notifications for new jobs',
    permissions: [
      'storage',
      'alarms',
      'cookies',
    ],
    host_permissions: [
      'https://www.workana.com/*',
      'https://discord.com/*',
    ],
  },
});
