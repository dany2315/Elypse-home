"use client";

import QRCode from "qrcode";

/** Carte A6 (105 × 148 mm à 300 dpi) à poser dans l'appartement : logo, titre, QR code du livret. */
const W = 1240;
const H = 1748;

const NIGHT = "#070c1c";
const GOLD = "#c9a45c";
const GOLD_LIGHT = "#ead39a";
const IVORY = "#f8f4ec";

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function cssFont(variable: string, fallback: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return value || fallback;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export async function renderPrintCard({ url, title }: { url: string; title: string }): Promise<Blob> {
  const serif = cssFont("--font-cormorant", "Georgia, serif");
  const sans = cssFont("--font-manrope", "Arial, sans-serif");
  await Promise.all([
    document.fonts.load(`500 64px ${serif}`),
    document.fonts.load(`italic 500 40px ${serif}`),
    document.fonts.load(`600 30px ${sans}`),
  ]).catch(() => undefined);

  const [logo, qrUrl] = await Promise.all([
    loadImage("/brand/logo-full.png"),
    QRCode.toDataURL(url, { margin: 0, width: 560, errorCorrectionLevel: "M", color: { dark: NIGHT, light: "#ffffff" } }),
  ]);
  const qr = await loadImage(qrUrl);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Fond nuit avec halo
  ctx.fillStyle = NIGHT;
  ctx.fillRect(0, 0, W, H);
  const halo = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, W);
  halo.addColorStop(0, "rgba(40, 52, 112, .75)");
  halo.addColorStop(1, "rgba(7, 12, 28, 0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, H);

  // Double filet doré
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  roundRect(ctx, 44, 44, W - 88, H - 88, 34);
  ctx.stroke();
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 1.5;
  roundRect(ctx, 62, 62, W - 124, H - 124, 26);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Logo complet
  const logoW = 380;
  const logoH = (logo.height / logo.width) * logoW;
  ctx.drawImage(logo, (W - logoW) / 2, 120, logoW, logoH);

  // Titre du livret
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = IVORY;
  ctx.font = `500 62px ${serif}`;
  let y = 120 + logoH + 110;
  for (const line of wrap(ctx, title, W - 260).slice(0, 3)) {
    ctx.fillText(line, W / 2, y);
    y += 72;
  }

  // Filet
  const hair = ctx.createLinearGradient(W / 2 - 120, 0, W / 2 + 120, 0);
  hair.addColorStop(0, "rgba(201,164,92,0)");
  hair.addColorStop(0.5, GOLD_LIGHT);
  hair.addColorStop(1, "rgba(201,164,92,0)");
  ctx.fillStyle = hair;
  ctx.fillRect(W / 2 - 120, y - 20, 240, 2);

  // QR code sur carte blanche
  const box = 640;
  const boxY = Math.max(y + 30, 860);
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, (W - box) / 2, boxY, box, box, 36);
  ctx.fill();
  ctx.drawImage(qr, (W - 560) / 2, boxY + 40, 560, 560);

  // Légendes
  ctx.fillStyle = IVORY;
  ctx.font = `600 30px ${sans}`;
  ctx.letterSpacing = "6px";
  ctx.fillText("SCANNEZ POUR OUVRIR VOTRE LIVRET", W / 2, boxY + box + 90);
  ctx.letterSpacing = "0px";
  ctx.fillStyle = GOLD_LIGHT;
  ctx.font = `italic 500 40px ${serif}`;
  ctx.fillText("Scan to open your welcome guide", W / 2, boxY + box + 148);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Génération impossible"))), "image/png"),
  );
}

/** Téléchargement fiable (y compris Safari iOS) via une URL blob. */
export function downloadBlob(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
}

/** Ouvre la carte dans un onglet prêt à imprimer (format A6). */
export function printBlob(blob: Blob, title: string) {
  const win = window.open("", "_blank");
  if (!win) return false;
  const href = URL.createObjectURL(blob);
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title.replace(/</g, "&lt;")}</title>
<style>@page{size:105mm 148mm;margin:0}html,body{margin:0;background:#fff}img{display:block;width:105mm;height:148mm;margin:0 auto}</style>
</head><body><img src="${href}" onload="setTimeout(function(){window.print()},150)"></body></html>`);
  win.document.close();
  return true;
}
