/*
 * 숲 보드 배치: 격자, 나무 자리, 장식, 바닥(POLY_FLOORS), 숲 SVG 만들기.
 */

const FOREST_GRID_SIZE = 25;

const FOREST_VISIBLE_LIMIT = 300;

const FOREST_EXPANSION_STAGES = [
  { id: 0, label: "빈 터", maxTrees: 0, cols: 3, rows: 3, boardW: 150, boardH: 84, treeScale: 0.72 },
  { id: 1, label: "첫 터", maxTrees: 5, cols: 4, rows: 4, boardW: 220, boardH: 124, treeScale: 0.66 },
  { id: 2, label: "작은 숲", maxTrees: 15, cols: 7, rows: 7, boardW: 310, boardH: 174, treeScale: 0.57 },
  { id: 3, label: "첫 숲", maxTrees: 40, cols: 10, rows: 10, boardW: 410, boardH: 228, treeScale: 0.49 },
  { id: 4, label: "자라는 숲", maxTrees: 80, cols: 13, rows: 13, boardW: 500, boardH: 278, treeScale: 0.43 },
  {
    id: 5,
    label: "깊어지는 숲",
    maxTrees: 140,
    cols: 17,
    rows: 17,
    boardW: 575,
    boardH: 320,
    treeScale: 0.38,
  },
  { id: 6, label: "깊은 숲", maxTrees: 200, cols: 20, rows: 20, boardW: 625, boardH: 348, treeScale: 0.35 },
  { id: 7, label: "넓은 숲", maxTrees: 300, cols: 23, rows: 23, boardW: 620, boardH: 370, treeScale: 0.32 },
];

// A month is one 4x4 plot (design 11a): one tree per cell, and the plot grows by a row
// only when a month holds more than it can fit.
// The month board fits its trees: the smallest square that holds them all (2×2 at least).
function forestMonthConfig(n, minCols = 2) {
  const cols = Math.max(minCols, Math.ceil(Math.sqrt(Math.max(0, n || 0))));
  return {
    id: "month" + cols,
    label: "",
    tier: 1,
    month: true,
    cols,
    rows: cols,
    boardW: 56 * cols,
    boardH: 31.5 * cols,
    treeScale: +(0.8 * Math.pow(4 / cols, 0.3)).toFixed(3),
    maxTrees: cols * cols,
    capacity: cols * cols,
    nextExpandAt: null,
    remainingToExpand: 0,
  };
}

function forestBoardConfig(n, grid, minCols) {
  return grid === "month" ? forestMonthConfig(n, minCols) : forestLayoutConfig(n);
}

function forestLayoutConfig(n) {
  const count = Math.max(0, n || 0);
  let idx = FOREST_EXPANSION_STAGES.findIndex((s) => count <= s.maxTrees);
  if (idx < 0) idx = FOREST_EXPANSION_STAGES.length - 1;
  const stage = FOREST_EXPANSION_STAGES[idx],
    next = FOREST_EXPANSION_STAGES[idx + 1] || null;
  const nextExpandAt = next ? stage.maxTrees + 1 : null;
  return {
    ...stage,
    tier: idx,
    capacity: stage.cols * stage.rows,
    nextExpandAt,
    remainingToExpand: next ? Math.max(0, nextExpandAt - count) : 0,
  };
}

function forestStageOrigin(cfg) {
  return {
    x: Math.floor((FOREST_GRID_SIZE - cfg.cols) / 2),
    y: Math.floor((FOREST_GRID_SIZE - cfg.rows) / 2),
  };
}

function forestFeatureKeys(cfg) {
  const anchors = [];
  if (cfg.tier >= 2) anchors.push("10,9");
  if (cfg.tier >= 3) anchors.push("8,13", "13,15", "14,8", "7,10", "12,8", "9,15");
  if (cfg.tier >= 4) anchors.push("15,10", "16,10", "15,11", "16,11", "16,13");
  if (cfg.tier >= 5) anchors.push("7,16", "17,14", "9,17", "11,17");
  // Keep a one-tile breathing space around landmarks. Previously only the exact
  // decoration tile was reserved, so neighbouring crowns could hide every prop.
  const origin = forestStageOrigin(cfg),
    inside = (x, y) => x >= origin.x && x < origin.x + cfg.cols && y >= origin.y && y < origin.y + cfg.rows;
  const keys = new Set();
  anchors.forEach((key) => {
    const [x, y] = key.split(",").map(Number);
    [
      [0, 0],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].forEach(([dx, dy]) => {
      if (inside(x + dx, y + dy)) keys.add(x + dx + "," + (y + dy));
    });
  });
  return keys;
}

function parseForestTile(v) {
  if (!v) return null;
  const raw = typeof v === "string" ? v.replace(/^g:/, "") : "";
  const m = raw.match(/^(\d+),(\d+)$/);
  if (!m) return null;
  const gx = Number(m[1]),
    gy = Number(m[2]);
  if (
    !Number.isInteger(gx) ||
    !Number.isInteger(gy) ||
    gx < 0 ||
    gy < 0 ||
    gx >= FOREST_GRID_SIZE ||
    gy >= FOREST_GRID_SIZE
  )
    return null;
  return { gx, gy, key: gx + "," + gy };
}

const forestPlacementCache = new Map();

