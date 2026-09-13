import { chromium } from "playwright";
import { writeFileSync, readFileSync } from "node:fs";

const CREST = readFileSync("/workspace/.grok/crest.png").toString("base64");
const RUSSO = readFileSync("/workspace/.grok/fonts/russo.ttf").toString("base64");
const ORBITRON = readFileSync("/workspace/.grok/fonts/orbitron.ttf").toString("base64");

const fonts = `
@font-face {
  font-family: "Russo One";
  src: url("data:font/ttf;base64,${RUSSO}") format("truetype");
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: "Orbitron";
  src: url("data:font/ttf;base64,${ORBITRON}") format("truetype");
  font-weight: 400 900;
  font-style: normal;
}
`;

const blast = (x, y, scale, color, rotate = 0) => `
  <g transform="translate(${x} ${y}) rotate(${rotate}) scale(${scale})">
    <rect x="-10" y="-54" width="20" height="108" rx="8" fill="${color}"/>
    <rect x="-54" y="-10" width="108" height="20" rx="8" fill="${color}"/>
    <rect x="-7" y="-36" width="14" height="72" rx="6" fill="#F4F0E8" opacity="0.35"/>
    <rect x="-36" y="-7" width="72" height="14" rx="6" fill="#F4F0E8" opacity="0.35"/>
  </g>
`;

const bomb = (x, y, scale) => `
  <g transform="translate(${x} ${y}) scale(${scale})">
    <circle cx="0" cy="6" r="22" fill="#1A1A2E" stroke="#00CCFF" stroke-width="3"/>
    <circle cx="-6" cy="0" r="6" fill="#F4F0E8" opacity="0.18"/>
    <path d="M10 -12 Q18 -28 28 -22" fill="none" stroke="#FFD700" stroke-width="3" stroke-linecap="round"/>
    <circle cx="30" cy="-24" r="5" fill="#FF7A00"/>
    <circle cx="30" cy="-24" r="2.5" fill="#FFD700"/>
  </g>
`;

const ogHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
${fonts}
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body {
  width: 2400px;
  height: 1260px;
  overflow: hidden;
  background: #07070C;
}
.stage {
  width: 2400px;
  height: 1260px;
  position: relative;
  background:
    radial-gradient(ellipse 70% 55% at 50% 42%, #1A1A2E 0%, #07070C 68%);
  overflow: hidden;
}
.floor {
  position: absolute;
  left: -25%;
  width: 150%;
  bottom: -18%;
  height: 62%;
  background-image:
    linear-gradient(rgba(0,204,255,0.16) 2px, transparent 2px),
    linear-gradient(90deg, rgba(0,204,255,0.16) 2px, transparent 2px);
  background-size: 90px 90px;
  transform: perspective(720px) rotateX(64deg);
  transform-origin: center top;
  -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,0.85), transparent 78%);
  mask-image: linear-gradient(to bottom, rgba(0,0,0,0.85), transparent 78%);
}
.orb-l, .orb-r {
  position: absolute;
  width: 820px;
  height: 820px;
  pointer-events: none;
}
.orb-l {
  left: -220px;
  top: 120px;
  background: radial-gradient(circle, rgba(255,122,0,0.34) 0%, transparent 62%);
}
.orb-r {
  right: -220px;
  top: 120px;
  background: radial-gradient(circle, rgba(0,204,255,0.34) 0%, transparent 62%);
}
.vignette {
  position: absolute;
  inset: 0;
  box-shadow: inset 0 0 180px 40px #07070C;
  pointer-events: none;
}
.scan {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    to bottom,
    rgba(244,240,232,0.025) 0 1px,
    transparent 1px 4px
  );
  pointer-events: none;
}
.fx { position: absolute; inset: 0; pointer-events: none; }
.lockup {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 70px 240px 90px;
}
.crest-wrap {
  position: relative;
  width: 430px;
  height: 430px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
}
.crest-glow {
  position: absolute;
  inset: -50px;
  background: radial-gradient(circle, rgba(255,215,0,0.32) 0%, rgba(255,122,0,0.16) 38%, transparent 70%);
}
.crest {
  width: 400px;
  height: 400px;
  object-fit: contain;
  position: relative;
  filter: drop-shadow(0 18px 28px rgba(0,0,0,0.55));
}
.word {
  font-family: "Russo One", "Liberation Sans", sans-serif;
  font-weight: 400;
  text-align: center;
  text-transform: uppercase;
  line-height: 0.92;
  paint-order: stroke fill;
  -webkit-text-stroke: 6px #07070C;
}
.fenix {
  font-size: 180px;
  letter-spacing: 0.14em;
  color: #FFD700;
  text-shadow:
    0 0 22px rgba(255,215,0,0.55),
    0 0 48px rgba(255,122,0,0.45),
    0 8px 0 #07070C;
  padding-left: 0.14em;
}
.blast {
  font-size: 128px;
  letter-spacing: 0.36em;
  color: #00CCFF;
  text-shadow:
    0 0 22px rgba(0,204,255,0.7),
    0 0 48px rgba(0,204,255,0.35),
    0 8px 0 #07070C;
  padding-left: 0.36em;
}
.rule {
  width: 520px;
  height: 3px;
  margin: 10px 0 4px;
  background: linear-gradient(90deg, transparent, #FFD700 18%, #00CCFF 82%, transparent);
  box-shadow: 0 0 12px rgba(0,204,255,0.5);
}
.tag {
  font-family: "Orbitron", "Liberation Sans", sans-serif;
  font-weight: 700;
  font-size: 28px;
  letter-spacing: 0.62em;
  color: #F4F0E8;
  text-transform: uppercase;
  padding-left: 0.62em;
  opacity: 0.92;
  text-shadow: 0 0 16px rgba(0,204,255,0.45);
}
</style>
</head>
<body>
<div class="stage">
  <div class="floor"></div>
  <div class="orb-l"></div>
  <div class="orb-r"></div>
  <svg class="fx" viewBox="0 0 2400 1260" xmlns="http://www.w3.org/2000/svg">
    ${blast(210, 980, 1.35, "#FF7A00", -8)}
    ${blast(2180, 940, 1.2, "#00CCFF", 12)}
    ${blast(430, 1080, 0.7, "#FF7A00", 18)}
    ${blast(1960, 1100, 0.62, "#FFD700", -14)}
    ${bomb(280, 860, 1.15)}
    ${bomb(2120, 820, 1.05)}
  </svg>
  <div class="lockup">
    <div class="crest-wrap">
      <div class="crest-glow"></div>
      <img class="crest" src="data:image/png;base64,${CREST}" alt=""/>
    </div>
    <div class="word fenix">FÊNIX</div>
    <div class="word blast">BLAST</div>
    <div class="rule"></div>
    <div class="tag">ARENA BLASTER</div>
  </div>
  <div class="vignette"></div>
  <div class="scan"></div>
</div>
</body>
</html>`;

const bannerHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
${fonts}
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body {
  width: 2400px;
  height: 528px;
  overflow: hidden;
  background: #07070C;
}
.stage {
  width: 2400px;
  height: 528px;
  position: relative;
  background:
    radial-gradient(ellipse 80% 120% at 28% 40%, #1A1A2E 0%, #07070C 62%);
  overflow: hidden;
}
.floor {
  position: absolute;
  left: 38%;
  width: 90%;
  bottom: -40%;
  height: 140%;
  background-image:
    linear-gradient(rgba(0,204,255,0.16) 2px, transparent 2px),
    linear-gradient(90deg, rgba(0,204,255,0.16) 2px, transparent 2px);
  background-size: 64px 64px;
  transform: perspective(480px) rotateX(58deg);
  transform-origin: left center;
  -webkit-mask-image: linear-gradient(to right, transparent, #000 18%, #000 70%, transparent);
  mask-image: linear-gradient(to right, transparent, #000 18%, #000 70%, transparent);
}
.orb-l {
  position: absolute;
  width: 520px; height: 520px;
  left: -80px; top: -80px;
  background: radial-gradient(circle, rgba(255,122,0,0.32), transparent 64%);
}
.orb-r {
  position: absolute;
  width: 640px; height: 640px;
  right: -40px; top: -120px;
  background: radial-gradient(circle, rgba(0,204,255,0.28), transparent 64%);
}
.vignette {
  position: absolute;
  inset: 0;
  box-shadow: inset 0 0 90px 24px #07070C;
  pointer-events: none;
}
.scan {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    to bottom,
    rgba(244,240,232,0.03) 0 1px,
    transparent 1px 4px
  );
  pointer-events: none;
}
.fx { position: absolute; inset: 0; pointer-events: none; }
.lockup {
  position: absolute;
  left: 48px;
  top: 18px;
  height: 300px;
  width: 1100px;
  display: flex;
  align-items: flex-start;
  gap: 22px;
}
.crest-wrap {
  position: relative;
  width: 250px;
  height: 250px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  margin-top: 4px;
}
.crest-glow {
  position: absolute;
  inset: -24px;
  background: radial-gradient(circle, rgba(255,215,0,0.3), transparent 68%);
}
.crest {
  width: 236px;
  height: 236px;
  object-fit: contain;
  position: relative;
  filter: drop-shadow(0 10px 18px rgba(0,0,0,0.55));
}
.copy {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  padding-top: 8px;
  padding-bottom: 0;
  min-width: 0;
}
.word {
  font-family: "Russo One", "Liberation Sans", sans-serif;
  text-transform: uppercase;
  line-height: 0.88;
  paint-order: stroke fill;
  -webkit-text-stroke: 5px #07070C;
}
.fenix {
  font-size: 96px;
  letter-spacing: 0.08em;
  color: #FFD700;
  text-shadow: 0 0 18px rgba(255,215,0,0.5), 0 0 32px rgba(255,122,0,0.4);
  padding-left: 0.08em;
}
.blast {
  font-size: 72px;
  letter-spacing: 0.26em;
  color: #00CCFF;
  text-shadow: 0 0 18px rgba(0,204,255,0.7);
  padding-left: 0.26em;
  margin-top: 2px;
}
.tag {
  font-family: "Orbitron", "Liberation Sans", sans-serif;
  font-weight: 700;
  font-size: 20px;
  letter-spacing: 0.5em;
  color: #F4F0E8;
  text-transform: uppercase;
  padding-left: 0.5em;
  margin-top: 12px;
  text-shadow: 0 0 12px rgba(0,204,255,0.4);
}
</style>
</head>
<body>
<div class="stage">
  <div class="floor"></div>
  <div class="orb-l"></div>
  <div class="orb-r"></div>
  <svg class="fx" viewBox="0 0 2400 528" xmlns="http://www.w3.org/2000/svg">
    ${blast(1680, 250, 1.1, "#FF7A00", -10)}
    ${blast(2080, 180, 0.95, "#00CCFF", 16)}
    ${blast(1880, 360, 0.55, "#FFD700", 8)}
    ${bomb(1520, 210, 1.2)}
    ${bomb(2260, 300, 0.9)}
  </svg>
  <div class="lockup">
    <div class="crest-wrap">
      <div class="crest-glow"></div>
      <img class="crest" src="data:image/png;base64,${CREST}" alt=""/>
    </div>
    <div class="copy">
      <div class="word fenix">FÊNIX</div>
      <div class="word blast">BLAST</div>
      <div class="tag">ARENA BLASTER</div>
    </div>
  </div>
  <div class="vignette"></div>
  <div class="scan"></div>
</div>
</body>
</html>`;

writeFileSync("/workspace/.grok/og-card.html", ogHtml);
writeFileSync("/workspace/.grok/x-banner.html", bannerHtml);

const chrome =
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";

async function shot(htmlPath, w, h, outPath) {
  const browser = await chromium.launch({
    executablePath: chrome,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"],
  });
  const page = await browser.newPage({
    viewport: { width: w, height: h },
    deviceScaleFactor: 1,
  });
  await page.goto("file://" + htmlPath, { waitUntil: "load" });
  await page.waitForTimeout(300);
  await page.screenshot({ path: outPath, type: "png", omitBackground: false });
  await browser.close();
}

await shot("/workspace/.grok/og-card.html", 2400, 1260, "/workspace/.grok/og-raw.png");
await shot("/workspace/.grok/x-banner.html", 2400, 528, "/workspace/.grok/x-banner-raw.png");
console.log("screenshots written");
