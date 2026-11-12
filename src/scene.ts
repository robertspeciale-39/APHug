import { questions } from "./questions";
import { ease, mix, timeline } from "./timeline";

const width = 1920;
const height = 1080;
const navy = "#080f1d";
const white = "#f6eee0";
const gold = "#e6b875";
const teal = "#87d8cb";
const muted = "#b2c2cb";
const serif = "Atlas Serif, Georgia, serif";
const sans = "Atlas Sans, Segoe UI, sans-serif";
const letter = ["A", "B", "C", "D"];

function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number,
              size: number, color: string, family = sans, weight = 400,
              align: CanvasTextAlign = "left", tracking = "0px") {
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.letterSpacing = tracking;
  ctx.fillText(value, x, y);
  ctx.letterSpacing = "0px";
}

function wrapLines(ctx: CanvasRenderingContext2D, value: string, maxWidth: number,
                   size: number, family: string, weight: number) {
  ctx.font = `${weight} ${size}px ${family}`;
  const lines: string[] = [];
  let line = "";
  for (const word of value.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  lines.push(line);
  return lines;
}

function wrapped(ctx: CanvasRenderingContext2D, value: string, x: number, y: number,
                 maxWidth: number, size: number, leading: number, family: string,
                 weight: number, maxLines: number) {
  const preferredSize = size;
  let lines = wrapLines(ctx, value, maxWidth, size, family, weight);
  while (lines.length > maxLines) {
    size -= 2;
    lines = wrapLines(ctx, value, maxWidth, size, family, weight);
  }
  lines.forEach((item, index) => text(ctx, item, x, y + index * leading * size / preferredSize,
    size, white, family, weight));
}

function fittedText(ctx: CanvasRenderingContext2D, value: string, x: number, y: number,
                    maxWidth: number, size: number, family: string, weight: number) {
  ctx.font = `${weight} ${size}px ${family}`;
  const fitted = Math.min(size, Math.floor(size * maxWidth / ctx.measureText(value).width));
  text(ctx, value, x, y, fitted, white, family, weight);
}

function rule(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, 1);
}

function cover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number,
               w: number, h: number, scale: number, position: number) {
  const fit = Math.max(w / image.naturalWidth, h / image.naturalHeight) * scale;
  const dw = image.naturalWidth * fit;
  const dh = image.naturalHeight * fit;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) * position, dw, dh);
  ctx.restore();
}

function choice(ctx: CanvasRenderingContext2D, value: string, index: number, x: number, y: number,
                opacity: number, zoom: number, highlight: number) {
  if (opacity <= 0) return;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(x, y);
  ctx.scale(zoom, zoom);
  ctx.fillStyle = `rgba(${Math.round(mix(12, 29, highlight))}, ${Math.round(mix(26, 49, highlight))}, ${Math.round(mix(41, 56, highlight))}, .95)`;
  ctx.fillRect(-388, -52, 776, 104);
  ctx.strokeStyle = highlight > .5 ? gold : "#4d6572";
  ctx.lineWidth = highlight > .5 ? 2 : 1;
  ctx.strokeRect(-388, -52, 776, 104);
  ctx.fillStyle = highlight > .5 ? gold : teal;
  ctx.fillRect(-388, -52, 4, 104);
  ctx.strokeStyle = highlight > .5 ? "#ba985e" : "#405e67";
  ctx.strokeRect(-349, -25, 50, 50);
  text(ctx, letter[index], -324, 10, 29, highlight > .5 ? gold : teal, sans, 700, "center");
  fittedText(ctx, value, -270, 13, 624, 40, sans, 600);
  ctx.restore();
}

