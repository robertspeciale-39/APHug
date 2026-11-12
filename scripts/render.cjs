const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "..");
const output = path.resolve(process.argv[2] || "AP_Human_Geography_Trivia_30_Questions.mp4");
const chrome = process.env.TRIVIA_CHROME || [
  path.join(process.env.ProgramFiles || "", "Google/Chrome/Application/chrome.exe"),
  path.join(process.env["ProgramFiles(x86)"] || "", "Microsoft/Edge/Application/msedge.exe"),
].find(file => fs.existsSync(file));
function client(browser) {
  const [input, output] = [browser.stdio[3], browser.stdio[4]];
  const callbacks = new Map();
  let serial = 0;
  let pending = "";
  output.setEncoding("utf8");
  output.on("data", data => {
    const messages = (pending + data).split("\0");
    pending = messages.pop();
    for (const message of messages) {
      const { id, result, error } = JSON.parse(message);
      const callback = callbacks.get(id);
      if (!callback) continue;
      callbacks.delete(id);
      if (error) callback.fail(new Error(error.message)); else callback.ok(result);
    }
  });
  const close = () => {
    for (const callback of callbacks.values()) callback.fail(new Error("Chrome connection closed"));
    callbacks.clear();
  };
  output.on("close", close);
  input.on("error", close);
  return (method, params = {}, sessionId) => new Promise((ok, fail) => {
    const id = ++serial;
    callbacks.set(id, { ok, fail });
    input.write(JSON.stringify({ id, method, params, sessionId }) + "\0");
  });
}

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function launch() {
  if (!chrome) throw new Error("Install Chrome or set TRIVIA_CHROME to a Chromium executable.");
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "aphug-render-"));
  const browser = spawn(chrome, [
    "--headless=new", "--remote-debugging-pipe", "--no-first-run", "--allow-file-access-from-files",
    "--disable-background-networking", "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding", "--window-size=1920,1080",
    `--user-data-dir=${scratch}`, "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"], windowsHide: true });
  let browserLog = "";
  browser.stderr.on("data", data => { browserLog = (browserLog + data).slice(-4000); });
  try {
    const send = client(browser);
    const { targetInfos } = await send("Target.getTargets").catch(error => {
      throw new Error(error.message + ": " + browserLog);
    });
    const targetId = targetInfos.find(target => target.type === "page").targetId;
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    const connection = { send: (method, params) => send(method, params, sessionId) };
    const evaluate = async expression => {
      const response = await connection.send("Runtime.evaluate", {
        expression, awaitPromise: true, returnByValue: true, userGesture: true,
      });
      if (response.exceptionDetails) throw new Error(response.result.description || response.exceptionDetails.text);
      return response.result.value;
    };
    await connection.send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
    const base = pathToFileURL(path.join(root, "index.html")).href;
    await connection.send("Page.navigate", { url: base + "?export" });
    for (let tries = 0; !(await evaluate("window.triviaReady === true").catch(() => false)); tries++) {
      if (tries >= 150) throw new Error("Presentation assets failed to load");
      await pause(100);
    }
    const { count, roundSeconds, loopSeconds, musicSeconds, fps } = await evaluate("window.triviaConfig");
    const frames = loopSeconds * fps;

    const tested = await evaluate(`(() => {
      const { count, roundSeconds, loopSeconds, fps } = triviaConfig;
      const phases = [[0,"question"],[5,"choices"],[10,"countdown"],[30,"reveal"],[36,"explanation"],[55,"transition"]];
      let checks = 0;
      for (let pass = 0; pass < 2; pass++) {
        for (let question = 0; question < count; question++) {
          const start = pass * loopSeconds + question * roundSeconds;
          for (const [time, phase] of phases) {
            const result = triviaFrame(start + time);
            if (result.phase !== phase || result.index !== question) throw Error("Phase boundary " + time);
            checks++;
          }
          for (let second = 0; second <= 20; second++) {
            const result = triviaFrame(start + 10 + second);
            if (result.remaining !== 20 - second) throw Error("Countdown " + second);
            if (second < 20 && triviaFrame(start + 10 + second + (fps - 1)/fps).remaining !== 20 - second)
              throw Error("Countdown tick length");
            checks++;
          }
        }
      }
      triviaFrame(loopSeconds - 1/fps);
      const before = document.querySelector("canvas").toDataURL();
      triviaFrame(loopSeconds);
      const after = document.querySelector("canvas").toDataURL();
      if (before !== after) throw Error("Loop seam pixels differ");
      const atZero = triviaFrame(0);
      if (atZero.index !== 0 || document.querySelector("canvas").toDataURL() !== after) throw Error("Loop did not wrap");
      triviaFrame(44);
      const firstPass = document.querySelector("canvas").toDataURL();
      triviaFrame(loopSeconds + 44);
      if (document.querySelector("canvas").toDataURL() !== firstPass) throw Error("Second pass differs");
      return checks + 3;
    })()`);
    console.log(`${tested} timing and loop checks passed`);

    const evidence = path.join(path.dirname(output), ".trivia-review");
    if (process.env.TRIVIA_REVIEW === "1") {
      fs.mkdirSync(evidence, { recursive: true });
      const reviewTimes = Array.from({ length: count }, (_, index) =>
        [15, 34, 44].map(second => index * roundSeconds + second)).flat();
      for (const time of reviewTimes) {
        const data = await evaluate(`triviaFrame(${time}); document.querySelector("canvas").toDataURL("image/jpeg", .93).split(",")[1]`);
        fs.writeFileSync(path.join(evidence, `frame-${time}.jpg`), Buffer.from(data, "base64"));
      }
      await connection.send("Page.navigate", { url: base });
      for (let tries = 0; !(await evaluate("window.triviaReady === true").catch(() => false)); tries++) {
        if (tries >= 150) throw new Error("Player assets failed to load");
        await pause(100);
      }
      const button = await evaluate(`(() => { const rect = document.querySelector("button").getBoundingClientRect(); return {x:rect.x+rect.width/2,y:rect.y+rect.height/2}; })()`);
      await connection.send("Input.dispatchMouseEvent", { type: "mousePressed", ...button, button: "left", clickCount: 1 });
      await connection.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...button, button: "left", clickCount: 1 });
      let player;
      for (let tries = 0; !player?.audio; tries++) {
        if (tries >= 100) throw new Error(`Player audio did not start: ${JSON.stringify(player)}`);
        player = await evaluate("({audio:window.triviaAudio, fullscreen:!!document.fullscreenElement, fullscreenError:window.triviaFullscreenError, error:document.querySelector('.error')?.textContent})");
        await pause(100);
      }
      if (player.audio.duration !== musicSeconds || player.audio.state !== "running") {
        throw new Error("Browser audio failed: " + JSON.stringify(player));
      }
      console.log("Playback button and looping music buffer verified; fullscreen: " +
        (player.fullscreen ? "verified" : player.fullscreenError || "unavailable in headless Chrome"));
      if (process.env.TRIVIA_CHECK_ONLY === "1") return;
      await connection.send("Page.navigate", { url: base + "?export" });
      for (let tries = 0; !(await evaluate("window.triviaReady === true").catch(() => false)); tries++) {
        if (tries >= 150) throw new Error("Export assets failed to reload");
        await pause(100);
      }
    }

    const codec = await evaluate(`(async () => {
      window.encoded = [];
      window.encoderError = null;
      const preferred = {codec:"avc1.640028", width:1920, height:1080, bitrate:1750000,
        framerate:30, avc:{format:"annexb"}, latencyMode:"realtime", hardwareAcceleration:"prefer-software"};
      const fallback = {codec:"vp8", width:1920, height:1080, bitrate:6500000, framerate:30,
        latencyMode:"quality"};
      const config = (await VideoEncoder.isConfigSupported(preferred)).supported ? preferred : fallback;
      window.encoder = new VideoEncoder({
        output(chunk) {
          const bytes = new Uint8Array(chunk.byteLength);
          chunk.copyTo(bytes);
          let data = "";
          for (let i = 0; i < bytes.length; i += 16384)
            data += String.fromCharCode(...bytes.subarray(i,i+16384));
          encoded.push([Math.round(chunk.timestamp * 30 / 1000000), btoa(data)]);
        },
        error(error) { window.encoderError = error.message; },
      });
      encoder.configure(config);
      return config.codec;
    })()`);
    console.log("Rendering " + codec);
    const avc = codec.startsWith("avc");
    const elementary = path.join(scratch, avc ? "trivia.h264" : "trivia.ivf");
    const fd = fs.openSync(elementary, "w");
    let written = 0;
    try {
      if (!avc) {
        const header = Buffer.alloc(32);
        header.write("DKIF"); header.writeUInt16LE(32, 6); header.write("VP80", 8);
        header.writeUInt16LE(1920, 12); header.writeUInt16LE(1080, 14);
        header.writeUInt32LE(fps, 16); header.writeUInt32LE(1, 20); header.writeUInt32LE(frames, 24);
        fs.writeSync(fd, header);
      }
      for (let first = 0; first < frames; first += 60) {
        const chunks = await evaluate(`(async () => {
          const canvas = document.querySelector("canvas");
          for (let frame = ${first}; frame < ${Math.min(first + 60, frames)}; frame++) {
            triviaFrame(frame / 30);
            const bitmap = new VideoFrame(canvas, {timestamp:Math.round(frame * 1000000 / 30)});
            encoder.encode(bitmap, {keyFrame:frame % 60 === 0});
            bitmap.close();
            if (encoder.encodeQueueSize > 5) {
              await new Promise(resolve => encoder.addEventListener("dequeue",resolve,{once:true}));
            }
            if (encoderError) throw Error(encoderError);
          }
          if (${first + 60 >= frames}) await encoder.flush();
          return encoded.splice(0);
        })()`);
        for (const [frame, data] of chunks) {
          const bytes = Buffer.from(data, "base64");
          if (!avc) {
            const header = Buffer.alloc(12);
            header.writeUInt32LE(bytes.length);
            header.writeBigUInt64LE(BigInt(frame), 4);
            fs.writeSync(fd, header);
          }
          fs.writeSync(fd, bytes);
          written++;
        }
        if (first % 900 === 0) console.log(`Rendered ${Math.min(first + 60, frames) / fps}s / ${loopSeconds}s`);
      }
    } finally {
      fs.closeSync(fd);
    }
    if (written !== frames) throw new Error(`Encoder produced ${written} frames, expected ${frames}`);

    const format = avc ? ["-f","h264","-r","30"] : ["-f","ivf"];
    const video = avc ? ["-c:v","copy"] : ["-c:v","libx264","-preset","veryfast","-crf","19","-pix_fmt","yuv420p"];
    const result = spawnSync("ffmpeg", [
      "-hide_banner","-loglevel","error","-y",...format,"-i",elementary,
      "-stream_loop","-1","-i",path.join(root,"assets/music.ogg"),"-map","0:v:0","-map","1:a:0",
      ...video,"-c:a","aac","-b:a","160k","-t",String(loopSeconds),"-movflags","+faststart",output,
    ], { stdio: "inherit", windowsHide: true });
    if (result.status !== 0) throw new Error("FFmpeg did not produce an MP4");
    console.log(output);
  } finally {
    browser.kill();
    await pause(500);
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch {}
  }
}

launch().catch(error => { console.error(error); process.exitCode = 1; });
