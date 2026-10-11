/*
 * 공유 이미지(올해·이달·평생 숲 카드) 그리기와 저장·공유.
 */

// Share (redesign 15/16): one sheet for the month forest, the year forest and a finished work,
// with a story (9:16) or feed (4:5) image. Everything is drawn on a canvas from local assets.
let shareKind = "year",
  shareRevision = "",
  shareGeneration = 0,
  shareFormat = "feed",
  shareTarget = "";

const shareImageCache = new Map();

function shareAsset(src) {
  if (!shareImageCache.has(src))
    shareImageCache.set(
      src,
      loadImage(src).catch(() => null),
    );
  return shareImageCache.get(src);
}

async function inlineSvgImages(markup) {
  const hrefs = [...new Set([...markup.matchAll(/href="(\.\/assets\/[^"]+)"/g)].map((m) => m[1]))];
  const pairs = await Promise.all(
    hrefs.map(async (href) => {
      try {
        const blob = await (await fetch(href)).blob();
        return [
          href,
          await new Promise((r) => {
            const f = new FileReader();
            f.onload = () => r(f.result);
            f.onerror = () => r("");
            f.readAsDataURL(blob);
          }),
        ];
      } catch {
        return [href, ""];
      }
    }),
  );
  for (const [href, data] of pairs)
    if (data) markup = markup.split('href="' + href + '"').join('href="' + data + '"');
  return markup;
}

function shareSnapshot() {
  return JSON.stringify({
    items: state.items,
    collection: state.collection,
    floor: bmFloorId(),
    year,
    month,
    kind: shareKind,
    target: shareTarget,
    format: shareFormat,
    name: state.profile.name,
  });
}

function shareRounded(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// "(이름)의 … 숲" with the name shortened (…) so the title fits maxW at the current font.
function shareFitTitle(ctx, name, suffix, maxW) {
  if (ctx.measureText(name + suffix).width <= maxW) return name + suffix;
  let n = [...name];
  while (n.length > 1 && ctx.measureText(n.join("") + "…" + suffix).width > maxW) n.pop();
  return n.join("") + "…" + suffix;
}

function sharePill(
  ctx,
  text,
  x,
  y,
  { fill = "#fff", color = "#1E2A22", size = 34, rotate = 0, bold = "", boldSize = 0, align = "left" } = {},
) {
  const F = '"Pretendard Variable",Pretendard,sans-serif';
  ctx.save();
  ctx.font = "600 " + size + "px " + F;
  const w1 = ctx.measureText(text).width;
  ctx.font = "800 " + (boldSize || size * 1.25) + "px " + F;
  const w2 = bold ? ctx.measureText(bold).width + 16 : 0;
  const w = w1 + w2 + 64,
    h = (boldSize || size * 1.25) + 48,
    ox = align === "right" ? x - w : x;
  ctx.translate(ox + w / 2, y + h / 2);
  ctx.rotate((rotate * Math.PI) / 180);
  ctx.shadowColor = "rgba(30,42,34,.18)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = "#fff";
  shareRounded(ctx, -w / 2 - 6, -h / 2 - 6, w + 12, h + 12, (h + 12) / 2);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = fill;
  shareRounded(ctx, -w / 2, -h / 2, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.font = "600 " + size + "px " + F;
  ctx.fillText(text, -w / 2 + 32, 2);
  if (bold) {
    ctx.font = "800 " + (boldSize || size * 1.25) + "px " + F;
    ctx.fillText(bold, -w / 2 + 32 + w1 + 16, 2);
  }
  ctx.restore();
  return w;
}

// Same rubber stamp as stampSVG (coral rings, arc lettering, DONE), drawn on canvas.
async function shareIsland(ctx, y0, x0, scale, items) {
  const g = yearBoardGeometry(forestLifetime && shareKind === "year" ? "all" : year, items),
    G = g.ground,
    P = (x, y) => [x0 + x * scale, y0 + y * scale];
  const poly = (pts, fill, stroke) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    pts.forEach(([x, y], k) => {
      const [px, py] = P(x, y);
      k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    });
    ctx.closePath();
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = fill;
      ctx.lineWidth = 0.7 * scale;
      ctx.lineJoin = "round";
      ctx.stroke();
    }
  };
  const oval = (x, y, rx, ry, fill, a = 1) => {
    ctx.globalAlpha = a;
    ctx.fillStyle = fill;
    ctx.beginPath();
    const [px, py] = P(x, y);
    ctx.ellipse(px, py, rx * scale, ry * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  };
  G.sides.forEach((f) => poly(f.pts, f.fill));
  G.specks.forEach((d) => oval(d.x, d.y, d.r, d.r, d.fill, 0.85));
  G.lips.forEach((f) => poly(f.pts, f.fill));
  G.facets.forEach((f) => poly(f.pts, f.fill, true));
  G.extras.forEach((e) => oval(e.x, e.y, e.rx, e.ry, e.fill, e.opacity || 1));
  g.dots.forEach((d) => oval(d.x, d.y, g.cellW * 0.16, g.cellW * 0.08, G.dot));
  const imgs = await Promise.all(g.trees.map((t) => shareAsset(t.src)));
  g.trees.forEach((t, k) => {
    if (imgs[k]) {
      const z = t.size,
        [x, y] = P(t.x - z / 2, t.y - z * 0.875);
      ctx.drawImage(imgs[k], x, y, z * scale, z * scale);
    }
  });
}

async function drawShareCard(kind, format, target) {
  if (document.fonts?.ready) await document.fonts.ready;
  const W = 1080,
    H = format === "story" ? 1920 : 1350,
    story = format === "story",
    canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const F = '"Pretendard Variable",Pretendard,sans-serif',
    L = "Archivo," + F,
    name = state.profile.name || "나",
    ink = "#1E2A22",
    muted = "#52524F",
    months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  ctx.fillStyle = "#F8F8F6";
  ctx.fillRect(0, 0, W, H);
  if (kind === "year" && forestLifetime)
    return drawLifetimeCard(ctx, canvas, W, H, story, name, F, L, "life");
  if (kind === "year" || kind === "month") return drawStickerCard(ctx, canvas, W, H, story, name, F, L, kind);
  return canvas;
}

// Forest stat cards. Lifetime ("솔의 숲"): a night forest — dark sky, stars, the island lit from behind,
// a bar per year. Year ("올해의 숲"): the same layout on white, no sky, a bar per month.
async function drawLifetimeCard(ctx, canvas, W, H, story, name, F, L, mode = "life") {
  const life = mode === "life",
    items = yearForestItems(life ? "all" : year, "all"),
    done = items.filter((x) => x.completed),
    books = done.filter((x) => x.type === "book").length,
    films = done.filter((x) => x.type === "movie").length;
  const years = forestTreeYears(),
    first = years[0] || now().slice(0, 4),
    rated = done.filter((x) => validRating(x.rating)),
    avg = rated.length ? (rated.reduce((n, x) => n + Number(x.rating), 0) / rated.length).toFixed(1) : "";
  const butter = "#F7E7A1",
    mint = "#BFE7CB",
    coral = "#E85A47",
    ink = "#1E2A22",
    white = "#FFFFFF";
  const fg = life ? white : ink,
    soft = life ? "rgba(255,255,255,.62)" : "rgba(30,42,34,.55)",
    accent = life ? butter : ink;
  if (life) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#16211A");
    g.addColorStop(0.55, "#22382B");
    g.addColorStop(1, "#2E4A38");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const rnd = (k) => (hash("life|" + k) % 10000) / 10000;
    for (let i = 0; i < 90; i++) {
      const x = rnd("x" + i) * W,
        y = rnd("y" + i) * H * 0.62,
        r = 0.8 + rnd("r" + i) * 2.2;
      ctx.globalAlpha = 0.25 + rnd("a" + i) * 0.6;
      ctx.fillStyle = i % 7 ? white : butter;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const sparkle = (x, y, r, c) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = c;
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4,
          rr = k % 2 ? r * 0.28 : r;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };
    [
      [0.86, 0.28, 20],
      [0.2, 0.48, 12],
      [0.9, 0.52, 14],
      [0.07, 0.36, 22],
      [0.93, 0.14, 12],
      [0.5, 0.06, 10],
      [0.32, 0.12, 9],
      [0.7, 0.4, 10],
    ].forEach(([x, y, r], i) => {
      if (i === 0) {
        const px = W * x,
          py = H * y * (story ? 1 : 0.95),
          rr = 13;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(0.2);
        ctx.fillStyle = "#F7B8C6";
        ctx.beginPath();
        for (let k = 0; k < 10; k++) {
          const a = (k * Math.PI) / 5 - Math.PI / 2,
            q = k % 2 ? rr * 0.45 : rr;
          ctx.lineTo(Math.cos(a) * q, Math.sin(a) * q);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else sparkle(W * x, H * y * (story ? 1 : 0.95), r, i % 2 ? butter : white);
    });
    // one small shooting star across the sky
    {
      const sx = W * 0.2,
        sy = H * (story ? 0.19 : 0.2),
        len = W * 0.14,
        ex = sx - len * 0.9,
        ey = sy - len * 0.4;
      const tr = ctx.createLinearGradient(sx, sy, ex, ey);
      tr.addColorStop(0, "rgba(255,255,255,.95)");
      tr.addColorStop(1, "rgba(255,255,255,0)");
      const dx = ex - sx,
        dy = ey - sy,
        dl = Math.hypot(dx, dy),
        nx = -dy / dl,
        ny = dx / dl,
        hw = 5;
      ctx.fillStyle = tr;
      ctx.beginPath();
      ctx.moveTo(sx + nx * hw, sy + ny * hw);
      ctx.lineTo(ex, ey);
      ctx.lineTo(sx - nx * hw, sy - ny * hw);
      ctx.closePath();
      ctx.fill();
      const hg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 22);
      hg.addColorStop(0, "rgba(255,255,255,1)");
      hg.addColorStop(0.25, "rgba(255,250,225,.9)");
      hg.addColorStop(1, "rgba(247,231,161,0)");
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(sx, sy, 22, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, W, H);
  }
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = fg;
  ctx.font = "700 30px " + L;
  ctx.letterSpacing = "4px";
  ctx.textAlign = "left";
  ctx.fillText("GREW", 72, 96);
  ctx.textAlign = "right";
  ctx.fillStyle = life ? butter : soft;
  ctx.fillText(life ? "SINCE " + first : year + " FOREST", W - 72, 96);
  ctx.letterSpacing = "0px";
  const top = story ? 264 : 192;
  ctx.textAlign = "center";
  ctx.fillStyle = fg;
  ctx.font = "700 54px " + F;
  ctx.fillText(shareFitTitle(ctx, name, "의 " + (life ? "" : "올해 ") + "숲", W - 144), W / 2, top);
  ctx.fillStyle = accent;
  ctx.font = "800 " + (story ? 280 : 220) + "px " + L;
  ctx.fillText(String(done.length), W / 2, top + (story ? 270 : 215));
  ctx.fillStyle = soft;
  ctx.font = "600 44px " + F;
  ctx.fillText(life ? "그루가 자랐어요" : "그루를 심었어요", W / 2, top + (story ? 350 : 285));
  const bandTop = top + (story ? 400 : 300),
    bandH = story ? 700 : 480,
    scale = Math.min((W - 20) / 390, bandH / 250),
    cx = W / 2,
    cy = bandTop + bandH * 0.52;
  const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, W * 0.55);
  if (life) {
    glow.addColorStop(0, "rgba(247,231,161,.5)");
    glow.addColorStop(0.5, "rgba(191,231,203,.16)");
    glow.addColorStop(1, "rgba(191,231,203,0)");
  } else {
    glow.addColorStop(0, "rgba(191,231,203,.28)");
    glow.addColorStop(1, "rgba(191,231,203,0)");
  }
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  await shareIsland(ctx, bandTop + (bandH - 250 * scale) / 2, (W - 390 * scale) / 2, scale, items);
  // bars: a year each (lifetime) or a month each (this year)
  const cur = now().slice(0, 7),
    labels = life ? years.slice(-6) : Array.from({ length: 12 }, (_, i) => String(i + 1)),
    counts = life
      ? labels.map((y) => yearForestItems(y, "all").length)
      : labels.map(
          (_, i) => done.filter((x) => x.completed.slice(5, 7) === String(i + 1).padStart(2, "0")).length,
        );
  const best = life ? labels.length - 1 : counts.indexOf(Math.max(...counts)),
    gap = life ? 24 : 16,
    max = Math.max(1, ...counts),
    barW = Math.min(110, (W - 144 - (labels.length - 1) * gap) / Math.max(1, labels.length)),
    totalW = labels.length * barW + (labels.length - 1) * gap,
    x0 = (W - totalW) / 2,
    chartTop = bandTop + bandH + (story ? 48 : 32),
    chartH = story ? 190 : 96;
  labels.forEach((lb, i) => {
    const future = !life && year + "-" + String(i + 1).padStart(2, "0") > cur,
      h = counts[i] ? Math.max(12, (counts[i] / max) * chartH) : 6,
      x = x0 + i * (barW + gap),
      by = chartTop + chartH - h;
    ctx.fillStyle = i === best && counts[i] ? butter : life ? mint : future ? "rgba(30,42,34,.06)" : mint;
    ctx.globalAlpha = life && i !== best ? 0.85 : 1;
    shareRounded(ctx, x, by, barW, h, Math.min(18, barW / 2, h / 2));
    ctx.fill();
    ctx.globalAlpha = 1;
    if (counts[i]) {
      ctx.fillStyle = fg;
      ctx.font = "800 " + (life ? 32 : 28) + "px " + L;
      ctx.fillText(String(counts[i]), x + barW / 2, by - 16);
    }
    ctx.fillStyle = soft;
    ctx.font = "600 " + (life ? 26 : 24) + "px " + L;
    ctx.fillText(lb, x + barW / 2, chartTop + chartH + 40);
  });
  ctx.textAlign = "left";
  const chipY = chartTop + chartH + (story ? 88 : 64);
  const chip = (label, fill, color) => {
    ctx.font = "700 32px " + F;
    return { label, fill, color, w: ctx.measureText(label).width + 64 };
  };
  const chips = [
    chip("책 " + books + "권", butter, ink),
    chip("영화 " + films + "편", mint, ink),
    ...(avg ? [chip("★ " + avg, coral, white)] : []),
    life
      ? chip(years.length + "년째", null, white)
      : counts[best]
        ? chip("제일 울창한 달 " + (best + 1) + "월", null, ink)
        : null,
  ].filter(Boolean);
  let cxs = (W - (chips.reduce((n, c) => n + c.w, 0) + (chips.length - 1) * 16)) / 2;
  chips.forEach((c, ci) => {
    if (life) {
      ctx.save();
      const rot = [-0.07, 0.05, -0.04, 0.06][ci % 4];
      ctx.translate(cxs + c.w / 2, chipY + 34);
      ctx.rotate(rot);
      ctx.translate(-(cxs + c.w / 2), -(chipY + 34));
      if (c.fill) {
        ctx.fillStyle = "#fff";
        shareRounded(ctx, cxs - 5, chipY - 5, c.w + 10, 78, 39);
        ctx.fill();
      }
    }
    if (c.fill) {
      ctx.fillStyle = c.fill;
      shareRounded(ctx, cxs, chipY, c.w, 68, 34);
      ctx.fill();
    } else {
      ctx.strokeStyle = life ? "rgba(255,255,255,.5)" : "rgba(30,42,34,.2)";
      ctx.lineWidth = 2;
      shareRounded(ctx, cxs + 1, chipY + 1, c.w - 2, 66, 33);
      ctx.stroke();
    }
    ctx.fillStyle = c.color;
    ctx.font = "700 32px " + F;
    ctx.textBaseline = "middle";
    ctx.fillText(c.label, cxs + 32, chipY + 36);
    ctx.textBaseline = "alphabetic";
    if (life) ctx.restore();
    cxs += c.w + 16;
  });
  ctx.fillStyle = soft;
  ctx.font = "500 30px " + F;
  ctx.textAlign = "left";
  ctx.fillText("읽고 본 것을 숲으로", 72, H - 72);
  ctx.textAlign = "right";
  ctx.fillStyle = fg;
  ctx.font = "800 32px " + L;
  ctx.fillText(APP_BRAND.en, W - 72, H - 72);
  ctx.textAlign = "left";
  return canvas;
}

// Year and month cards: white page; the original header (title, big number and 그루를 심었어요 on the
// left, 책/영화 stickers stacked on the right), then the forest with a strip of washi tape, a couple of
// sparkles and stickers slapped on around it.
let shareDecor = "visitor";

async function shareDecorate(ctx, W, tx, ty, bandTop, bandH, story) {
  const d = shareDecor,
    sticker = (img, x, y, size, rot) => {
      if (!img) return;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
      ctx.restore();
    };
  if (d === "visitor") {
    // a forest friend peeking from the island's corner
    const pick = FOREST_VISITORS.filter((v) => collectionState().visitorsSeen.includes(v.id)),
      v = (pick.at(-1) || FOREST_VISITORS[0]).id;
    sticker(
      await shareAsset("./assets/images/forest/sticker/visitor-" + v + ".webp"),
      tx + 10,
      ty - 30,
      story ? 190 : 170,
      -0.12,
    );
  } else if (d === "leaves") {
    // a few falling leaves in the app's colours
    const leaf = (x, y, r, rot, c) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.quadraticCurveTo(r * 0.8, 0, 0, r);
      ctx.quadraticCurveTo(-r * 0.8, 0, 0, -r);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.8);
      ctx.lineTo(0, r * 0.8);
      ctx.stroke();
      ctx.restore();
    };
    [
      [110, bandTop + 30, 26, 0.6, "#6CC092"],
      [180, bandTop - 30, 18, -0.4, "#F2B84B"],
      [W - 120, bandTop + bandH * 0.45, 22, 0.9, "#E85A47"],
      [W * 0.5 + 250, bandTop - 40, 16, -0.8, "#6CC092"],
      [140, bandTop + bandH * 0.55, 16, 1.2, "#F2B84B"],
    ].forEach((a) => leaf(...a));
  } else if (d === "doodle") {
    // hand-drawn heart and swirl next to the forest
    ctx.save();
    ctx.strokeStyle = "#E85A47";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const hx = 130,
      hy = bandTop + 40,
      r = 34;
    ctx.beginPath();
    ctx.moveTo(hx, hy + r * 0.9);
    ctx.bezierCurveTo(hx - r * 1.6, hy - r * 0.2, hx - r * 0.6, hy - r * 1.3, hx, hy - r * 0.4);
    ctx.bezierCurveTo(hx + r * 0.6, hy - r * 1.3, hx + r * 1.6, hy - r * 0.2, hx, hy + r * 0.9);
    ctx.stroke();
    ctx.strokeStyle = "#6CC092";
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 3; a += 0.2) {
      const rr = 6 + a * 7;
      ctx.lineTo(W - 150 + Math.cos(a) * rr, bandTop + bandH * 0.42 + Math.sin(a) * rr);
    }
    ctx.stroke();
    ctx.restore();
  } else if (d === "badge") {
    // round "MY FOREST" sticker badge on the island corner
    ctx.save();
    ctx.translate(tx + 20, ty - 20);
    ctx.rotate(-0.18);
    ctx.shadowColor = "rgba(30,42,34,.18)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(0, 0, 78, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = "#CBE4FF";
    ctx.beginPath();
    ctx.arc(0, 0, 68, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1E2A22";
    ctx.textAlign = "center";
    ctx.font = "800 26px Archivo,sans-serif";
    ctx.fillText("MY", 0, -6);
    ctx.fillText("FOREST", 0, 24);
    ctx.textAlign = "left";
    ctx.restore();
  }
}

async function drawStickerCard(ctx, canvas, W, H, story, name, F, L, kind) {
  const isYear = kind === "year",
    items = isYear ? yearForestItems(year, "all") : forestMonthItems(month),
    done = items.filter((x) => x.completed),
    books = done.filter((x) => x.type === "book").length,
    films = done.filter((x) => x.type === "movie").length,
    m = Number(month.slice(5));
  const ink = "#1E2A22",
    soft = "rgba(30,42,34,.55)",
    muted = "#52524F",
    months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = ink;
  ctx.font = "700 30px " + L;
  ctx.letterSpacing = "4px";
  ctx.textAlign = "left";
  ctx.fillText("GREW", 72, 96);
  ctx.textAlign = "right";
  ctx.fillText(isYear ? year + " FOREST" : months[m - 1] + " " + month.slice(0, 4), W - 72, 96);
  ctx.letterSpacing = "0px";
  ctx.textAlign = "left";
  const top = story ? 248 : 200;
  ctx.fillStyle = ink;
  ctx.font = "700 46px " + F;
  ctx.fillText(
    shareFitTitle(ctx, name, "의 " + (isYear ? "올해" : m + "월") + " 숲", W - 144 - 340),
    72,
    top,
  );
  ctx.font = "800 " + (story ? 300 : 250) + "px " + L;
  ctx.fillText(String(done.length), 60, top + (story ? 290 : 240));
  ctx.font = "700 56px " + F;
  ctx.fillText("그루를 심었어요", 72, top + (story ? 390 : 330));
  sharePill(ctx, "책 ", W - 72, top - 30, {
    fill: "#F7E7A1",
    size: 34,
    bold: books + "권",
    boldSize: 48,
    rotate: -6,
    align: "right",
  });
  sharePill(ctx, "영화 ", W - 112, top + 90, {
    fill: "#BFE7CB",
    size: 34,
    bold: films + "편",
    boldSize: 48,
    rotate: 5,
    align: "right",
  });
  const bandTop = top + (story ? 440 : 400),
    bandH = story ? 980 : 560;
  let tx = W * 0.2,
    ty = bandTop + bandH * 0.3;
  if (isYear) {
    const scale = Math.min((W - 80) / 390, bandH / 250),
      oy = bandTop + (bandH - 250 * scale) / 2,
      ox = (W - 390 * scale) / 2;
    await shareIsland(ctx, oy, ox, scale, items);
    const N = Math.max(2, Math.ceil(Math.sqrt(items.length))),
      BW = Math.min(170, 95 + N * 9),
      y0 = 46 + (170 - BW) / 2;
    tx = ox + (195 - BW * 0.92) * scale;
    ty = oy + (y0 + BW / 2 - 8) * scale;
  } else {
    try {
      const board = items.map((x) => ({ ...x, forestTile: "" })),
        svg = await inlineSvgImages(
          shareCropSVG(
            selfContainedForestSVG(
              forestSVG(board, "basic", false, { preview: true, transient: true, grid: "month" }),
            ),
          ),
        ),
        url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      try {
        const img = await loadImage(url),
          iw = img.naturalWidth || 720,
          ih = img.naturalHeight || 540,
          sc = Math.min((W + 60) / iw, bandH / ih);
        const ix = (W - iw * sc) / 2,
          iy = bandTop + (bandH - ih * sc) / 2;
        ctx.drawImage(img, ix, iy, iw * sc, ih * sc);
        tx = ix + iw * sc * 0.12;
        ty = iy + ih * sc * 0.4;
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch {}
  }
  // decoration around the island (shareDecor): sparkles always, plus one extra touch
  const spark = (x, y, r, c) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = c;
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4,
        rr = k % 2 ? r * 0.3 : r;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
  spark(W - 150, bandTop - 10, 20, "#F2B84B");
  spark(W - 210, bandTop + 50, 13, "#E85A47");
  {
    ctx.save();
    ctx.translate(190, bandTop + (story ? 50 : 20));
    ctx.rotate(-0.2);
    ctx.fillStyle = "#6CC092";
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = (k * Math.PI) / 5 - Math.PI / 2,
        q = k % 2 ? 8 : 19;
      ctx.lineTo(Math.cos(a) * q, Math.sin(a) * q);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  await shareDecorate(ctx, W, tx, ty, bandTop, bandH, story);
  const rated = done.filter((x) => validRating(x.rating)),
    avg = rated.length ? (rated.reduce((n, x) => n + Number(x.rating), 0) / rated.length).toFixed(1) : "";
  if (avg)
    sharePill(ctx, "★ " + avg + "  평균 별점", W - 72, bandTop + bandH - (story ? 152 : 120), {
      fill: "#E85A47",
      color: "#fff",
      size: 34,
      rotate: 6,
      align: "right",
    });
  if (isYear) {
    const byMonth = Array.from(
        { length: 12 },
        (_, i) => done.filter((x) => x.completed.slice(5, 7) === String(i + 1).padStart(2, "0")).length,
      ),
      best = byMonth.indexOf(Math.max(...byMonth));
    if (done.length)
      sharePill(ctx, "제일 울창한 달 ", 72, bandTop + bandH - (story ? 40 : 48), {
        size: 30,
        bold: best + 1 + "월 · " + byMonth[best] + "그루",
        boldSize: 40,
        rotate: -4,
      });
  } else {
    const days = new Set(
      state.items.flatMap((x) => x.logs.map((l) => l.date)).filter((d) => d.startsWith(month)),
    ).size;
    if (!days) {
      const cnt = {};
      done.forEach((x) => {
        const g = cleanGenreValue(x.genre) ? launchGenre(x.type, x.genre, x) : "";
        if (g && g !== "기타") cnt[g] = (cnt[g] || 0) + 1;
      });
      const top = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
      if (top)
        sharePill(ctx, "이달의 장르 ", 72, bandTop + bandH - (story ? 64 : 32), {
          fill: "#CBE4FF",
          size: 30,
          bold: top[0],
          boldSize: 42,
          rotate: -5,
        });
    } else
      sharePill(ctx, "기록한 날 ", 72, bandTop + bandH - (story ? 64 : 32), {
        fill: "#1E2A22",
        color: "#fff",
        size: 32,
        bold: days + "일",
        boldSize: 44,
        rotate: -5,
      });
  }
  ctx.fillStyle = muted;
  ctx.font = "500 30px " + F;
  ctx.textAlign = "left";
  ctx.fillText("읽고 본 것을 숲으로", 72, H - 72);
  ctx.textAlign = "right";
  ctx.fillStyle = ink;
  ctx.font = "800 32px " + L;
  ctx.fillText(APP_BRAND.en, W - 72, H - 72);
  ctx.textAlign = "left";
  return canvas;
}

// Crop the scene to the board itself so a small month forest still fills the card.
function shareCropSVG(markup) {
  const host = document.createElement("div");
  host.style.cssText = "position:absolute;left:-9999px;top:0;width:720px;height:540px;visibility:hidden";
  host.innerHTML = markup;
  document.body.appendChild(host);
  try {
    const svg = host.querySelector("svg"),
      world = svg?.querySelector("#forest-world") || svg;
    const b = world.getBBox(),
      pad = 16;
    if (b.width && b.height)
      return markup.replace(
        /viewBox="[^"]*"/,
        'viewBox="' +
          [b.x - pad, b.y - pad, b.width + pad * 2, b.height + pad * 2].map((n) => n.toFixed(1)).join(" ") +
          '"',
      );
  } catch {
  } finally {
    host.remove();
  }
  return markup;
}

function shareTitle() {
  return shareKind === "month"
    ? Number(month.slice(5)) + "월의 숲 공유"
    : forestLifetime
      ? forestLifetimeName() + " 공유"
      : "올해의 숲 공유";
}

async function makeShare(kind = shareKind, target = shareTarget) {
  shareKind = kind === "forest" ? "year" : kind;
  shareTarget = target || "";
  const generation = ++shareGeneration,
    current = () => generation === shareGeneration && modal === "share";
  shareRevision = shareSnapshot();
  shareBlob = null;
  const formats =
    '<div class="share-formats" role="group" aria-label="이미지 형식">' +
    [
      ["story", "스토리", "9:16"],
      ["feed", "피드", "4:5"],
    ]
      .map(([id, l, r]) =>
        button(
          '<i class="share-format-icon is-' +
            id +
            '" aria-hidden="true"></i><span><strong>' +
            l +
            "</strong><small>" +
            r +
            "</small></span>",
          "shareFormat",
          shareFormat === id ? "active" : "",
          'data-format="' + id + '" aria-pressed="' + (shareFormat === id) + '"',
        ),
      )
      .join("") +
    "</div>";
  const actions =
    '<div class="share-actions">' +
    button(
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/></svg>이미지 저장',
      "saveImage",
      "share-save",
    ) +
    button(
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3m-5 5 5-5 5 5"/><path d="M5 12v8h14v-8"/></svg>공유하기',
      "nativeShare",
      "share-go",
    ) +
    "</div>";
  showModal(
    shareTitle(),
    '<div class="share-preview is-' +
      shareFormat +
      '"><p class="muted">이미지를 준비하고 있어요…</p></div>' +
      formats +
      actions,
    "share",
  );
  try {
    const canvas = await drawShareCard(shareKind, shareFormat, shareTarget);
    if (!current()) return;
    const blob = await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(Error())), "image/png"),
    );
    if (!current()) return;
    shareBlob = blob;
    if (shareURL) URL.revokeObjectURL(shareURL);
    shareURL = URL.createObjectURL(shareBlob);
    const box = document.querySelector(".share-preview");
    if (box) box.innerHTML = '<img src="' + shareURL + '" alt="' + esc(shareTitle()) + ' 이미지">';
  } catch (e) {
    const box = document.querySelector(".share-preview");
    if (current() && box)
      box.innerHTML =
        '<p class="muted">이미지를 만들지 못했어요.</p>' + button("다시 시도", "retryShare", "textbtn");
  }
}

function shareFileName() {
  return "grew-" + (shareKind === "year" ? year : month) + "-" + shareFormat + ".png";
}

function shareFresh() {
  return shareRevision === shareSnapshot();
}

async function nativeShare() {
  if (!shareFresh()) {
    await makeShare(shareKind);
    toast("최신 기록으로 이미지를 갱신했어요.");
    return;
  }
  if (!shareBlob) return;
  const file = new File([shareBlob], shareFileName(), { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "나의 " + APP_BRAND.ko });
    } catch (e) {
      if (e.name !== "AbortError") toast("공유하지 못했어요. 이미지 저장을 이용해주세요.");
    }
  } else toast("이 브라우저에서는 이미지 저장 후 공유해주세요.");
}