function forestPlacements(items, cfg) {
  if (!items.length) return { placements: [], emptySlots: [], featureSlots: [], changed: false };
  const origin = forestStageOrigin(cfg),
    unit = (k) => (hash("forest-grid-v6|" + k) % 1000000) / 1000000;
  const slots = [];
  for (let r = 0; r < cfg.rows; r++)
    for (let c = 0; c < cfg.cols; c++) {
      const gx = origin.x + c,
        gy = origin.y + r,
        key = gx + "," + gy;
      const edge = Math.min(c, cfg.cols - 1 - c, r, cfg.rows - 1 - r);
      const centerDX = c - (cfg.cols - 1) / 2,
        centerDY = r - (cfg.rows - 1) / 2;
      const jitterX = (unit(key + "|jx") - 0.5) * 0.32,
        jitterY = (unit(key + "|jy") - 0.5) * 0.32;
      slots.push({
        gx,
        gy,
        key,
        c,
        r,
        edge,
        centerDist: Math.hypot(centerDX, centerDY),
        rx: c - r + jitterX,
        ry: c + r + jitterY,
      });
    }
  const slotMap = new Map(slots.map((s) => [s.key, s])),
    featureKeys = forestFeatureKeys(cfg);
  const featureSlots = slots.filter((s) => featureKeys.has(s.key)),
    treeSlots = slots.filter((s) => !featureKeys.has(s.key));
  // Saved tiles belong to records; changing their appearance must not reassign them.
  const placementKey = () =>
    JSON.stringify(["fixed-v3", cfg.id, items.map((c) => [c.id, c.completedAt, c.forestTile || ""])]);
  const cached = forestPlacementCache.get(placementKey());
  if (cached) {
    const byId = new Map(items.map((c) => [c.id, c]));
    let changed = false;
    const placements = cached.map((p) => {
        const item = byId.get(p.id),
          profile = treeVisualProfile(item),
          sizeVar = item.hiddenTree ? 1 : treeSizeVariance(item);
        if (item.forestTile !== "g:" + p.slot.key) {
          item.forestTile = "g:" + p.slot.key;
          changed = true;
        }
        return { ...p, item, profile, sizeVar, scale: cfg.treeScale * profile.scaleBias * sizeVar };
      }),
      used = new Set(placements.map((p) => p.slot.key));
    return {
      placements,
      emptySlots: treeSlots.filter((s) => !used.has(s.key)),
      featureSlots: featureSlots.filter((s) => !used.has(s.key)),
      changed,
    };
  }
  const taken = new Set(),
    placements = [];
  let changed = false;
  const distances = new Map(
    treeSlots.map((slot) => [slot.key, { any: 99, species: new Map(), shape: new Map() }]),
  );
  const ordered = [...items].sort(
    (a, b) => forestItemOrder(a) - forestItemOrder(b) || a.id.localeCompare(b.id),
  );
  const add = (item, slot) => {
    const profile = treeVisualProfile(item),
      sizeVar = item && item.hiddenTree ? 1 : treeSizeVariance(item);
    placements.push({ item, slot, profile, scale: cfg.treeScale * profile.scaleBias * sizeVar, sizeVar });
    taken.add(slot.key);
    for (const target of treeSlots) {
      const entry = distances.get(target.key),
        d = Math.hypot(slot.gx - target.gx, slot.gy - target.gy);
      entry.any = Math.min(entry.any, d);
      entry.species.set(profile.species.id, Math.min(entry.species.get(profile.species.id) ?? 99, d));
      entry.shape.set(profile.shape, Math.min(entry.shape.get(profile.shape) ?? 99, d));
    }
  };
  // Score the projected crown footprint rather than distance on the diagonal grid.
  // Use the larger winter silhouette for hidden trees so changing themes keeps positions.
  const crown = (item, slot, profile, sizeVar) => {
    const scale =
      cfg.treeScale *
      profile.scaleBias *
      sizeVar *
      (item.hiddenTree ? hiddenTreeScale(item.hiddenTree, "snow") : 1);
    return {
      x: (slot.rx * cfg.boardW) / (2 * Math.max(1, cfg.cols - 1)),
      y: (slot.ry * cfg.boardH) / (2 * Math.max(1, cfg.rows - 1)) - 43 * scale,
      rx: (profile.radius + 3) * scale * 0.94 + 1.5,
      ry: 40 * scale * 0.94 + 1.5,
    };
  };
  const crownBins = new Map(),
    binSize = 32;
  const binsFor = (b) => {
    const keys = [];
    for (let x = Math.floor((b.x - b.rx) / binSize); x <= Math.floor((b.x + b.rx) / binSize); x++)
      for (let y = Math.floor((b.y - b.ry) / binSize); y <= Math.floor((b.y + b.ry) / binSize); y++)
        keys.push(x + "," + y);
    return keys;
  };
  const rememberCrown = (b) => {
    for (const key of binsFor(b)) {
      if (!crownBins.has(key)) crownBins.set(key, []);
      crownBins.get(key).push(b);
    }
  };
  const crownOverlap = (box) => {
    let sum = 0;
    const nearby = new Set();
    for (const key of binsFor(box)) for (const b of crownBins.get(key) || []) nearby.add(b);
    for (const b of nearby) {
      const dx = (box.x - b.x) / (box.rx + b.rx),
        dy = (box.y - b.y) / (box.ry + b.ry),
        penetration = 1 - dx * dx - dy * dy;
      if (penetration > 0) sum += penetration * Math.min(box.rx * box.ry, b.rx * b.ry);
    }
    return sum;
  };
  // Reserve every valid existing tile first, even when its record sorts after a new one.
  // Legacy unprefixed tiles remain supported; old landmark tiles keep their tree.
  ordered.forEach((item) => {
    const saved = parseForestTile(item.forestTile),
      slot = saved && slotMap.get(saved.key);
    if (!slot || taken.has(slot.key)) return;
    const tile = "g:" + slot.key;
    if (item.forestTile !== tile) {
      item.forestTile = tile;
      changed = true;
    }
    add(item, slot);
    const placed = placements[placements.length - 1];
    rememberCrown(crown(item, slot, placed.profile, placed.sizeVar));
  });
  ordered.forEach((item) => {
    if (placements.some((p) => p.item === item)) return;
    const profile = treeVisualProfile(item),
      sizeVar = item && item.hiddenTree ? 1 : treeSizeVariance(item),
      available = treeSlots.filter((s) => !taken.has(s.key));
    let best = available[0],
      bestScore = -Infinity,
      bestOverlap = Infinity;
    available.forEach((slot) => {
      const nearest = distances.get(slot.key),
        minAny = nearest.any,
        minSame = nearest.species.get(profile.species.id) ?? 99,
        minShape = nearest.shape.get(profile.shape) ?? 99;
      const tooClose = minAny < 1.35 ? -140 : 0;
      const score =
        tooClose +
        Math.min(minAny, 6) * 9.2 +
        Math.min(minSame, 7) * 4.1 +
        Math.min(minShape, 5) * 2.2 +
        Math.min(slot.edge, 5) * 0.9 +
        slot.centerDist * 0.24 +
        unit(item.id + "|" + slot.key + "|assign") * 0.8;
      const box = crown(item, slot, profile, sizeVar);
      const overlap = crownOverlap(box);
      if (overlap < bestOverlap - 0.01 || (Math.abs(overlap - bestOverlap) <= 0.01 && score > bestScore)) {
        best = slot;
        bestScore = score;
        bestOverlap = overlap;
      }
    });
    if (best) {
      const tile = "g:" + best.key;
      if (item.forestTile !== tile) {
        item.forestTile = tile;
        changed = true;
      }
      add(item, best);
      rememberCrown(crown(item, best, profile, sizeVar));
    }
  });
  if (forestPlacementCache.size >= 8) forestPlacementCache.delete(forestPlacementCache.keys().next().value);
  forestPlacementCache.set(
    placementKey(),
    placements.map(({ item, ...p }) => ({ ...p, id: item.id })),
  );
  return {
    placements,
    emptySlots: treeSlots.filter((s) => !taken.has(s.key)),
    featureSlots: featureSlots.filter((s) => !taken.has(s.key)),
    changed,
  };
}

const forestArtBoundsCache = new Map();

function forestTreeObstacles(points, cfg, theme) {
  const ns = "http://www.w3.org/2000/svg",
    svg = document.createElementNS(ns, "svg"),
    g = document.createElementNS(ns, "g");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.style.cssText = "position:absolute;visibility:hidden;pointer-events:none";
  svg.appendChild(g);
  document.body.appendChild(svg);
  try {
    return points.map((p) => {
      const art = treeArt(p.c, theme),
        illustration = illustratedTreeAsset(p.c, theme);
      let b = illustration?.bounds || forestArtBoundsCache.get(art);
      if (!b) {
        g.innerHTML = art;
        const r = g.getBBox();
        b =
          r.width && r.height
            ? { x: r.x - 2, y: r.y - 3, width: r.width + 4, height: r.height + 6 }
            : { x: -65, y: -125, width: 130, height: 145 };
        if (forestArtBoundsCache.size > 100) forestArtBoundsCache.clear();
        forestArtBoundsCache.set(art, b);
      }
      const z = (p.scale || cfg.treeScale) * (p.c?.hiddenTree ? hiddenTreeScale(p.c.hiddenTree, theme) : 1);
      return {
        left: p.x + b.x * z,
        right: p.x + (b.x + b.width) * z,
        top: p.y + b.y * z,
        bottom: p.y + (b.y + b.height) * z,
        depth: p.y,
        rootX: p.x,
        rootRadius: Math.max(4, 9 * z),
      };
    });
  } finally {
    svg.remove();
  }
}

function forestDecorationPosition(preferred, candidates, extent, blocked, cfg, treeBoxes = []) {
  const rx = cfg.boardW / 2 + 44,
    ry = cfg.boardH / 2 + 34;
  const clear = (p) => {
    const b = {
      left: p.x + extent[0],
      top: p.y + extent[1],
      right: p.x + extent[2],
      bottom: p.y + extent[3],
    };
    if (
      ![
        [b.left, b.top],
        [b.right, b.top],
        [b.left, b.bottom],
        [b.right, b.bottom],
      ].every(([x, y]) => Math.abs(x - 360) / rx + Math.abs(y - 286) / ry < 0.98)
    )
      return false;
    // Do not let props intersect the trunk/root, even when the prop is in front.
    if (
      treeBoxes.some((t) => {
        const x = t.rootX ?? (t.left + t.right) / 2,
          r = t.rootRadius ?? 5;
        return b.left < x + r + 3 && b.right > x - r - 3 && b.top < t.depth + 10 && b.bottom > t.depth - 13;
      })
    )
      return false;
    return !blocked.some(
      (q) => b.left < q.right + 4 && b.right > q.left - 4 && b.top < q.bottom + 4 && b.bottom > q.top - 4,
    );
  };
  const local = [];
  for (let dx = -48; dx <= 48; dx += 12)
    for (let dy = -36; dy <= 36; dy += 12) local.push({ x: preferred.x + dx, y: preferred.y + dy });
  const score = (p) => {
    const b = {
      left: p.x + extent[0],
      right: p.x + extent[2],
      top: p.y + extent[1],
      bottom: p.y + extent[3],
    };
    // Partial overlap is welcome; heavy occlusion moves a landmark, never deletes it.
    const area = (b.right - b.left) * (b.bottom - b.top);
    let occlusion = 0;
    for (const t of treeBoxes) {
      const overlap =
        (Math.max(0, Math.min(b.right, t.right) - Math.max(b.left, t.left)) *
          Math.max(0, Math.min(b.bottom, t.bottom) - Math.max(b.top, t.top))) /
        area;
      occlusion += Math.max(0, overlap - 0.12);
    }
    return (p.x - preferred.x) ** 2 + (p.y - preferred.y) ** 2 + occlusion * 18000;
  };
  let valid = [preferred, ...local, ...candidates].filter(clear);
  // Search the whole ground before abandoning a landmark in a dense forest.
  if (!valid.length)
    for (let y = 286 - ry + 12; y < 286 + ry; y += 8)
      for (let x = 360 - rx + 12; x < 360 + rx; x += 8) {
        const p = { x, y };
        if (clear(p)) valid.push(p);
      }
  return valid.sort((a, b) => score(a) - score(b))[0] || null;
}