function timer(ctx: CanvasRenderingContext2D, value: number, fraction: number, opacity: number) {
  ctx.save();
  ctx.globalAlpha = opacity;
  const x = 1580;
  const y = 340;
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#36505e";
  ctx.beginPath();
  ctx.arc(x, y, 97, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.lineWidth = 6;
  ctx.strokeStyle = value <= 5 ? gold : teal;
  ctx.beginPath();
  ctx.arc(x, y, 97, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * fraction);
  ctx.stroke();
  text(ctx, String(value).padStart(2, "0"), x, y + 16, 77, white, sans, 650, "center");
  text(ctx, "SECONDS", x, y + 53, 18, value <= 5 ? gold : teal, sans, 700, "center", "3px");
  ctx.restore();
}

export function render(ctx: CanvasRenderingContext2D, images: HTMLImageElement[], seconds: number) {
  const { index, time: t, remaining } = timeline(seconds);
  const question = questions[index];
  const image = images[index];
  const intro = ease(t, 0, 2.5);
  const outro = 1 - ease(t, 55, 59.75);
  const chapter = intro * outro;
  const sceneIn = ease(t, 35.95, 37.5);

  ctx.fillStyle = navy;
  ctx.fillRect(0, 0, width, height);
  if (chapter > 0) {
    ctx.save();
    ctx.globalAlpha = chapter * .76;
    cover(ctx, image, 720, 0, 1200, height, 1.06 + t * .0011, question.position);
    ctx.restore();
  }
  const shade = ctx.createLinearGradient(690, 0, 1920, 0);
  shade.addColorStop(0, navy);
  shade.addColorStop(.54, "rgba(8,15,29,.81)");
  shade.addColorStop(1, "rgba(8,15,29,.53)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, width, height);
  const vignette = ctx.createLinearGradient(0, 0, 0, height);
  vignette.addColorStop(0, "rgba(8,15,29,.80)");
  vignette.addColorStop(.30, "rgba(8,15,29,0)");
  vignette.addColorStop(.58, "rgba(8,15,29,0)");
  vignette.addColorStop(1, navy);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.strokeStyle = "rgba(134,183,186,.11)";
  ctx.lineWidth = 1;
  for (let ring = 1; ring <= 4; ring++) {
    ctx.beginPath();
    ctx.ellipse(1615, 494, ring * 109, ring * 106, -.27, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  rule(ctx, 116, 121, 1688, "#43505d");
  rule(ctx, 116, 956, 1688, "#43505d");
  ctx.fillStyle = gold;
  ctx.fillRect(116, 120, 99, 3);
  text(ctx, "AP HUMAN GEOGRAPHY", 116, 94, 25, white, sans, 700, "left", "4px");
  text(ctx, "TRIVIA LOOP", 1804, 94, 22, gold, sans, 700, "right", "4px");

  ctx.save();
  ctx.globalAlpha = chapter;
  const stage = t < 30 ? "QUESTION" : t < 36 ? "ANSWER" : "EXPLANATION";
  text(ctx, `${String(index + 1).padStart(2, "0")} / ${questions.length}`, 116, 1005, 24, gold, sans, 700, "left", "2px");
  text(ctx, stage, 224, 1005, 21, muted, sans, 600, "left", "3px");
  for (let step = 0; step < questions.length; step++) {
    ctx.fillStyle = step === index ? teal : step < index ? "#527d7d" : "#455461";
    ctx.fillRect(1448 + step * 12, 991, 8, 4);
  }
  ctx.restore();

  const promptOpacity = ease(t, .15, 4.65) * (1 - ease(t, 30, 32.2));
  if (promptOpacity > 0) {
    ctx.save();
    ctx.globalAlpha = promptOpacity;
    const y = 323 + 20 * (1 - ease(t, .15, 4.65));
    text(ctx, question.unit, 116, y - 119, 25, teal, sans, 700, "left", "3px");
    wrapped(ctx, question.prompt, 116, y, 1205, 89, 97, serif, 550, 3);
    ctx.restore();
  }

  if (t >= 5 && t < 36.8) {
    const move = ease(t, 30.55, 33.55);
    question.choices.forEach((value, option) => {
      const isCorrect = option === question.answer;
      const x = option % 2 === 0 ? 504 : 1318;
      const y = option < 2 ? 687 : 815;
      const fadeIn = ease(t, 5 + option * .73, 6.7 + option * .73);
      const fadeOut = isCorrect ? 1 - sceneIn : 1 - ease(t, 30, 31.7);
      choice(ctx, value, option, isCorrect ? mix(x, 960, move) : x,
        isCorrect ? mix(y, 532, move) : y, fadeIn * fadeOut,
        isCorrect ? mix(1, 1.38, move) : 1, isCorrect ? ease(t, 30, 31.1) : 0);
    });
    if (t >= 32.4) {
      ctx.save();
      ctx.globalAlpha = ease(t, 32.4, 33.4) * (1 - sceneIn);
      text(ctx, "CORRECT ANSWER", 960, 395, 25, teal, sans, 700, "center", "5px");
      ctx.restore();
    }
  }
  if (t >= 10 && t < 31) {
    timer(ctx, remaining, Math.max(0, (30 - t) / 20), 1 - ease(t, 30.55, 31));
  }

  const panelAlpha = sceneIn * (1 - ease(t, 55.1, 58.1));
  if (panelAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = panelAlpha;
    const offset = 22 * (1 - sceneIn);
    const x = 955;
    const y = 179 + offset;
    const w = 849;
    const h = 721;
    ctx.fillStyle = navy;
    ctx.fillRect(104, 170, 804, 735);
    cover(ctx, image, x, y, w, h, 1 + Math.max(0, t - 36) * .00165, question.position);
    const fade = ctx.createLinearGradient(0, y + h - 164, 0, y + h);
    fade.addColorStop(0, "rgba(8,15,29,0)");
    fade.addColorStop(1, "rgba(8,15,29,.90)");
    ctx.fillStyle = fade;
    ctx.fillRect(x, y + h - 164, w, 164);
    ctx.strokeStyle = "#8d795a";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    text(ctx, question.caption, x + 30, y + h - 29, 21, white, sans, 650, "left", "3px");
    text(ctx, question.unit, 116, 269 + offset, 24, teal, sans, 700, "left", "3px");
    fittedText(ctx, question.choices[question.answer], 116, 392 + offset, 725, 95, serif, 600);
    rule(ctx, 117, 436 + offset, 673, "#9a8059");
    wrapped(ctx, question.explanation, 116, 522 + offset, 723, 40, 54, sans, 430, 7);
    ctx.restore();
  }

  const flare = ease(t, 55, 57.2) * (1 - ease(t, 57.2, 59.65));
  if (flare > 0) {
    const center = mix(1840, 120, ease(t, 55, 59.65));
    const light = ctx.createLinearGradient(center - 390, 0, center + 390, 0);
    light.addColorStop(0, "rgba(83,189,175,0)");
    light.addColorStop(.50, `rgba(83,189,175,${.19 * flare})`);
    light.addColorStop(1, "rgba(83,189,175,0)");
    ctx.fillStyle = light;
    ctx.fillRect(0, 123, width, 833);
  }
}
