// 각 화면을 PNG 스크린샷으로 캡처하는 스크립트
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const outDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

const pages = [
  { name: 'widget',     file: 'renderer/widget.html',     width: 900,  height: 200 },
  { name: 'dashboard',  file: 'renderer/dashboard.html',  width: 480,  height: 700 },
  { name: 'meeting',    file: 'renderer/meeting.html',    width: 900,  height: 650 },
  { name: 'settings',   file: 'renderer/settings.html',   width: 460,  height: 520 },
  { name: 'add-agent',  file: 'renderer/add-agent.html',  width: 400,  height: 500 },
];

async function captureAll() {
  for (const page of pages) {
    const win = new BrowserWindow({
      width: page.width,
      height: page.height,
      show: false,
      webPreferences: { offscreen: true },
    });

    await win.loadFile(path.join(__dirname, page.file));
    // 렌더링 대기
    await new Promise(r => setTimeout(r, 1500));

    const image = await win.webContents.capturePage();
    const pngPath = path.join(outDir, `${page.name}.png`);
    fs.writeFileSync(pngPath, image.toPNG());
    console.log(`Captured: ${pngPath}`);
    win.close();
  }

  console.log('\nAll screenshots saved to ./screenshots/');
  app.quit();
}

app.whenReady().then(captureAll).catch(err => {
  console.error(err);
  app.quit();
});