function forestDecorations(
  cfg,
  project,
  theme = "basic",
  emptySlots = [],
  featureSlots = [],
  treeBoxes = [],
  floorId = "basic",
) {
  const pieces = [],
    featureMap = new Map(featureSlots.map((s) => [s.key, s]));
  let illustratedFlowerIndex = 0;
  const at = (key) => {
    const s = featureMap.get(key);
    return s ? project(s) : null;
  };
  // Decorations are allowed to overlap foliage. Treating the full tree crown as
  // blocked made every landmark disappear in a mature forest.
  const blocked = [],
    candidates = [...featureSlots, ...emptySlots].map(project);
  // Perimeter candidates preserve a few visible details even in dense forests.
  for (let i = 0; i < 64; i++) {
    const t = (i / 64) * 4,
      side = Math.floor(t),
      f = t - side,
      verts = [
        [360, 286 - cfg.boardH / 2 - 22],
        [360 + cfg.boardW / 2 + 28, 286],
        [360, 286 + cfg.boardH / 2 + 22],
        [360 - cfg.boardW / 2 - 28, 286],
      ],
      a = verts[side],
      b = verts[(side + 1) % 4];
    candidates.push({ x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f });
  }
  const place = (kind, draw, preferred, extent) => {
    const decorScale = kind === "flower" || kind === "snow-flowers" ? 0.564 : 0.54;
    extent = extent.map((v) => v * decorScale);
    const p = forestDecorationPosition(preferred, candidates, extent, blocked, cfg, treeBoxes);
    if (!p) return;
    blocked.push({
      left: p.x + extent[0],
      top: p.y + extent[1],
      right: p.x + extent[2],
      bottom: p.y + extent[3],
    });
    const assetId =
      "decor-" +
      (kind === "flower"
        ? ["flower-lilac", "flower-peach", "flower-cream"][illustratedFlowerIndex++ % 3]
        : kind === "snow-flowers"
          ? ["snow-flower-lilac", "snow-flower-gold"][illustratedFlowerIndex++ % 2]
          : kind);
    const art = SONGLIM_FOREST_ASSETS[assetId] ? illustratedForestDecoration(assetId) : draw(0, 0);
    pieces.push({
      y: p.y,
      art:
        '<g data-decoration="' +
        kind +
        '" data-depth="' +
        p.y.toFixed(1) +
        '" pointer-events="none" transform="translate(' +
        p.x.toFixed(1) +
        " " +
        p.y.toFixed(1) +
        ") scale(" +
        decorScale +
        ')">' +
        art +
        "</g>",
    });
  };

  const rock = (x, y, s = 1) =>
    '<g transform="translate(' +
    x +
    " " +
    y +
    ") scale(" +
    s +
    ')"><ellipse cy="8" rx="17" ry="4" fill="#53675C" opacity=".12"/><path d="M-16 3L-11-9 2-15 14-7 17 5 5 10-10 8Z" fill="#8D9991"/><path d="M-16 3L-11-9 2-15 1-2-10 8Z" fill="#A8B2A7"/><path d="M2-15L14-7 1-2Z" fill="#BEC5B7"/><path d="M1-2L14-7 17 5 5 10Z" fill="#78877F"/></g>';
  const stump = (x, y, s = 1) =>
    '<g transform="translate(' +
    x +
    " " +
    y +
    ") scale(" +
    s +
    ')" opacity=".84"><ellipse cy="7" rx="11" ry="3.2" fill="#6F8177" opacity=".12"/><path d="M-6-8L-7 4Q0 9 7 4L6-8Z" fill="#8B6B53"/><ellipse cy="-8" rx="6" ry="3" fill="#B9906A"/><ellipse cy="-8" rx="3" ry="1.4" fill="none" stroke="#8D6C52" stroke-width=".9"/></g>';
  const branch = (x, y, s = 1) =>
    '<g transform="translate(' +
    x +
    " " +
    y +
    ") scale(" +
    s +
    ')" opacity=".76"><path d="M-15 4Q-4-3 11-1M1-2L8-9M-7 1L-12-6" fill="none" stroke="#806750" stroke-width="3" stroke-linecap="round"/><ellipse cx="9" cy="-8" rx="4" ry="2.2" fill="#839B6D" transform="rotate(-22 9 -8)"/></g>';
  const grass = (x, y, s = 1) =>
    '<g transform="translate(' +
    x +
    " " +
    y +
    ") scale(" +
    s +
    ')" opacity=".7"><path d="M0 5Q-1-5-6-11M0 5Q1-7 1-13M0 5Q4-4 8-9M0 5Q-6-2-10-4" fill="none" stroke="#78956E" stroke-width="2" stroke-linecap="round"/></g>';
  const flowerPatch = (x, y, s = 1, variant = 0, snow = false) => {
    const palettes = snow
      ? [
          ["#B09ABF", "#D5C7DF"],
          ["#CDB878", "#EEE0B5"],
        ]
      : [
          ["#CBBE8C", "#F1E9C9"],
          ["#B4A0BD", "#DBCDDF"],
          ["#C7A49B", "#E9D2C5"],
        ];
    const [petal, light] = palettes[variant % palettes.length],
      blooms =
        variant % 3 === 0
          ? [[0, 0]]
          : [
              [-5, 2],
              [6, -2],
            ];
    return (
      '<g data-flower-patch="' +
      (snow ? "snow" : "basic") +
      '" transform="translate(' +
      x +
      " " +
      y +
      ") scale(" +
      s +
      ')"><ellipse cy="9" rx="14" ry="3.5" fill="' +
      (snow ? "#91A8AF" : "#617A56") +
      '" opacity=".12"/>' +
      (snow ? '<path d="M-14 8L-7 5 4 6 12 4 16 8 7 11-8 11Z" fill="#F8FBFC"/>' : "") +
      blooms
        .map(
          ([a, b], i) =>
            '<g data-bloom="' +
            i +
            '" transform="translate(' +
            a +
            " " +
            b +
            ')"><path d="M0 8L0-2" fill="none" stroke="#6E8160" stroke-width="1.5" stroke-linecap="round"/><path d="M0 6L-5 5-7 1-3 2ZM0 8L5 6 7 2 3 3Z" fill="' +
            (snow ? "#849779" : "#8FA374") +
            '"/><path d="M0-2L-5-3-6-7-3-9 0-6 2-10 5-9 5-6 8-4 6-1 3-1 2 3-1 3-3 0Z" fill="' +
            petal +
            '"/><path d="M0-3L-3-7-1-8 1-5 3-8 4-6 2-3Z" fill="' +
            light +
            '"/><circle cx="1" cy="-3" r="1.55" fill="#D8BE70"/></g>',
        )
        .join("") +
      "</g>"
    );
  };
  const flowers = (x, y, s = 1, variant = 0) => flowerPatch(x, y, s, variant, false);
  const well = (x, y, s = 1) =>
    '<g transform="translate(' +
    x +
    " " +
    y +
    ") scale(" +
    s +
    ')" opacity=".98"><ellipse cy="12" rx="23" ry="6" fill="#52695C" opacity=".14"/><path d="M-18 2V10Q0 18 18 10V2Z" fill="#9B9182"/><ellipse cy="2" rx="18" ry="7" fill="#C1B8A8"/><ellipse cy="2" rx="12" ry="4.6" fill="#73AEC0"/><path d="M-17 4V-14M17 4V-14M-17-13Q0-29 17-13" fill="none" stroke="#745E49" stroke-width="3.2" stroke-linecap="round"/><path d="M-7-22H7M0-22V-10" stroke="#745E49" stroke-width="3" stroke-linecap="round"/><rect x="-4" y="-11" width="8" height="7" rx="2" fill="#A97851"/><path d="M-15 7L-8 10M8 10L15 7" stroke="#D2C9B9" stroke-width="1.2"/></g>';
  const pond = (x, y, s = 1) =>
    '<g transform="translate(' +
    x +
    " " +
    y +
    ") scale(" +
    s +
    ')" opacity=".96"><ellipse cy="8" rx="31" ry="10" fill="#678678" opacity=".08"/><path d="M-30 2Q-25-12-8-12Q5-18 23-8Q34 1 24 13Q9 19-8 15Q-27 16-30 2Z" fill="#8CC5D7"/><path d="M-16-3Q-5-9 7-4" fill="none" stroke="#DFF3F7" stroke-width="2.2" stroke-linecap="round"/><ellipse cx="-25" cy="7" rx="7" ry="2.5" fill="#9CB583" transform="rotate(-26 -25 7)"/><ellipse cx="25" cy="7" rx="7" ry="2.5" fill="#9CB583" transform="rotate(20 25 7)"/></g>';
  const snowRock = (x, y, s = 1) =>
    '<g transform="translate(' +
    x +
    " " +
    y +
    ") scale(" +
    s +
    ')"><ellipse cy="8" rx="17" ry="4" fill="#718891" opacity=".14"/><path d="M-16 3L-11-9 2-15 14-7 17 5 5 10-10 8Z" fill="#899AA0"/><path d="M-16 3L-11-9 2-15 1-2-10 8Z" fill="#A8B7BA"/><path d="M1-2L14-7 17 5 5 10Z" fill="#70858C"/><path d="M-12-7L2-16 14-8 9-4 3-6-2-2-7-5Z" fill="#F5FAFC"/><path d="M2-16L14-8 9-4 3-6Z" fill="#DAE7ED"/></g>';
  const snowBranch = (x, y, s = 1) =>
    '<g transform="translate(' +
    x +
    " " +
    y +
    ") scale(" +
    s +
    ')" opacity=".8"><path d="M-16 4Q-4-3 12-1M1-2L9-9M-8 1L-13-6" fill="none" stroke="#756B61" stroke-width="3" stroke-linecap="round"/><path d="M-12-1Q-2-6 8-4" fill="none" stroke="#F8FBFC" stroke-width="2.5" stroke-linecap="round"/></g>';
  const rabbitHole = (x, y, s = 1) =>
    '<g data-snow-decor="burrow" transform="translate(' +
    x +
    " " +
    y +
    ") scale(" +
    s +
    ')"><ellipse cy="9" rx="19" ry="6" fill="#879DA6" opacity=".20"/><path d="M-19 6Q-17-9 0-11Q17-9 19 6Q1 14-19 6Z" fill="#F8FBFC"/><path d="M-11 5Q-10-5 0-6Q10-5 11 5Q0 11-11 5Z" fill="#87918B"/><path d="M-8 5Q-7-2 0-3Q7-2 8 5Q0 9-8 5Z" fill="#535F5C"/><path d="M-13-1Q0-11 13-1" fill="none" stroke="#E5EFF2" stroke-width="3" stroke-linecap="round"/><ellipse cx="10" cy="13" rx="2" ry="1.1" fill="#879DA6" opacity=".45"/><ellipse cx="15" cy="17" rx="1.7" ry="1" fill="#879DA6" opacity=".32"/></g>';
  const frozenWell = (x, y, s = 1) =>
    '<g transform="translate(' +
    x +
    " " +
    y +
    ") scale(" +
    s +
    ')" opacity=".98"><ellipse cy="12" rx="22" ry="6" fill="#718791" opacity=".16"/><path d="M-17 2V10Q0 17 17 10V2Z" fill="#8C9899"/><ellipse cy="2" rx="17" ry="7" fill="#BAC7C9"/><ellipse cy="2" rx="11" ry="4.5" fill="#A9D3DE"/><path d="M-17 3V-13M17 3V-13M-17-12Q0-27 17-12" fill="none" stroke="#665F58" stroke-width="3" stroke-linecap="round"/><path d="M-9-19Q0-23 9-19" stroke="#FAFCFD" stroke-width="3.5" stroke-linecap="round"/><path d="M-11-1L-4 3 2-1 9 3" fill="none" stroke="#EAF7FA" stroke-width="1.4"/></g>';
  const snowSign = (x, y, s = 1) =>
    '<g transform="translate(' +
    x +
    " " +
    y +
    ") scale(" +
    s +
    ')" opacity=".96"><ellipse cy="9" rx="15" ry="4" fill="#78909A" opacity=".15"/><path d="M0 8V-25" stroke="#725E4C" stroke-width="3.4" stroke-linecap="round"/><path d="M-15-23H12L17-17 12-11H-15Z" fill="#9A7655"/><path d="M-10-20H8" stroke="#D9C7A8" stroke-width="1.5" stroke-linecap="round"/><path d="M-12-25Q-1-29 11-25" stroke="#FAFCFD" stroke-width="3" stroke-linecap="round"/></g>';
  const snowShrub = (x, y, s = 1, shape = 0) => {
    const crowns = [
      '<ellipse cx="0" cy="-26" rx="18" ry="13" fill="#627A55"/><ellipse cx="-12" cy="-17" rx="13" ry="10" fill="#768A63"/><ellipse cx="12" cy="-18" rx="12" ry="9" fill="#5F7650"/>',
      '<polygon points="0,-44 -18,-24 0,-16 18,-24" fill="#667E57"/><polygon points="0,-34 -16,-14 0,-8 16,-14" fill="#7C8F68"/>',
      '<ellipse cx="-6" cy="-25" rx="14" ry="11" fill="#6D845F"/><ellipse cx="10" cy="-29" rx="13" ry="10" fill="#5E7652"/><ellipse cx="6" cy="-16" rx="11" ry="9" fill="#82976D"/>',
    ][shape % 3];
    return (
      '<g transform="translate(' +
      x +
      " " +
      y +
      ") scale(" +
      s +
      ')" opacity=".95"><ellipse cy="10" rx="16" ry="4" fill="#8DA0A5" opacity=".12"/><ellipse cx="0" cy="11" rx="18" ry="5" fill="#F8FBFC" opacity=".94"/><path d="M0 11Q-1-4 1-34M0-10L-9-20M1-15L11-24" fill="none" stroke="#796A5B" stroke-width="3.6" stroke-linecap="round"/>' +
      crowns +
      '<ellipse cx="-3" cy="-32" rx="9" ry="3.6" fill="#F8FBFC" opacity=".94"/>' +
      "</g>"
    );
  };
  // Landmarks use normalized ground coordinates, not optional/occupied tiles.
  // Even a fully occupied board keeps its well and rocks. Empty forests stay empty.
  if (cfg.tier === 0) return [];
  if (cfg.month)
    return emptySlots.map(project).map((p) => ({
      y: p.y - 40,
      art:
        '<ellipse data-empty-cell="true" pointer-events="none" cx="' +
        p.x.toFixed(1) +
        '" cy="' +
        p.y.toFixed(1) +
        '" rx="' +
        ((cfg.boardW / cfg.cols) * 0.09).toFixed(1) +
        '" ry="' +
        ((cfg.boardH / cfg.rows) * 0.09).toFixed(1) +
        '" fill="' +
        (floorId === "basic" ? "#C9E3B4" : (POLY_FLOORS[floorId] || POLY_FLOORS.basic).dot) +
        '" opacity=".9"/>',
    }));
  const anchor = (u, v) => ({ x: 360 + u * cfg.boardW, y: 286 + v * cfg.boardH });
  const snow = theme === "snow",
    large = cfg.tier >= 4;
  place(
    snow ? "frozen-well" : "well",
    (x, y) => (snow ? frozenWell : well)(x, y, 1.12),
    anchor(-0.18, 0.02),
    [-27, -33, 27, 22],
  );
  place(
    snow ? "snow-rock" : "rock",
    (x, y) => (snow ? snowRock : rock)(x, y, 1.12),
    anchor(0.19, 0.07),
    [-26, -20, 26, 17],
  );
  if (cfg.tier >= 2) {
    place(
      snow ? "snow-sign" : "stump",
      (x, y) => (snow ? snowSign(x, y, 1) : stump(x, y, 1.25)),
      anchor(0.03, -0.23),
      [-20, -30, 21, 15],
    );
    place(
      snow ? "snow-flowers" : "flower",
      (x, y) => flowerPatch(x, y, 1.25, 1, snow),
      anchor(-0.06, 0.27),
      [-23, -19, 23, 20],
    );
    place(
      snow ? "snow-shrub" : "grass",
      (x, y) => (snow ? snowShrub(x, y, 0.65, 1) : grass(x, y, 1.3)),
      anchor(-0.3, -0.05),
      [-22, -33, 22, 17],
    );
  }
  if (cfg.tier >= 3) {
    place(
      snow ? "burrow" : "branch",
      (x, y) => (snow ? rabbitHole(x, y, 1.1) : branch(x, y, 1.15)),
      anchor(0.28, -0.05),
      [-25, -17, 25, 22],
    );
    place(
      snow ? "snow-flowers" : "flower",
      (x, y) => flowerPatch(x, y, 1.2, 2, snow),
      anchor(0.04, 0.13),
      [-22, -18, 22, 19],
    );
  }
  if (large) {
    place(
      snow ? "frozen-pond" : "pond",
      (x, y) =>
        snow
          ? "<g>" +
            pond(x, y, 1.05) +
            '<path d="M' +
            (Number(x) - 12) +
            " " +
            y +
            'l10-4 5 7 12-3" fill="none" stroke="#EAF7FA" stroke-width="2"/></g>'
          : pond(x, y, 1.05),
      anchor(0.03, -0.08),
      [-35, -23, 35, 24],
    );
    place(
      snow ? "snow-rock" : "rock",
      (x, y) => (snow ? snowRock : rock)(x, y, 0.95),
      anchor(-0.15, -0.23),
      [-23, -19, 23, 16],
    );
    place(
      snow ? "snow-branch" : "flower",
      (x, y) => (snow ? snowBranch(x, y, 1.1) : flowers(x, y, 1.2, 0)),
      anchor(0.14, 0.28),
      [-23, -18, 23, 19],
    );
  }
  return pieces;
}

