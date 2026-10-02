import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir:'./e2e', testMatch:'*.pw.ts', timeout:60000, workers:1,
 reporter:[['list']],
 use:{baseURL:'http://127.0.0.1:4173/nostr-torrent/', headless:true, trace:'retain-on-failure', launchOptions:process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}},
 projects:[{name:'desktop',use:{viewport:{width:1440,height:1000}}},{name:'narrow',use:{viewport:{width:390,height:844}}}],
 webServer:{command:'npm run build -- --base=/nostr-torrent/ && npm exec vite -- preview --host 127.0.0.1 --port 4173 --strictPort --base=/nostr-torrent/',url:'http://127.0.0.1:4173/nostr-torrent/',reuseExistingServer:false,timeout:60000}
});
