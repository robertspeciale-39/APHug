import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { questions } from "./questions";
import { render } from "./scene";
import { fps, loopSeconds, musicSeconds, roundSeconds, timeline } from "./timeline";

declare global {
  interface Window {
    musicData?: string;
    triviaReady: boolean;
    triviaFrame: (seconds: number) => ReturnType<typeof timeline>;
    triviaConfig: { count: number; roundSeconds: number; loopSeconds: number; musicSeconds: number; fps: number };
    triviaAudio?: { frames: number; duration: number; state: AudioContextState };
    triviaFullscreenError?: string;
  }
}

const exportMode = new URLSearchParams(location.search).has("export");
window.triviaConfig = { count: questions.length, roundSeconds, loopSeconds, musicSeconds, fps };

function App() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const audio = useRef<{ context: AudioContext; gain: GainNode; start: number } | null>(null);
  const startTime = useRef<number | null>(null);
  const controlsTimeout = useRef<number>(0);
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const ctx = canvas.current!.getContext("2d", { alpha: false })!;
    let active = true;
    let request = 0;
    const images = questions.map(({ image }) => {
      const asset = new Image();
      asset.src = `assets/${image}`;
      return asset;
    });
    Promise.all([
      ...images.map(image => image.decode()),
      document.fonts.load('550 89px "Atlas Serif"'),
      document.fonts.load('650 40px "Atlas Sans"'),
    ]).then(() => {
      if (!active) return;
      window.triviaFrame = seconds => {
        render(ctx, images, seconds);
        return timeline(seconds);
      };
      window.triviaFrame(exportMode ? 0 : 13);
      window.triviaReady = true;
      setReady(true);
      if (exportMode) return;
      const tick = (now: number) => {
        if (startTime.current !== null) {
          const clock = audio.current;
          const seconds = clock ? Math.max(0, clock.context.currentTime - clock.start)
            : (now - startTime.current) / 1000;
          window.triviaFrame(seconds);
        }
        request = requestAnimationFrame(tick);
      };
      request = requestAnimationFrame(tick);
    }).catch(() => setError("A local image or font could not load. Extract the entire ZIP, then open the HTML file again."));
    return () => {
      active = false;
      cancelAnimationFrame(request);
      window.clearTimeout(controlsTimeout.current);
      void audio.current?.context.close();
    };
  }, []);

  async function fullscreen() {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  }

  async function start() {
    if (starting || started) return;
    setStarting(true);
    void fullscreen().catch((reason: Error) => { window.triviaFullscreenError = reason.message; });
    let context: AudioContext | undefined;
    try {
      context = new AudioContext();
      await context.resume();
      if (!window.musicData) throw new Error("Missing soundtrack");
      const bytes = Uint8Array.from(atob(window.musicData), char => char.charCodeAt(0));
      const buffer = await context.decodeAudioData(bytes.buffer);
      if (Math.abs(buffer.duration - musicSeconds) > .002) throw new Error("Soundtrack duration mismatch");
      const gain = context.createGain();
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.loopEnd = musicSeconds;
      source.connect(gain).connect(context.destination);
      const start = context.currentTime + .025;
      audio.current = { context, gain, start };
      window.triviaAudio = { frames: buffer.length, duration: buffer.duration, state: context.state };
      source.start(start);
    } catch {
      void context?.close();
      setError("Music is unavailable. The presentation is running silently.");
    }
    startTime.current = performance.now();
    setStarted(true);
    setStarting(false);
  }

  function toggleSound() {
    const clock = audio.current;
    if (!clock) return;
    clock.gain.gain.setTargetAtTime(muted ? 1 : 0, clock.context.currentTime, .025);
    setMuted(!muted);
  }

  function revealControls() {
    if (!started) return;
    setShowControls(true);
    window.clearTimeout(controlsTimeout.current);
    controlsTimeout.current = window.setTimeout(() => setShowControls(false), 2400);
  }

  return <main className="player" onPointerMove={revealControls}>
    <canvas ref={canvas} width="1920" height="1080" role="img"
      aria-label={`AP Human Geography trivia presentation with ${questions.length} questions.`} />
    {!exportMode && !started && <div className="start">
      <div className="card">
        <h1>AP Human Geography Trivia</h1>
        <p>{questions.length} questions · {loopSeconds / 60} minutes per pass · Continuous loop</p>
        <button className="primary" disabled={!ready || starting} onClick={() => void start()}>
          {starting ? "Starting…" : ready ? "Start fullscreen with music" : "Loading…"}
        </button>
        {error && <p className="error" role="alert">{error}</p>}
      </div>
    </div>}
    {!exportMode && started && <div className={`controls${showControls ? " visible" : ""}`}>
      {error && <span role="status">{error}</span>}
      {audio.current && <button onClick={toggleSound} aria-pressed={muted}>{muted ? "Unmute" : "Mute"}</button>}
      <button onClick={() => void fullscreen().catch(() => {})}>Fullscreen</button>
      <button onClick={() => location.reload()}>Restart</button>
    </div>}
  </main>;
}

createRoot(document.getElementById("root")!).render(<App />);