// Only show the pale separator where a foreground tree overlaps a rear tree.
// Local masks reuse nearby tree artwork; isolated silhouettes remain untouched.
function forestOverlapEdges(points, cfg, theme) {
  const entries = points.map((p, i) => ({
    p,
    i,
    scale: Number(
      ((p.scale || cfg.treeScale) * (p.c?.hiddenTree ? hiddenTreeScale(p.c.hiddenTree, theme) : 1)).toFixed(
        3,
      ),
    ),
    art: treeArt(p.c, theme),
  }));
  let defs =
    '<filter id="forestOverlapAlpha" x="-10%" y="-10%" width="120%" height="120%"><feComponentTransfer in="SourceAlpha" result="opaqueShape"><feFuncA type="discrete" tableValues="0 0 1 1"/></feComponentTransfer><feFlood flood-color="white"/><feComposite in2="opaqueShape" operator="in"/></filter>';
  defs += entries.map((e) => '<g id="forestOverlapShape' + e.i + '">' + e.art + "</g>").join("");
  const edges = entries.map((e, i) => {
    const behind = entries
      .slice(0, i)
      .filter(
        (b) =>
          Math.abs(b.p.x - e.p.x) < 70 * (b.scale + e.scale) &&
          b.p.y + 20 * b.scale > e.p.y - 120 * e.scale &&
          b.p.y - 120 * b.scale < e.p.y + 20 * e.scale,
      );
    if (!behind.length) return "";
    const maskId = "forestOverlapMask" + i;
    defs +=
      '<mask id="' +
      maskId +
      '" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="-160" y="-200" width="320" height="260" style="mask-type:alpha">' +
      behind
        .map(
          (b) =>
            '<g transform="translate(' +
            ((b.p.x - e.p.x) / e.scale).toFixed(3) +
            " " +
            ((b.p.y - e.p.y) / e.scale).toFixed(3) +
            ") scale(" +
            (b.scale / e.scale).toFixed(4) +
            ')"><use href="#forestOverlapShape' +
            b.i +
            '" filter="url(#forestOverlapAlpha)"/></g>',
        )
        .join("") +
      "</mask>";
    return (
      '<g mask="url(#' +
      maskId +
      ')" pointer-events="none" aria-hidden="true"><use href="#forestOverlapShape' +
      i +
      '" filter="url(#forestTreeEdge)"/></g>'
    );
  });
  return { defs, edges };
}

// Drop-in ground artwork: append defs inside the parent SVG's <defs>, then
// body before the forest's depth-sorted scene. Tree projection stays untouched.

// Basic floor (redesign 11a): a flat sticker block — green top, soil sides, grass tufts,
// a white cut edge and a soft shadow, matching the forest tab's design.
// Low-poly ground shared by the month board, the year board and the share image.
// A K×K lattice whose inner points wobble and whose edge points bump in and out, cut into
// triangles of slightly different greens. 'meadow' (꽃이끼 정원) is the same shape in pale moss
// with soft moss patches and a few small flowers.
const POLY_FLOORS = {
  basic: {
    greens: ["#B2D68F", "#AED38B", "#B6D993", "#ABD088", "#B0D58D"],
    soil: ["#B08A63", "#86663F"],
    lip: ["#98C277", "#82AD62"],
    speck: ["#8E6B4C", "#73563D"],
    dot: "#C6E3A6",
  },
  meadow: {
    greens: ["#DCE3AE", "#D8E0A9", "#E0E5B3", "#D5DDA6", "#DAE1AB"],
    soil: ["#C4A67C", "#9A7F5B"],
    lip: ["#C9D394", "#B1BE7C"],
    speck: ["#9E8463", "#8A7254"],
    dot: "#EEF0CF",
  },
  // 겨울 숲: snow on top (white with faint blue facets), snow overhang on frozen earth
  snow: {
    greens: ["#F6F9FB", "#EEF4F8", "#F9FBFC", "#E8F0F5", "#F2F7FA"],
    soil: ["#A7927D", "#7E6B59"],
    lip: ["#FFFFFF", "#E2EBF1"],
    speck: ["#8C7865", "#6D5C4C"],
    dot: "#C9DBE7",
  },
};

function polyGround(cx, cy, rx, ry, depth, K, seed, floor = "basic") {
  const pal = POLY_FLOORS[floor] || POLY_FLOORS.basic,
    rnd = (k) => (hash(seed + "|" + k) % 100000) / 100000,
    cw = rx / K;
  const ideal = (i, j) => [cx + ((i - j) / K) * rx, cy - ry + ((i + j) / K) * ry];
  const V = [];
  for (let j = 0; j <= K; j++) {
    V[j] = [];
    for (let i = 0; i <= K; i++) {
      let [x, y] = ideal(i, j);
      const edge = i === 0 || j === 0 || i === K || j === K,
        corner = (i === 0 || i === K) && (j === 0 || j === K);
      if (corner) {
        x += (rnd("cx" + i + j) - 0.5) * cw * 0.05;
        y += (rnd("cy" + i + j) - 0.5) * cw * 0.03;
      } else if (edge) {
        const b = (rnd("b" + i + "." + j) - 0.45) * cw * 0.13,
          nx = (i === 0 ? -1 : i === K ? 1 : 0) - (j === 0 ? -1 : j === K ? 1 : 0),
          ny = i === 0 || j === 0 ? -1 : 1;
        x += nx * b;
        y += ny * b * 0.5;
      } else {
        x += (rnd("x" + i + "." + j) - 0.5) * cw * 0.2;
        y += (rnd("y" + i + "." + j) - 0.5) * cw * 0.1;
      }
      V[j][i] = [x, y];
    }
  }
  const facets = [],
    pick = (k) => pal.greens[Math.floor(rnd(k) * pal.greens.length)];
  for (let j = 0; j < K; j++)
    for (let i = 0; i < K; i++) {
      const a = V[j][i],
        b = V[j][i + 1],
        c = V[j + 1][i + 1],
        d = V[j + 1][i],
        flip = rnd("f" + i + "." + j) > 0.5;
      facets.push(
        { pts: flip ? [a, b, c] : [a, b, d], fill: pick("g1" + i + "." + j) },
        { pts: flip ? [a, c, d] : [b, c, d], fill: pick("g2" + i + "." + j) },
      );
    }
  const left = V[K],
    right = V.map((r) => r[K]).reverse(),
    k = cw / 34,
    lipH = (n, side) => (n % 2 ? 3.6 : 4.8 + rnd(side + "lp" + n) * 1.2) * k * 1.4;
  const drop = (p, key) => [p[0], p[1] + depth + (rnd("d" + key) - 0.5) * depth * 0.08];
  const sides = [],
    lips = [],
    extras = [];
  [
    [left, 0, "l"],
    [right, 1, "r"],
  ].forEach(([e, s, key]) => {
    for (let n = 0; n < K; n++) {
      const p1 = e[n],
        p2 = e[n + 1];
      sides.push({ pts: [p1, p2, drop(p2, key + (n + 1)), drop(p1, key + n)], fill: pal.soil[s] });
      const m = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
      lips.push({
        pts: [
          p1,
          m,
          p2,
          [p2[0], p2[1] + lipH(2 * n + 2, key)],
          [m[0], m[1] + lipH(2 * n + 1, key)],
          [p1[0], p1[1] + lipH(2 * n, key)],
        ],
        fill: pal.lip[s],
      });
    }
  });
  const specks = [];
  for (let n = 0; n < Math.round(K * 4); n++) {
    const lft = n % 2 === 0,
      e = lft ? left : right,
      t = rnd("s" + n) * K,
      q = Math.min(K - 1, Math.floor(t)),
      f = t - q,
      p1 = e[q],
      p2 = e[q + 1];
    specks.push({
      x: p1[0] + (p2[0] - p1[0]) * f,
      y: p1[1] + (p2[1] - p1[1]) * f + depth * (0.35 + rnd("sy" + n) * 0.5),
      r: (1 + rnd("sr" + n)) * k * 1.3,
      fill: pal.speck[lft ? 0 : 1],
    });
  }
  if (floor === "meadow") {
    // soft moss patches with a few small white flowers on top
    const flower = (x, y, z, pink) => {
      [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ].forEach(([dx, dy]) =>
        extras.push({
          x: x + dx * z * 0.9,
          y: y + dy * z * 0.55,
          rx: z * 0.75,
          ry: z * 0.5,
          fill: pink ? "#F7DCE0" : "#FBF7E4",
        }),
      );
      extras.push({ x, y, rx: z * 0.38, ry: z * 0.28, fill: "#F2C94C" });
    };
    for (let n = 0; n < K * 3; n++) {
      const a = rnd("ma" + n) * 1.7 - 0.85,
        b = rnd("mb" + n) * 1.7 - 0.85;
      if (n % 2) continue;
      extras.push({
        x: cx + ((a - b) * rx) / 2,
        y: cy + ((a + b) * ry) / 2,
        rx: cw * 0.55,
        ry: cw * 0.3,
        fill: "#C3D39C",
        opacity: 0.3,
      });
    }
    // a,b span the whole top face (a square in board space); favour the outer ring a little
    for (let n = 0; n < K * K * 4; n++) {
      const a = rnd("fa" + n) * 2 - 1,
        b = rnd("fb" + n) * 2 - 1,
        m = Math.max(Math.abs(a), Math.abs(b));
      if (m > 0.9 || (m < 0.5 && n % 3)) continue;
      flower(
        cx + ((a - b) * rx) / 2,
        cy + ((a + b) * ry) / 2,
        (4 + rnd("fz" + n) * 1.6) * k,
        rnd("fc" + n) < 0.3,
      );
    }
  }
  if (floor === "snow") {
    // soft blue hollows in the snow, small drifts, and a scatter of glints
    for (let n = 0; n < K * 4; n++) {
      const a = rnd("sa" + n) * 1.7 - 0.85,
        b = rnd("sb" + n) * 1.7 - 0.85;
      if (n % 2) continue;
      extras.push({
        x: cx + ((a - b) * rx) / 2,
        y: cy + ((a + b) * ry) / 2,
        rx: cw * (0.4 + rnd("sw" + n) * 0.3),
        ry: cw * 0.2,
        fill: "#D6E4EE",
        opacity: 0.55,
      });
    }
    for (let n = 0; n < K * K * 2; n++) {
      const a = rnd("da" + n) * 2 - 1,
        b = rnd("db" + n) * 2 - 1;
      if (Math.max(Math.abs(a), Math.abs(b)) > 0.88) continue;
      const x = cx + ((a - b) * rx) / 2,
        y = cy + ((a + b) * ry) / 2,
        z = (3.2 + rnd("dz" + n) * 2) * k;
      extras.push(
        { x, y: y + z * 0.25, rx: z * 1.2, ry: z * 0.42, fill: "#DCE7EF" },
        { x, y, rx: z, ry: z * 0.5, fill: "#FFFFFF" },
      );
    }
    for (let n = 0; n < K * K * 3; n++) {
      const a = rnd("ga" + n) * 2 - 1,
        b = rnd("gb" + n) * 2 - 1;
      if (Math.max(Math.abs(a), Math.abs(b)) > 0.9) continue;
      const z = (1 + rnd("gz" + n) * 0.8) * k;
      extras.push({
        x: cx + ((a - b) * rx) / 2,
        y: cy + ((a + b) * ry) / 2,
        rx: z,
        ry: z * 0.6,
        fill: "#BFD6E6",
        opacity: 0.8,
      });
    }
  }
  // silhouette for the sticker edge: back edges, then the dropped front edges
  const backL = V.map((r) => r[0]);
  const sil = [
    ...V[0],
    ...right.map((p, n) => drop(p, "r" + n)).reverse(),
    ...left.map((p, n) => drop(p, "l" + n)).reverse(),
    ...backL.slice().reverse(),
  ];
  return { facets, sides, lips, specks, extras, silhouette: sil, dot: pal.dot, V, K };
}

function polyGroundSVG(g, k = 1) {
  const P = (pts) => pts.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
  return (
    g.sides.map((f) => '<polygon points="' + P(f.pts) + '" fill="' + f.fill + '"/>').join("") +
    g.specks
      .map(
        (d) =>
          '<circle cx="' +
          d.x.toFixed(1) +
          '" cy="' +
          d.y.toFixed(1) +
          '" r="' +
          d.r.toFixed(1) +
          '" fill="' +
          d.fill +
          '" opacity=".85"/>',
      )
      .join("") +
    g.lips.map((f) => '<polygon points="' + P(f.pts) + '" fill="' + f.fill + '"/>').join("") +
    g.facets
      .map(
        (f) =>
          '<polygon points="' +
          P(f.pts) +
          '" fill="' +
          f.fill +
          '" stroke="' +
          f.fill +
          '" stroke-width="' +
          (0.7 * k).toFixed(2) +
          '" stroke-linejoin="round"/>',
      )
      .join("") +
    g.extras
      .map(
        (e) =>
          '<ellipse cx="' +
          e.x.toFixed(1) +
          '" cy="' +
          e.y.toFixed(1) +
          '" rx="' +
          e.rx.toFixed(1) +
          '" ry="' +
          e.ry.toFixed(1) +
          '" fill="' +
          e.fill +
          '"' +
          (e.opacity ? ' opacity="' + e.opacity + '"' : "") +
          "/>",
      )
      .join("")
  );
}

function polyGroundArtwork(cfg, cx = 360, cy = 286, floor = "basic") {
  const rx = cfg.boardW / 2 + 44,
    ry = cfg.boardH / 2 + 34,
    depth = Math.max(18, rx * 0.2),
    k = rx / 189,
    K = Math.max(3, Math.min(6, cfg.cols + 1));
  const g = polyGround(cx, cy, rx, ry, depth, K, "month" + cfg.cols, floor),
    f = (n) => n.toFixed(1),
    P = (pts) => pts.map((p) => f(p[0]) + "," + f(p[1])).join(" ");
  let tufts = "";
  for (let n = 0; n < Math.round(rx / 14); n++) {
    const a = (hash("tuft|a" + n) % 1000) / 500 - 1,
      b = (hash("tuft|b" + n) % 1000) / 500 - 1;
    if (Math.abs(a) + Math.abs(b) > 0.85) continue;
    const x = cx + ((a - b) * rx) / 2,
      y = cy + ((a + b) * ry) / 2,
      w = 4 * k;
    tufts += `<path d="M${f(x - w)} ${f(y)}L${f(x - w * 0.32)} ${f(y - 5 * k)}L${f(x)} ${f(y - 1.5 * k)}L${f(x + w * 0.32)} ${f(y - 5.5 * k)}L${f(x + w)} ${f(y)}" fill="none" stroke="${floor === "meadow" ? "#93AE7C" : floor === "snow" ? "#C3D4DF" : "#86B06A"}" stroke-width="${f(1.3 * k)}" stroke-linecap="round" stroke-linejoin="round" opacity=".75"/>`;
  }
  const id = "poly-ground-" + floor + "-" + Math.round(rx);
  const defs = `<filter id="${id}-shadow" x="-20%" y="-20%" width="140%" height="160%"><feGaussianBlur stdDeviation="${f(9 * k)}"/></filter>`;
  const body = `<g data-forest-ground="terrain" data-floor="${floor}" pointer-events="none"><polygon points="${P(g.silhouette)}" transform="translate(0 ${f(14 * k)})" fill="rgba(30,42,34,.3)" filter="url(#${id}-shadow)"/><polygon points="${P(g.silhouette)}" fill="#fff" stroke="#fff" stroke-width="${f(7 * k)}" stroke-linejoin="round"/>${polyGroundSVG(g, k)}<polygon data-ground-surface="true" points="${P(
    [
      ...g.V[0],
      ...g.V.map((r) => r[g.K]).slice(1),
      ...g.V[g.K].slice().reverse().slice(1),
      ...g.V.map((r) => r[0])
        .reverse()
        .slice(1),
    ],
  )}" fill="none"/>${tufts}</g>`;
  return { defs, body };
}

function stickerGroundArtwork(cfg, cx = 360, cy = 286) {
  const rx = cfg.boardW / 2 + 44,
    ry = cfg.boardH / 2 + 34,
    depth = Math.max(18, rx * 0.2),
    k = rx / 189,
    f = (n) => n.toFixed(1),
    unit = (key) => (hash("ground|" + key) % 10000) / 10000;
  const top = `M${f(cx)} ${f(cy - ry)}L${f(cx + rx)} ${f(cy)}L${f(cx)} ${f(cy + ry)}L${f(cx - rx)} ${f(cy)}Z`;
  const left = `M${f(cx - rx)} ${f(cy)}L${f(cx)} ${f(cy + ry)}L${f(cx)} ${f(cy + ry + depth)}L${f(cx - rx)} ${f(cy + depth)}Z`;
  const right = `M${f(cx + rx)} ${f(cy)}L${f(cx)} ${f(cy + ry)}L${f(cx)} ${f(cy + ry + depth)}L${f(cx + rx)} ${f(cy + depth)}Z`;
  const outline = `M${f(cx)} ${f(cy - ry)}L${f(cx + rx)} ${f(cy)}L${f(cx + rx)} ${f(cy + depth)}L${f(cx)} ${f(cy + ry + depth)}L${f(cx - rx)} ${f(cy + depth)}L${f(cx - rx)} ${f(cy)}Z`;
  // Grass hangs over the soil in a jagged lip, lighter on the left face, darker on the right.
  const lip = (side) => {
    const steps = 15,
      pts = [
        [cx + side * rx, cy],
        [cx, cy + ry],
      ];
    pts.push([cx, cy + ry + (side < 0 ? 13.8 : 12.6) * k]);
    for (let n = 1; n < steps; n++) {
      const t = n / steps,
        x = cx + side * rx * t,
        y =
          cy + ry * (1 - t) + (n % 2 ? 2.4 + unit(side + "l" + n) * 1.6 : 10 + unit(side + "d" + n) * 4) * k;
      pts.push([x, y]);
    }
    pts.push([cx + side * rx, cy + 6.6 * k]);
    return pts.map(([x, y]) => f(x) + "," + f(y)).join(" ");
  };
  let specks = "",
    tufts = "",
    patches = "";
  for (let n = 0; n < Math.round(rx / 2.6); n++) {
    const side = n % 2 ? 1 : -1,
      t = unit(n + "t"),
      d = 0.3 + unit(n + "d") * 0.62,
      x = cx + side * rx * (1 - t),
      y = cy + ry * t + depth * d;
    specks += `<rect x="${f(x - 1.6 * k)}" y="${f(y - 1.6 * k)}" width="${f(3.2 * k)}" height="${f(3.2 * k)}" fill="${unit(n + "c") > 0.72 ? "#C29E7A" : "#6F5239"}" opacity=".8"/>`;
  }
  if (!cfg.month)
    for (let a = 1; a < 5; a++)
      for (let b = 1; b < 5; b++) {
        if (unit(a + "," + b + "p") < 0.45) continue;
        const u = (a / 5) * 2 - 1,
          v = (b / 5) * 2 - 1,
          x = cx + ((u - v) * rx) / 2,
          y = cy + ((u + v) * ry) / 2;
        patches += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(9 * k)}" ry="${f(4.5 * k)}" fill="rgba(30,42,34,.14)"/>`;
      }
  for (let n = 0; n < Math.round(rx / (cfg.month ? 14 : 4.5)); n++) {
    const a = unit(n + "a") * 2 - 1,
      b = unit(n + "b") * 2 - 1;
    if (Math.abs(a) + Math.abs(b) > 0.9) continue;
    const x = cx + ((a - b) * rx) / 2,
      y = cy + ((a + b) * ry) / 2,
      w = 4 * k;
    tufts += `<path d="M${f(x - w)} ${f(y)}L${f(x - w * 0.32)} ${f(y - 5 * k)}L${f(x)} ${f(y - 1.5 * k)}L${f(x + w * 0.32)} ${f(y - 5.5 * k)}L${f(x + w)} ${f(y)}" fill="none" stroke="#6E9C58" stroke-width="${f(1.3 * k)}" stroke-linecap="round" stroke-linejoin="round" opacity=".75"/>`;
  }
  const id = "sticker-ground-" + Math.round(rx);
  const defs = `<filter id="${id}-shadow" x="-20%" y="-20%" width="140%" height="160%"><feGaussianBlur stdDeviation="${f(9 * k)}"/></filter>`;
  const body = `<g data-forest-ground="terrain" data-floor="basic" pointer-events="none"><path d="${outline}" transform="translate(0 ${f(12 * k)})" fill="rgba(30,42,34,.24)" filter="url(#${id}-shadow)"/><path d="${outline}" fill="#fff" stroke="#fff" stroke-width="${f(7 * k)}" stroke-linejoin="round"/><path d="${left}" fill="#A9825E"/><path d="${right}" fill="#8B6A4C"/>${specks}<polygon points="${lip(-1)}" fill="#7FAE68"/><polygon points="${lip(1)}" fill="#6C9A57"/><path data-ground-surface="true" d="${top}" fill="#9FC888"/>${patches}${tufts}</g>`;
  return { defs, body };
}

function forestGroundArtwork(cfg, theme, cx = 360, cy = 286, floor = "basic") {
  if (theme !== "snow") return polyGroundArtwork(cfg, cx, cy, POLY_FLOORS[floor] ? floor : "basic");
  const snow = theme === "snow";
  const rx = cfg.boardW / 2 + 44;
  const ry = cfg.boardH / 2 + 34;
  const depth = Math.min(12.5, 7.5 + rx * 0.013) + (snow ? 1.5 : 0);
  const corner = Math.min(0.17, Math.max(0.1, 36 / Math.hypot(rx, ry)));
  const p = (x, y, dy = 0) => `${(cx + x * rx).toFixed(1)} ${(cy + y * ry + dy).toFixed(1)}`;
  const q = corner;
  // The original diamond's four axes and margins are retained. Gentle cubic
  // edges and wider corners soften the outline without shrinking the planting area.
  const outline = (dy = 0) =>
    `M${p(-q, -1 + q, dy)} Q${p(0, -1, dy)} ${p(q, -1 + q, dy)}` +
    ` C${p(0.34, -0.67, dy)} ${p(0.69, -0.33, dy)} ${p(1 - q, -q, dy)}` +
    ` Q${p(1, 0, dy)} ${p(1 - q, q, dy)}` +
    ` C${p(0.69, 0.32, dy)} ${p(0.34, 0.69, dy)} ${p(q, 1 - q, dy)}` +
    ` Q${p(0, 1, dy)} ${p(-q, 1 - q, dy)}` +
    ` C${p(-0.35, 0.67, dy)} ${p(-0.68, 0.34, dy)} ${p(-1 + q, q, dy)}` +
    ` Q${p(-1, 0, dy)} ${p(-1 + q, -q, dy)}` +
    ` C${p(-0.69, -0.32, dy)} ${p(-0.35, -0.69, dy)} ${p(-q, -1 + q, dy)} Z`;
  const topPath = outline();
  const kind = snow ? "snow" : "basic";
  const id = `forest-ground-${kind}-${[rx, ry, cx, cy].map((v) => Math.round(v * 10)).join("-")}`;
  const palette = snow
    ? {
        top: ["#FCFCF8", "#EFF4F3", "#DFEAEB"],
        side: ["#D1DFE1", "#BFD1D5", "#AEBFC7"],
        shadow: "#81949B",
        light: "#FFFEF8",
        cool: "#C8DBE0",
        warm: "#F9FCF9",
      }
    : {
        top: ["#E9EFDC", "#DCE7CF", "#CDDCBC"],
        side: ["#C3CBB4", "#B2BBA1", "#A1AB92"],
        shadow: "#7F8974",
        light: "#F4F3DC",
        cool: "#BCD0AD",
        warm: "#E8EBD0",
      };
  const gradient = (name, colors) =>
    `<linearGradient id="${id}-${name}" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${colors[0]}"/><stop offset=".58" stop-color="${colors[1]}"/>` +
    `<stop offset="1" stop-color="${colors[2]}"/></linearGradient>`;
  const defs =
    gradient("top", palette.top) +
    gradient("side", palette.side) +
    `<clipPath id="${id}-clip"><path d="${topPath}"/></clipPath>`;
  const lightField =
    `M${p(-1.05, -0.08)} C${p(-0.68, -0.4)} ${p(-0.3, -1.0)} ${p(0.1, -0.92)}` +
    ` C${p(0.44, -0.86)} ${p(0.28, -0.49)} ${p(-0.04, -0.31)}` +
    ` C${p(-0.4, -0.08)} ${p(-0.65, 0.06)} ${p(-1.05, -0.08)} Z`;
  const coolField =
    `M${p(0.12, -0.18)} C${p(0.47, -0.35)} ${p(0.91, -0.17)} ${p(1.08, 0.03)}` +
    ` L${p(0.21, 0.99)} C${p(-0.1, 0.68)} ${p(0.05, 0.5)} ${p(0.37, 0.24)}` +
    ` C${p(0.56, 0.08)} ${p(0.4, -0.04)} ${p(0.12, -0.18)} Z`;
  const warmField =
    `M${p(-0.84, 0.19)} C${p(-0.45, 0.1)} ${p(-0.18, 0.21)} ${p(0.17, 0.44)}` +
    ` C${p(0.34, 0.55)} ${p(0.4, 0.73)} ${p(0.13, 0.97)}` +
    ` C${p(-0.28, 0.83)} ${p(-0.68, 0.47)} ${p(-0.84, 0.19)} Z`;
  // The snow lip is a filled shallow ribbon, not an outline or an extra filter.
  const lip = snow ? `<path data-ground-snow-lip="true" d="${outline(2.7)}" fill="#E9F0EF"/>` : "";
  // A close contact shadow follows the island footprint instead of floating below it.
  const body =
    `<g data-forest-ground="soft-island" data-theme="${kind}" pointer-events="none">` +
    `<path data-ground-shadow="contact" d="${outline(depth + 3)}" transform="translate(2 0)" fill="${palette.shadow}" opacity=".08"/>` +
    `<path data-ground-side="true" d="${outline(depth)}" fill="url(#${id}-side)"/>` +
    lip +
    `<path data-ground-surface="true" d="${topPath}" fill="url(#${id}-top)"/>` +
    `<g clip-path="url(#${id}-clip)">` +
    `<path d="${lightField}" fill="${palette.light}" opacity="${snow ? ".50" : ".25"}"/>` +
    `<path d="${coolField}" fill="${palette.cool}" opacity="${snow ? ".19" : ".17"}"/>` +
    `<path d="${warmField}" fill="${palette.warm}" opacity="${snow ? ".28" : ".16"}"/>` +
    `</g></g>`;
  return { defs, body };
}

function forestSVG(items, theme = "basic", animated = true, options = {}) {
  theme = theme === "snow" || theme === "winter" ? "snow" : "basic";
  const n = items.length,
    cfg = forestBoardConfig(n, options.grid, options.minCols),
    origin = forestStageOrigin(cfg);
  const rawAll = [];
  for (let r = 0; r < cfg.rows; r++) for (let c = 0; c < cfg.cols; c++) rawAll.push({ rx: c - r, ry: c + r });
  const minRX = Math.min(...rawAll.map((p) => p.rx)),
    maxRX = Math.max(...rawAll.map((p) => p.rx)),
    minRY = Math.min(...rawAll.map((p) => p.ry)),
    maxRY = Math.max(...rawAll.map((p) => p.ry));
  const cx = 360,
    cy = 286,
    marginX = 44,
    marginY = 34;
  const project = (s) => {
    const c = s.c ?? s.gx - origin.x,
      r = s.r ?? s.gy - origin.y,
      rx = s.rx ?? c - r,
      ry = s.ry ?? c + r;
    return {
      x: cx + ((rx - (minRX + maxRX) / 2) / Math.max(1, maxRX - minRX)) * cfg.boardW,
      y: cy + ((ry - (minRY + maxRY) / 2) / Math.max(1, maxRY - minRY)) * cfg.boardH,
      gx: s.gx,
      gy: s.gy,
      edge: s.edge || 0,
      key: s.key,
    };
  };
  const sortedItems = [...items].sort(
    (a, b) => forestItemOrder(a) - forestItemOrder(b) || a.id.localeCompare(b.id),
  );
  const visibleItems = sortedItems.slice(-FOREST_VISIBLE_LIMIT);
  const layout = forestPlacements(visibleItems, cfg);
  if (layout.changed && !options.preview && !options.transient) persist();
  const points = layout.placements
    .map((p) => ({ ...project(p.slot), c: p.item, profile: p.profile, scale: p.scale }))
    .sort((a, b) => a.y - b.y || a.c.id.localeCompare(b.c.id));
  const floorId = options.floor || bmFloorId(),
    groundArtwork = forestGroundArtwork(cfg, theme, cx, cy, floorId);
  const decorations = forestDecorations(
    cfg,
    project,
    theme,
    layout.emptySlots,
    layout.featureSlots,
    forestTreeObstacles(points, cfg, theme),
    floorId,
  );
  // Raster trees already carry soft shading. Avoid per-tree blur/mask copies of large images.
  const overlap = points.every((p) => !!illustratedTreeAsset(p.c, theme))
    ? { defs: "", edges: points.map(() => "") }
    : forestOverlapEdges(points, cfg, theme);
  const trees = points.map((p, i) => {
    const hiddenKind = forestGrowthKey(p.c) ? null : p.c?.hiddenTree,
      hiddenBoost = hiddenKind ? hiddenTreeScale(hiddenKind, theme) : 1,
      sc = ((p.scale || cfg.treeScale) * hiddenBoost).toFixed(3),
      shadowRx = ((p.profile?.radius || 24) * 0.7 * hiddenBoost).toFixed(1),
      shadowRy = Math.max(3.6, (p.profile?.radius || 24) * 0.13 * hiddenBoost).toFixed(1),
      snowBase =
        theme === "snow"
          ? '<ellipse cx="0" cy="13" rx="' +
            Math.max(9, (p.profile?.radius || 24) * 0.5 * hiddenBoost).toFixed(1) +
            '" ry="4.1" fill="#F8FBFC" opacity=".92"/>'
          : "";
    return (
      '<g data-tree="' +
      esc(p.c.id) +
      '" data-growth="' +
      (forestGrowthKey(p.c) || "mature") +
      '" role="button" tabindex="0" aria-label="' +
      esc(p.c.title + " · " + String(p.c.genre || category(p.c).label)) +
      '" transform="translate(' +
      p.x.toFixed(1) +
      " " +
      p.y.toFixed(1) +
      ") scale(" +
      sc +
      ')"><ellipse cx="4" cy="10" rx="' +
      shadowRx +
      '" ry="' +
      shadowRy +
      '" fill="#708579" opacity="' +
      (illustratedTreeAsset(p.c, theme) ? "0" : ".11") +
      '"/>' +
      snowBase +
      treeHitArea(p.c, theme) +
      overlap.edges[i] +
      '<g class="tree-art">' +
      treeArt(p.c, hiddenKind && floorId === "snow" ? "snow" : theme) +
      "</g></g>"
    );
  });
  const scene = [...trees.map((art, i) => ({ y: points[i].y, art })), ...decorations]
    .sort((a, b) => a.y - b.y)
    .map((entry) => entry.art)
    .join("");
  const visitor = n ? forestVisitorArt(items, animated) : "";
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 540" data-count="' +
    n +
    '"' +
    (options.grid ? ' data-grid="' + options.grid + '"' : "") +
    ' role="group" aria-label="' +
    n +
    "그루의 " +
    { basic: "기본", snow: "겨울" }[theme] +
    ' 숲"><defs>' +
    overlap.defs +
    '<filter id="forestTreeEdge" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB"><feMorphology in="SourceAlpha" operator="dilate" radius="1.5" result="spread"/><feGaussianBlur in="spread" stdDeviation=".85" result="edge"/><feFlood flood-color="' +
    (theme === "snow" ? "#BCCFD5" : "#B9CE98") +
    '" flood-opacity=".72"/><feComposite in2="edge" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
    groundArtwork.defs +
    '</defs><rect width="720" height="540" fill="transparent"/>' +
    (theme === "snow"
      ? '<path d="M55 224 177 58 275 191 368 31 541 221 598 99 720 247" fill="#c4d4db"/><path d="M135 115L177 58 217 112 188 100 175 117 163 100Z M317 99L368 31 423 104 384 86 365 108 348 85Z" fill="#f8fbfc"/>'
      : "") +
    '<g id="forest-world">' +
    groundArtwork.body +
    scene +
    visitor +
    "</g></svg>"
  );
}
