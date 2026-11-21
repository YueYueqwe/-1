/* =========================================================
   STEEL//RIVALS — pixel mecha duel
   1. constants / dom / audio
   2. utilities / fighter factory / state
   3. input / game flow
   4. procedural backdrop
   5. combat update / AI
   6. mech & effects rendering
   7. HUD / main loop
   ========================================================= */
(() => {
  "use strict";

  /* ---------------- 1. constants / dom / audio ---------------- */

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.imageSmoothingEnabled = false;

  const W = 480;
  const H = 270;
  const GROUND = 222;
  const STAGE_LEFT = 50;
  const STAGE_RIGHT = 430;
  const GRAVITY = 760;
  const ROUND_TIME = 75;

  const UI = {
    stage: document.getElementById("stage"),
    hp1Fill: document.getElementById("hp1Fill"),
    hp1Ghost: document.getElementById("hp1Ghost"),
    hp2Fill: document.getElementById("hp2Fill"),
    hp2Ghost: document.getElementById("hp2Ghost"),
    hp1Bar: document.getElementById("hp1Bar"),
    hp2Bar: document.getElementById("hp2Bar"),
    hp1Num: document.getElementById("hp1Num"),
    hp2Num: document.getElementById("hp2Num"),
    shield1Fill: document.getElementById("shield1Fill"),
    shield2Fill: document.getElementById("shield2Fill"),
    shield1Bar: document.getElementById("shield1Bar"),
    shield2Bar: document.getElementById("shield2Bar"),
    timer: document.getElementById("timer"),
    announce: document.getElementById("announce"),
    startScreen: document.getElementById("startScreen"),
    pauseScreen: document.getElementById("pauseScreen"),
    resultScreen: document.getElementById("resultScreen"),
    startBtn: document.getElementById("startBtn"),
    restartBtn: document.getElementById("restartBtn"),
    resumeBtn: document.getElementById("resumeBtn"),
    pauseRestartBtn: document.getElementById("pauseRestartBtn"),
    muteBtn: document.getElementById("muteBtn"),
    muteLabel: document.getElementById("muteLabel"),
    resultReason: document.getElementById("resultReason"),
    resultTitle: document.getElementById("resultTitle"),
    resultSub: document.getElementById("resultSub"),
    finalScore: document.getElementById("finalScore"),
    statDamage: document.getElementById("statDamage"),
    statHits: document.getElementById("statHits"),
    statBlocks: document.getElementById("statBlocks"),
    touchControls: document.getElementById("touchControls"),
  };

  const PAL = {
    p1: {
      outline: "#04131f",
      dark: "#0d3350",
      mid: "#1d6688",
      light: "#58b6cf",
      pale: "#a9f2ff",
      metal: "#7f9cab",
      accent: "#55f6ff",
      core: "#e4ffff",
      flame: "#48ecff",
      hostile: "#ff6b54",
    },
    p2: {
      outline: "#19090c",
      dark: "#45151a",
      mid: "#8d2c28",
      light: "#d7563b",
      pale: "#ffb270",
      metal: "#a48372",
      accent: "#ffb24d",
      core: "#ffefb0",
      flame: "#ff843d",
      hostile: "#55f6ff",
    },
  };

  const WHITE_PAL = {
    outline: "#fff7e2",
    dark: "#fff7e2",
    mid: "#fff7e2",
    light: "#fff7e2",
    pale: "#ffffff",
    metal: "#fff7e2",
    accent: "#ffffff",
    core: "#ffffff",
    flame: "#ffffff",
    hostile: "#ffffff",
  };

  const PROFILE = {
    p1: {
      name: "苍隼",
      code: "AZURE-01",
      maxHp: 100,
      speed: 84,
      jump: 258,
      shotDmg: 7,
      meleeDmg: 16,
      shotCd: 0.37,
      meleeCd: 0.96,
      shotSpeed: 292,
    },
    p2: {
      name: "赤鬼",
      code: "CRIMSON-07",
      maxHp: 100,
      speed: 65,
      jump: 238,
      shotDmg: 7,
      meleeDmg: 16,
      shotCd: 0.9,
      meleeCd: 1.26,
      shotSpeed: 258,
    },
  };

  const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sign = (v) => (v < 0 ? -1 : 1);
  const rand = (a, b) => a + Math.random() * (b - a);

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a += 0x6d2b79f5;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const audio = {
    ctx: null,
    master: null,
    muted: false,
  };

  function initAudio() {
    if (audio.ctx) {
      if (audio.ctx.state === "suspended") audio.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audio.ctx = new AC();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.34;
    audio.master.connect(audio.ctx.destination);
  }

  function audioTone(freq, dur, type, vol, slideTo, delay) {
    if (!audio.ctx || audio.muted) return;
    const t0 = audio.ctx.currentTime + (delay || 0);
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = type || "square";
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol || 0.05, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function audioNoise(dur, vol, freq, delay) {
    if (!audio.ctx || audio.muted) return;
    const t0 = audio.ctx.currentTime + (delay || 0);
    const len = Math.max(1, Math.floor(audio.ctx.sampleRate * dur));
    const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audio.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq || 900;
    filter.Q.value = 0.7;
    const gain = audio.ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.06, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(audio.master);
    src.start(t0);
  }

  function sfx(name) {
    if (!audio.ctx || audio.muted) return;
    switch (name) {
      case "ui":
        audioTone(620, 0.06, "square", 0.035, 880);
        break;
      case "shoot":
        audioTone(1120, 0.1, "square", 0.045, 270);
        audioNoise(0.05, 0.025, 1700);
        break;
      case "melee":
        audioNoise(0.16, 0.055, 620);
        audioTone(230, 0.16, "sawtooth", 0.035, 90);
        break;
      case "hit":
        audioNoise(0.12, 0.075, 420);
        audioTone(120, 0.15, "square", 0.05, 58);
        break;
      case "heavyHit":
        audioNoise(0.22, 0.1, 260);
        audioTone(86, 0.26, "sawtooth", 0.075, 40);
        break;
      case "block":
        audioTone(1500, 0.08, "triangle", 0.045, 760);
        audioNoise(0.06, 0.03, 2400);
        break;
      case "guardBreak":
        audioNoise(0.32, 0.1, 500);
        audioTone(430, 0.3, "sawtooth", 0.07, 60);
        break;
      case "jump":
        audioTone(140, 0.24, "sawtooth", 0.035, 300);
        audioNoise(0.08, 0.02, 800);
        break;
      case "land":
        audioNoise(0.08, 0.035, 220);
        break;
      case "ko":
        audioNoise(0.8, 0.16, 220);
        audioTone(110, 0.8, "sawtooth", 0.09, 26);
        audioTone(58, 1.1, "sine", 0.1, 28, 0.04);
        break;
      case "win":
        [523, 659, 784, 1046].forEach((f, i) => audioTone(f, 0.12, "square", 0.035, null, i * 0.09));
        break;
      case "lose":
        [330, 262, 208, 156].forEach((f, i) => audioTone(f, 0.16, "triangle", 0.04, null, i * 0.12));
        break;
    }
  }

  /* ---------------- 2. utilities / fighters / state ---------------- */

  const game = {
    mode: "menu",
    time: 0,
    roundTime: ROUND_TIME,
    startLock: 0,
    koTimer: 0,
    resultDelay: 0,
    shake: 0,
    shakePower: 0,
    flash: 0,
    winner: null,
    over: false,
    reason: "ko",
    bgTime: 0,
    stats: { shots: 0, hits: 0, damage: 0, blocks: 0 },
  };

  function createFighter(id, x) {
    const p = PROFILE[id];
    return {
      id,
      profile: p,
      x,
      y: GROUND,
      vx: 0,
      vy: 0,
      facing: id === "p1" ? 1 : -1,
      hp: p.maxHp,
      maxHp: p.maxHp,
      shield: 100,
      maxShield: 100,
      onGround: true,
      action: null,
      actionTime: 0,
      didAction: false,
      guarding: false,
      guardBreak: 0,
      shieldDelay: 0,
      shotCd: 0,
      meleeCd: 0,
      hitstun: 0,
      hurtFlash: 0,
      invuln: 0,
      animTime: Math.random() * 5,
      walkPhase: 0,
      koTime: 0,
      victory: false,
      moveIntent: 0,
      ai: null,
    };
  }

  const P = createFighter("p1", 146);
  const E = createFighter("p2", 334);

  E.ai = {
    think: 0.4,
    guard: 0,
    react: 0,
    jumpCd: 0,
    move: 0,
    aggression: 0.62,
  };

  const projectiles = [];
  const particles = [];
  const popups = [];
  const ambient = [];
  const announceTimers = [];
  let resultTimer = null;
  let lastFrame = performance.now();

  function resetFighter(f, x) {
    const p = f.profile;
    f.x = x;
    f.y = GROUND;
    f.vx = 0;
    f.vy = 0;
    f.facing = f.id === "p1" ? 1 : -1;
    f.hp = p.maxHp;
    f.shield = 100;
    f.onGround = true;
    f.action = null;
    f.actionTime = 0;
    f.didAction = false;
    f.guarding = false;
    f.guardBreak = 0;
    f.shieldDelay = 0;
    f.shotCd = 0;
    f.meleeCd = 0;
    f.hitstun = 0;
    f.hurtFlash = 0;
    f.invuln = 0;
    f.koTime = 0;
    f.victory = false;
    f.moveIntent = 0;
    f.animTime = Math.random() * 4;
  }

  function resetFighters() {
    resetFighter(P, 146);
    resetFighter(E, 334);
    P.animTime = 0;
    E.animTime = 1.6;
    E.ai.think = 0.5;
    E.ai.guard = 0;
    E.ai.react = 0;
    E.ai.jumpCd = 0;
    E.ai.move = 0;
  }

  function clearEffects() {
    projectiles.length = 0;
    particles.length = 0;
    popups.length = 0;
  }

  /* ---------------- 3. input / game flow ---------------- */

  const keys = new Set();
  const virtualKeys = new Set();
  const pressed = new Set();
  const CONTROL_CODES = new Set([
    "KeyA", "KeyD", "KeyW", "KeyJ", "KeyK", "KeyL", "Space", "ShiftLeft", "ShiftRight",
    "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
  ]);

  function down(code) {
    return keys.has(code) || virtualKeys.has(code);
  }

  const isLeft = () => down("KeyA") || down("ArrowLeft");
  const isRight = () => down("KeyD") || down("ArrowRight");
  const isGuard = () => down("KeyL") || down("ShiftLeft") || down("ShiftRight");

  window.addEventListener("keydown", (event) => {
    initAudio();
    if (CONTROL_CODES.has(event.code)) event.preventDefault();
    if (event.repeat) return;
    keys.add(event.code);
    pressed.add(event.code);

    if (event.code === "Enter") {
      if (game.mode === "menu" || game.mode === "result") startGame();
    } else if (event.code === "Space" && game.mode === "menu") {
      startGame();
    } else if (event.code === "KeyP" || event.code === "Escape") {
      if (game.mode === "playing" || game.mode === "paused") togglePause();
    } else if (event.code === "KeyM") {
      toggleMute();
    }
  });

  window.addEventListener("keyup", (event) => {
    keys.delete(event.code);
  });

  window.addEventListener("blur", () => {
    keys.clear();
    virtualKeys.clear();
    if (game.mode === "playing") togglePause();
  });

  function bindTouchControls() {
    UI.touchControls.querySelectorAll("[data-key]").forEach((button) => {
      const code = button.dataset.key;
      const release = () => {
        virtualKeys.delete(code);
        button.classList.remove("active");
      };
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        initAudio();
        button.setPointerCapture?.(event.pointerId);
        virtualKeys.add(code);
        pressed.add(code);
        button.classList.add("active");
      });
      button.addEventListener("pointerup", release);
      button.addEventListener("pointercancel", release);
      button.addEventListener("lostpointercapture", release);
      button.addEventListener("contextmenu", (event) => event.preventDefault());
    });
  }

  function readInput() {
    return {
      move: (isRight() ? 1 : 0) - (isLeft() ? 1 : 0),
      jump: pressed.has("Space") || pressed.has("KeyW") || pressed.has("ArrowUp"),
      shoot: pressed.has("KeyJ"),
      melee: pressed.has("KeyK"),
      guard: isGuard(),
    };
  }

  function setModeUI(mode) {
    UI.stage.dataset.mode = mode;
    UI.startScreen.classList.toggle("is-visible", mode === "menu");
    UI.startScreen.setAttribute("aria-hidden", mode === "menu" ? "false" : "true");
    UI.pauseScreen.classList.toggle("is-visible", mode === "paused");
    UI.pauseScreen.setAttribute("aria-hidden", mode === "paused" ? "false" : "true");
    UI.resultScreen.classList.toggle("is-visible", mode === "result");
    UI.resultScreen.setAttribute("aria-hidden", mode === "result" ? "false" : "true");
  }

  function clearUiTimers() {
    while (announceTimers.length) clearTimeout(announceTimers.pop());
    if (resultTimer) {
      clearTimeout(resultTimer);
      resultTimer = null;
    }
    UI.announce.classList.remove("show");
  }

  function showAnnounce(title, sub, duration) {
    const ms = duration || 900;
    UI.announce.innerHTML = "<strong>" + title + "</strong>" + (sub ? "<span>" + sub + "</span>" : "");
    UI.announce.style.setProperty("--ann-dur", ms + "ms");
    UI.announce.classList.remove("show");
    void UI.announce.offsetWidth;
    UI.announce.classList.add("show");
    announceTimers.push(
      setTimeout(() => {
        UI.announce.classList.remove("show");
      }, ms)
    );
  }

  function startGame() {
    initAudio();
    sfx("ui");
    clearUiTimers();
    clearEffects();
    resetFighters();
    game.mode = "playing";
    game.roundTime = ROUND_TIME;
    game.startLock = 1.7;
    game.koTimer = 0;
    game.winner = null;
    game.over = false;
    game.reason = "ko";
    game.shake = 0;
    game.shakePower = 0;
    game.flash = 0;
    game.stats = { shots: 0, hits: 0, damage: 0, blocks: 0 };
    pressed.clear();
    setModeUI("playing");
    updateHud(true);
    showAnnounce("ROUND 01", "SECTOR 07 // DUEL PROTOCOL", 850);
    setTimeout(() => {
      if (game.mode === "playing") showAnnounce("FIGHT!", "ELIMINATE THE TARGET", 720);
    }, 920);
    UI.startBtn.blur();
    UI.restartBtn.blur();
  }

  function togglePause() {
    if (game.mode === "playing") {
      game.mode = "paused";
      setModeUI("paused");
      sfx("ui");
      UI.resumeBtn.focus({ preventScroll: true });
    } else if (game.mode === "paused") {
      game.mode = "playing";
      setModeUI("playing");
      sfx("ui");
      pressed.clear();
      lastFrame = performance.now();
      UI.resumeBtn.blur();
    }
  }

  function toggleMute() {
    audio.muted = !audio.muted;
    UI.muteBtn.setAttribute("aria-pressed", audio.muted ? "true" : "false");
    UI.muteLabel.textContent = audio.muted ? "SFX OFF" : "SFX ON";
    if (!audio.muted) sfx("ui");
  }

  UI.startBtn.addEventListener("click", startGame);
  UI.restartBtn.addEventListener("click", startGame);
  UI.resumeBtn.addEventListener("click", togglePause);
  UI.pauseRestartBtn.addEventListener("click", startGame);
  UI.muteBtn.addEventListener("click", () => {
    initAudio();
    toggleMute();
    UI.muteBtn.blur();
  });
  bindTouchControls();
  setModeUI("menu");

  /* ---------------- 4. procedural backdrop ---------------- */

  const backdrop = document.createElement("canvas");
  backdrop.width = W;
  backdrop.height = H;
  const bg = backdrop.getContext("2d");
  bg.imageSmoothingEnabled = false;

  const SKY_STOPS = [
    [0, [4, 7, 18]],
    [48, [9, 16, 38]],
    [92, [31, 24, 55]],
    [130, [74, 37, 61]],
    [171, [152, 63, 65]],
    [204, [203, 88, 70]],
    [222, [236, 136, 89]],
  ];

  function skyColorAt(y) {
    let a = SKY_STOPS[0];
    let b = SKY_STOPS[SKY_STOPS.length - 1];
    for (let i = 0; i < SKY_STOPS.length - 1; i++) {
      if (y >= SKY_STOPS[i][0] && y <= SKY_STOPS[i + 1][0]) {
        a = SKY_STOPS[i];
        b = SKY_STOPS[i + 1];
        break;
      }
    }
    const t = clamp((y - a[0]) / Math.max(1, b[0] - a[0]), 0, 1);
    return (
      "rgb(" +
      Math.round(lerp(a[1][0], b[1][0], t)) + "," +
      Math.round(lerp(a[1][1], b[1][1], t)) + "," +
      Math.round(lerp(a[1][2], b[1][2], t)) + ")"
    );
  }

  function drawPixelCircle(g, cx, cy, r, color) {
    g.fillStyle = color;
    for (let y = -r; y <= r; y++) {
      const half = Math.floor(Math.sqrt(r * r - y * y));
      g.fillRect(cx - half, cy + y, half * 2 + 1, 1);
    }
  }

  function buildBackdrop() {
    const rnd = mulberry32(70707);

    // sky bands
    for (let y = 0; y < GROUND; y++) {
      bg.fillStyle = skyColorAt(y);
      bg.fillRect(0, y, W, 1);
    }

    // dithered horizon glow
    for (let i = 0; i < 240; i++) {
      const x = Math.floor(rnd() * W);
      const y = 150 + Math.floor(rnd() * 68);
      bg.fillStyle = "rgba(255,171,115," + (0.05 + rnd() * 0.07).toFixed(2) + ")";
      bg.fillRect(x, y, 1 + Math.floor(rnd() * 2), 1);
    }

    // stars
    for (let i = 0; i < 74; i++) {
      const x = Math.floor(rnd() * W);
      const y = Math.floor(rnd() * 92);
      const a = 0.18 + rnd() * 0.52;
      bg.fillStyle = "rgba(196,232,255," + a.toFixed(2) + ")";
      bg.fillRect(x, y, 1, rnd() > 0.84 ? 2 : 1);
    }

    // distant clouds
    const cloudRows = [49, 68, 82, 112];
    cloudRows.forEach((cy, idx) => {
      bg.fillStyle = idx % 2 ? "rgba(43,35,72,0.36)" : "rgba(26,27,55,0.4)";
      for (let i = 0; i < 14; i++) {
        const x = Math.floor(rnd() * W);
        const w = 22 + Math.floor(rnd() * 58);
        const h = 1 + Math.floor(rnd() * 3);
        bg.fillRect(x, cy + Math.floor(rnd() * 8), w, h);
      }
    });

    // pixel sun
    const sx = 352;
    const sy = 102;
    const sr = 41;
    for (let i = 8; i > 0; i--) {
      bg.fillStyle = "rgba(255,120,78," + (0.016 * (9 - i)).toFixed(3) + ")";
      for (let y = -sr - i; y <= sr + i; y++) {
        const half = Math.floor(Math.sqrt(Math.max(0, (sr + i) * (sr + i) - y * y)));
        bg.fillRect(sx - half, sy + y, half * 2 + 1, 1);
      }
    }
    for (let y = -sr; y <= sr; y++) {
      const t = (y + sr) / (sr * 2);
      const rr = Math.round(lerp(255, 255, t));
      const gg = Math.round(lerp(231, 103, t));
      const bb = Math.round(lerp(145, 92, t));
      const half = Math.floor(Math.sqrt(sr * sr - y * y));
      bg.fillStyle = "rgb(" + rr + "," + gg + "," + bb + ")";
      bg.fillRect(sx - half, sy + y, half * 2 + 1, 1);
    }
    for (let y = 8; y < sr; y += 5) {
      const half = Math.floor(Math.sqrt(Math.max(0, sr * sr - y * y)));
      bg.fillStyle = "rgba(91,42,71,0.42)";
      bg.fillRect(sx - half, sy + y, half * 2 + 1, 2);
    }
    bg.fillStyle = "rgba(255,221,163,0.32)";
    bg.fillRect(sx - sr - 1, sy - 2, 2, 2);
    bg.fillRect(sx + sr - 1, sy - 2, 2, 2);

    // far mountain silhouettes
    bg.fillStyle = "#1c1128";
    for (let x = 0; x < W; x += 2) {
      const h = 22 + Math.floor(9 * Math.sin(x * 0.035) + 6 * Math.sin(x * 0.081 + 1.7));
      bg.fillRect(x, 204 - h, 2, h + 18);
    }
    bg.fillStyle = "#261530";
    for (let x = 0; x < W; x += 2) {
      const h = 12 + Math.floor(6 * Math.sin(x * 0.055 + 0.4) + 4 * Math.sin(x * 0.12));
      bg.fillRect(x, 208 - h, 2, h + 16);
    }

    // far city
    let x = -6;
    while (x < W) {
      const w = 8 + Math.floor(rnd() * 18);
      const h = 13 + Math.floor(rnd() * 45);
      const top = 206 - h;
      bg.fillStyle = "#0d0d1b";
      bg.fillRect(x, top, w, h + 16);
      bg.fillStyle = "#151325";
      bg.fillRect(x + 1, top + 1, Math.max(1, w - 2), 2);
      if (rnd() > 0.45) {
        bg.fillStyle = "#29243c";
        bg.fillRect(x + Math.floor(w / 2), top - 9, 1, 9);
        bg.fillStyle = rnd() > 0.45 ? "#ff6a52" : "#73edff";
        bg.fillRect(x + Math.floor(w / 2), top - 10, 1, 1);
      }
      const windowCount = Math.floor((w * h) / 26);
      for (let i = 0; i < windowCount; i++) {
        if (rnd() > 0.62) {
          bg.fillStyle = rnd() > 0.8 ? "rgba(105,235,255,0.5)" : "rgba(255,174,99,0.52)";
          bg.fillRect(x + 2 + Math.floor(rnd() * (w - 4)), top + 5 + Math.floor(rnd() * (h - 6)), 1, 2);
        }
      }
      x += w + 3 + Math.floor(rnd() * 8);
    }

    // distant industrial cranes
    bg.fillStyle = "#121522";
    bg.fillRect(38, 132, 2, 86);
    bg.fillRect(38, 134, 42, 2);
    bg.fillRect(76, 134, 2, 30);
    bg.fillRect(26, 154, 14, 2);
    bg.fillStyle = "rgba(255,115,78,0.8)";
    bg.fillRect(38, 128, 2, 2);
    bg.fillStyle = "#111420";
    bg.fillRect(430, 143, 2, 78);
    bg.fillRect(400, 145, 44, 2);
    bg.fillRect(400, 145, 2, 34);
    bg.fillStyle = "rgba(255,115,78,0.8)";
    bg.fillRect(430, 139, 2, 2);

    // reactor ring framing the arena
    const ringCX = 240;
    const ringCY = 204;
    const ringRX = 142;
    const ringRY = 104;
    for (let a = Math.PI; a < Math.PI * 2; a += 0.018) {
      const arc = Math.sin(a * 7) > 0.31 ? 1 : 0.45;
      const rx = ringCX + Math.cos(a) * ringRX;
      const ry = ringCY + Math.sin(a) * ringRY;
      if (ry > 218) continue;
      bg.fillStyle = "rgba(18,23,37," + arc + ")";
      bg.fillRect(Math.round(rx) - 2, Math.round(ry) - 2, 4, 4);
    }
    for (let a = Math.PI * 1.04; a < Math.PI * 1.96; a += 0.035) {
      if (Math.sin(a * 9) > 0.55) continue;
      const rx = ringCX + Math.cos(a) * (ringRX - 6);
      const ry = ringCY + Math.sin(a) * (ringRY - 5);
      if (ry > 216) continue;
      bg.fillStyle = "rgba(83,231,246,0.22)";
      bg.fillRect(Math.round(rx), Math.round(ry), 2, 1);
    }
    // ring support cables
    bg.fillStyle = "rgba(32,47,59,0.55)";
    bg.fillRect(104, 100, 1, 104);
    bg.fillRect(375, 100, 1, 104);
    bg.fillRect(104, 100, 82, 1);
    bg.fillRect(294, 100, 81, 1);

    // side gantry pillars
    [20, 458].forEach((px, i) => {
      bg.fillStyle = "#0b101b";
      bg.fillRect(px - 7, 92, 14, 132);
      bg.fillStyle = "#171d2b";
      bg.fillRect(px - 5, 94, 10, 130);
      bg.fillStyle = "#242b3b";
      bg.fillRect(px - 5, 96, 2, 126);
      for (let y = 100; y < 218; y += 24) {
        bg.fillStyle = "#080d16";
        bg.fillRect(px - 6, y, 12, 3);
        bg.fillStyle = "rgba(255,164,76,0.6)";
        bg.fillRect(px + (i ? -7 : 6), y + 5, 2, 2);
      }
      bg.fillStyle = "rgba(255,120,88,0.8)";
      bg.fillRect(px - 1, 86, 2, 3);
    });

    // warm light shafts
    bg.save();
    const shaft = bg.createLinearGradient(0, 110, 0, 222);
    shaft.addColorStop(0, "rgba(255,150,90,0.075)");
    shaft.addColorStop(1, "rgba(255,150,90,0)");
    bg.fillStyle = shaft;
    bg.beginPath();
    bg.moveTo(312, 104);
    bg.lineTo(338, 104);
    bg.lineTo(420, 222);
    bg.lineTo(246, 222);
    bg.closePath();
    bg.fill();
    bg.restore();

    // stage floor / platform
    bg.fillStyle = "#070b13";
    bg.fillRect(0, 222, W, 48);
    bg.fillStyle = "#121a28";
    bg.fillRect(0, 216, W, 7);
    bg.fillStyle = "#22394b";
    bg.fillRect(0, 217, W, 1);
    bg.fillStyle = "#416d7c";
    bg.fillRect(0, 221, W, 1);
    bg.fillStyle = "rgba(80,235,250,0.35)";
    bg.fillRect(26, 220, 428, 1);

    // platform face panels
    bg.fillStyle = "#0b111d";
    bg.fillRect(0, 223, W, 21);
    for (let px = 0; px < W; px += 40) {
      bg.fillStyle = "rgba(4,8,14,0.75)";
      bg.fillRect(px, 223, 1, 20);
      bg.fillStyle = "rgba(65,96,111,0.24)";
      bg.fillRect(px + 2, 225, 36, 1);
      bg.fillStyle = "rgba(52,82,96,0.28)";
      bg.fillRect(px + 32, 227, 2, 2);
    }
    // hazard blocks at platform edges
    for (let hx = 0; hx < 46; hx += 8) {
      bg.fillStyle = hx % 16 === 0 ? "#b98534" : "#1c2028";
      bg.fillRect(hx, 223, 8, 5);
      bg.fillStyle = hx % 16 === 0 ? "#171a20" : "#c2933b";
      bg.fillRect(434 + hx, 223, 8, 5);
    }
    // vents / pipes below deck
    bg.fillStyle = "#050810";
    bg.fillRect(0, 244, W, 26);
    bg.fillStyle = "#101723";
    bg.fillRect(54, 238, 96, 8);
    bg.fillRect(330, 238, 96, 8);
    bg.fillStyle = "#1e3141";
    bg.fillRect(60, 240, 84, 1);
    bg.fillRect(336, 240, 84, 1);
    for (let vx = 64; vx < 144; vx += 6) {
      bg.fillStyle = "#070c14";
      bg.fillRect(vx, 242, 3, 4);
    }
    for (let vx = 340; vx < 420; vx += 6) {
      bg.fillStyle = "#070c14";
      bg.fillRect(vx, 242, 3, 4);
    }
    bg.fillStyle = "#171f2c";
    bg.fillRect(84, 252, 3, 18);
    bg.fillRect(392, 252, 3, 18);
    bg.fillRect(208, 248, 2, 22);
    bg.fillRect(270, 248, 2, 22);
    bg.fillStyle = "rgba(255,124,80,0.5)";
    bg.fillRect(150, 248, 2, 2);
    bg.fillRect(328, 248, 2, 2);
    bg.fillStyle = "rgba(85,246,255,0.5)";
    bg.fillRect(86, 262, 2, 1);
    bg.fillRect(393, 263, 2, 1);

    // arena edge posts
    [40, 440].forEach((px, i) => {
      bg.fillStyle = "#0e1520";
      bg.fillRect(px - 2, 190, 4, 31);
      bg.fillStyle = "#b98534";
      bg.fillRect(px - 3, 202, 6, 3);
      bg.fillStyle = "#171a20";
      bg.fillRect(px - 3, 205, 6, 3);
      bg.fillStyle = "rgba(88,244,255,0.55)";
      bg.fillRect(px, 191, 1, 11);
      bg.fillStyle = "rgba(255,93,74,0.7)";
      bg.fillRect(px, 187, 1, 2);
      bg.fillStyle = "#0a1019";
      bg.fillRect(px - 4, 220, 9, 2);
      bg.fillStyle = "rgba(88,244,255,0.32)";
      bg.fillRect(px + (i ? -8 : 8), 220, 8, 1);
    });

    // foreground fog strips on the deck
    bg.fillStyle = "rgba(87,152,168,0.035)";
    bg.fillRect(0, 209, W, 5);
    bg.fillStyle = "rgba(255,164,98,0.035)";
    bg.fillRect(240, 212, 240, 4);

    // dark bottom vignette
    const bottom = bg.createLinearGradient(0, 228, 0, H);
    bottom.addColorStop(0, "rgba(2,5,10,0)");
    bottom.addColorStop(1, "rgba(2,4,8,0.8)");
    bg.fillStyle = bottom;
    bg.fillRect(0, 228, W, H - 228);
  }

  buildBackdrop();

  function initAmbient() {
    ambient.length = 0;
    for (let i = 0; i < 34; i++) {
      ambient.push({
        x: rand(0, W),
        y: rand(120, 262),
        vy: rand(-7, -2),
        vx: rand(-3, 3),
        size: Math.random() > 0.82 ? 2 : 1,
        warm: Math.random() > 0.45,
        a: rand(0.12, 0.5),
        phase: rand(0, Math.PI * 2),
      });
    }
  }
  initAmbient();

  function drawDynamicBackdrop(t) {
    // drifting industrial haze
    for (let i = 0; i < 3; i++) {
      const drift = ((t * (6 + i * 3) + i * 160) % (W + 180)) - 90;
      const grad = ctx.createLinearGradient(drift, 0, drift + 180, 0);
      grad.addColorStop(0, "rgba(120,188,202,0)");
      grad.addColorStop(0.5, "rgba(120,188,202," + (0.03 + i * 0.008) + ")");
      grad.addColorStop(1, "rgba(120,188,202,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(drift, 196 + i * 8, 180, 8);
    }

    // slow hover drone
    const dx = ((t * 9 + 34) % (W + 90)) - 45;
    const dy = 53 + Math.sin(t * 0.9) * 4;
    ctx.fillStyle = "rgba(5,10,18,0.9)";
    ctx.fillRect(Math.round(dx), Math.round(dy), 6, 2);
    ctx.fillRect(Math.round(dx) + 1, Math.round(dy) - 1, 4, 1);
    if (Math.sin(t * 5) > 0) {
      ctx.fillStyle = "#ff6b54";
      ctx.fillRect(Math.round(dx) + 5, Math.round(dy) + 1, 1, 1);
    }
    ctx.fillStyle = "rgba(88,244,255,0.4)";
    ctx.fillRect(Math.round(dx) + 2, Math.round(dy) + 2, 2, 1);

    // blinking tower lights
    const blink = Math.sin(t * 2.4) > 0.72;
    if (blink) {
      ctx.fillStyle = "rgba(255,104,80,0.9)";
      ctx.fillRect(38, 127, 2, 2);
      ctx.fillRect(430, 138, 2, 2);
      ctx.fillStyle = "rgba(255,104,80,0.16)";
      ctx.fillRect(35, 124, 8, 8);
      ctx.fillRect(427, 135, 8, 8);
    }

    // deck neon reflection pulse
    ctx.fillStyle = "rgba(88,244,255," + (0.035 + (Math.sin(t * 1.8) + 1) * 0.012) + ")";
    ctx.fillRect(26, 221, 428, 1);
  }

  function drawAmbient(t) {
    for (let i = 0; i < ambient.length; i++) {
      const p = ambient[i];
      const a = p.a * (0.65 + 0.35 * Math.sin(t * 1.4 + p.phase));
      ctx.fillStyle = p.warm ? "rgba(255,174,105," + a + ")" : "rgba(103,238,255," + a + ")";
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
  }

  function updateAmbient(dt, t) {
    for (let i = 0; i < ambient.length; i++) {
      const p = ambient[i];
      p.y += p.vy * dt;
      p.x += (p.vx + Math.sin(t * 0.5 + p.phase) * 2) * dt;
      if (p.y < 112) {
        p.y = rand(232, 266);
        p.x = rand(0, W);
      }
      if (p.x < -4) p.x = W + 2;
      if (p.x > W + 4) p.x = -2;
    }
  }

  /* ---------------- 5. combat update / effects ---------------- */

  function addShake(power, duration) {
    game.shakePower = Math.max(game.shakePower, power);
    game.shake = Math.max(game.shake, duration);
  }

  function addPopup(text, x, y, color) {
    popups.push({
      text: String(text),
      x,
      y,
      vy: -24,
      life: 0.8,
      maxLife: 0.8,
      color: color || "#ffffff",
    });
  }

  function burst(x, y, count, opts) {
    const o = opts || {};
    for (let i = 0; i < count; i++) {
      const ang =
        o.angle != null
          ? o.angle + rand(-(o.spread || 0), o.spread || 0)
          : rand(0, Math.PI * 2);
      const spd = rand(o.min != null ? o.min : 20, o.max != null ? o.max : 90);
      const life = rand(0.16, o.life || 0.42);
      particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd + (o.vx || 0),
        vy: Math.sin(ang) * spd - (o.lift || 0) + (o.vy || 0),
        life,
        maxLife: life,
        size: o.size || (Math.random() > 0.6 ? 2 : 1),
        color: o.colors ? o.colors[(Math.random() * o.colors.length) | 0] : o.color || "#ffffff",
        gravity: o.gravity != null ? o.gravity : 240,
        glow: o.glow !== false,
      });
    }
  }

  function canAct(f) {
    return !game.over && !f.action && f.hitstun <= 0 && f.guardBreak <= 0;
  }

  function jump(f) {
    if (!f.onGround || !canAct(f) || f.guarding) return;
    f.vy = -f.profile.jump;
    f.onGround = false;
    f.guarding = false;
    sfx("jump");
    burst(f.x, GROUND - 1, 7, {
      colors: ["#8fb6c4", "#b9d6df", "#5a7c8a"],
      angle: 0,
      spread: Math.PI,
      lift: 26,
      min: 10,
      max: 46,
      gravity: 130,
      life: 0.34,
      glow: false,
    });
  }

  function tryShoot(f) {
    if (!canAct(f) || f.shotCd > 0 || f.guarding) return;
    f.action = "shoot";
    f.actionTime = 0;
    f.didAction = false;
    f.shotCd = f.profile.shotCd;
  }

  function tryMelee(f) {
    if (!canAct(f) || f.meleeCd > 0 || f.guarding) return;
    f.action = "melee";
    f.actionTime = 0;
    f.didAction = false;
    f.meleeCd = f.profile.meleeCd;
    sfx("melee");
  }

  function fireProjectile(f) {
    const p = f.profile;
    const mx = f.x + f.facing * 27;
    const my = f.y - 32;
    projectiles.push({
      owner: f,
      x: mx,
      y: my,
      vx: f.facing * p.shotSpeed,
      dmg: p.shotDmg,
      life: 1.5,
      trailClock: 0,
    });
    if (f === P) game.stats.shots++;
    burst(mx, my, 6, {
      colors: f === P ? ["#a9f2ff", "#55f6ff", "#ffffff"] : ["#ffdca0", "#ff9a5a", "#fff2d0"],
      angle: f.facing > 0 ? 0 : Math.PI,
      spread: 0.55,
      min: 24,
      max: 82,
      gravity: 0,
      life: 0.22,
    });
    sfx("shoot");
  }

  function doMeleeHit(f, target) {
    const dx = target.x - f.x;
    const range = 46;
    if (Math.abs(dx) <= range && Math.abs(target.y - f.y) < 56 && Math.sign(dx) === f.facing) {
      applyDamage(target, f.profile.meleeDmg, { attacker: f, dir: f.facing, heavy: true });
    } else {
      burst(f.x + f.facing * 30, f.y - 30, 6, {
        colors: ["#bff7ff", "#7fe7ff", "#ffffff"],
        angle: f.facing > 0 ? 0 : Math.PI,
        spread: 0.7,
        min: 30,
        max: 90,
        gravity: 60,
        life: 0.26,
      });
    }
  }

  function applyDamage(target, amount, opts) {
    const o = opts || {};
    if (game.over || target.invuln > 0) return;
    const dir = o.dir || 1;
    const attacker = o.attacker;

    if (target.guarding && target.shield > 0 && target.facing === -dir) {
      const cost = amount * 2.6 + 7;
      target.shield = Math.max(0, target.shield - cost);
      target.shieldDelay = 0.9;
      const chip = Math.max(1, Math.round(amount * 0.1));
      target.hp = Math.max(0, target.hp - chip);
      target.hitstun = Math.max(target.hitstun, 0.08);
      target.vx = -dir * 48;
      target.hurtFlash = 0.06;
      if (target === P) game.stats.blocks++;
      sfx("block");
      addShake(2, 0.12);
      burst(target.x + target.facing * 14, target.y - 32, 9, {
        colors: ["#dffcff", "#8ff4ff", "#ffffff"],
        angle: target.facing > 0 ? 0 : Math.PI,
        spread: 0.9,
        min: 30,
        max: 110,
        gravity: 90,
        life: 0.32,
      });
      addPopup("BLOCK", target.x + target.facing * 6, target.y - 62, "#bff9ff");
      if (target.shield <= 0) breakGuard(target);
      if (target.hp <= 0) triggerKO(target);
      return;
    }

    const dmg = Math.round(amount);
    const before = target.hp;
    target.hp = Math.max(0, target.hp - dmg);
    target.hurtFlash = o.heavy ? 0.24 : 0.15;
    target.hitstun = o.heavy ? 0.34 : 0.18;
    target.vx = dir * (o.heavy ? 195 : 96);
    target.guarding = false;
    target.shieldDelay = Math.max(target.shieldDelay, 0.6);
    if (attacker === P) {
      game.stats.hits++;
      game.stats.damage += before - target.hp;
    }
    sfx(o.heavy ? "heavyHit" : "hit");
    addShake(o.heavy ? 5 : 2.6, o.heavy ? 0.24 : 0.14);
    game.flash = Math.max(game.flash, o.heavy ? 0.1 : 0.04);
    burst(target.x, target.y - 32, o.heavy ? 16 : 9, {
      colors: attacker === P
        ? ["#fff3bf", "#a9f2ff", "#55f6ff", "#ffffff"]
        : ["#fff3bf", "#ffb24d", "#ff6b54", "#ffffff"],
      min: 40,
      max: o.heavy ? 180 : 120,
      gravity: 190,
      life: o.heavy ? 0.55 : 0.36,
    });
    addPopup(dmg, target.x, target.y - 58, attacker === P ? "#d8fdff" : "#ffd4b0");
    if (target.hp <= 0) triggerKO(target);
  }

  function breakGuard(f) {
    f.guarding = false;
    f.guardBreak = 0.9;
    f.shield = 0;
    f.shieldDelay = 1.3;
    f.hitstun = Math.max(f.hitstun, 0.35);
    if (f === E && E.ai) E.ai.guard = 0;
    sfx("guardBreak");
    addShake(4, 0.3);
    game.flash = Math.max(game.flash, 0.06);
    burst(f.x + f.facing * 14, f.y - 32, 16, {
      colors: ["#9ff6ff", "#ffffff", "#ffd38a"],
      min: 40,
      max: 155,
      gravity: 120,
      life: 0.5,
      size: 2,
    });
    addPopup("GUARD BREAK", f.x, f.y - 66, "#ffd38a");
  }

  function triggerKO(f) {
    if (game.over) return;
    f.hp = 0;
    f.guarding = false;
    game.over = true;
    game.winner = f === P ? E : P;
    game.reason = "ko";
    game.koTimer = 0;
    f.koTime = 0.001;
    f.vx = -f.facing * 150;
    f.vy = -132;
    f.onGround = false;
    addShake(9, 0.7);
    game.flash = 0.3;
    burst(f.x, f.y - 34, 28, {
      colors: ["#fff2b0", "#ffb24d", "#ff6b54", "#ffffff"],
      min: 30,
      max: 190,
      gravity: 165,
      life: 0.9,
      size: 2,
    });
    addPopup("K.O.", f.x, f.y - 72, "#ffe9a8");
    sfx("ko");
  }

  function triggerTimeUp() {
    if (game.over) return;
    game.roundTime = 0;
    game.over = true;
    game.reason = "time";
    game.koTimer = 0;
    if (P.hp > E.hp) game.winner = P;
    else if (E.hp > P.hp) game.winner = E;
    else game.winner = null;
    if (game.winner) game.winner.victory = true;
    showAnnounce("TIME UP", "COMBAT DATA JUDGED", 900);
    addShake(2, 0.3);
    sfx("ui");
  }

  function endRound() {
    if (game.mode !== "playing") return;
    game.mode = "result";
    const winner = game.winner;
    const timeUp = game.reason === "time";

    let outcome = "draw";
    let title = "DRAW";
    let sub = "双方机体 · 战斗不能";
    if (timeUp) sub = "时间耗尽 · 双方战力持平";

    if (winner === P) {
      outcome = "win";
      title = "VICTORY";
      sub = timeUp ? "点数判定 · 苍隼胜出" : "赤鬼 · 信号中断";
    } else if (winner === E) {
      outcome = "lose";
      title = "DEFEAT";
      sub = timeUp ? "点数判定 · 赤鬼胜出" : "苍隼 · 机体损毁";
    }

    UI.resultReason.textContent = timeUp ? "TIME UP" : "K.O.";
    UI.resultTitle.textContent = title;
    UI.resultTitle.className = "modal-title result-title " + outcome;
    UI.resultSub.textContent = sub;
    UI.finalScore.textContent =
      Math.max(0, Math.round(P.hp)) + " : " + Math.max(0, Math.round(E.hp));
    UI.statDamage.textContent = String(Math.round(game.stats.damage));
    UI.statHits.textContent = String(game.stats.hits);
    UI.statBlocks.textContent = String(game.stats.blocks);
    UI.resultScreen.dataset.outcome = outcome;

    setModeUI("result");
    if (outcome === "win") sfx("win");
    else if (outcome === "lose") sfx("lose");
    else sfx("ui");

    if (resultTimer) clearTimeout(resultTimer);
    resultTimer = setTimeout(() => {
      resultTimer = null;
      UI.restartBtn.focus({ preventScroll: true });
    }, 420);
    pressed.clear();
  }

  function controlPlayer() {
    if (game.startLock > 0 || game.over || P.guardBreak > 0 || P.hitstun > 0) {
      P.moveIntent = 0;
      P.guarding = false;
      return;
    }
    const input = readInput();
    P.moveIntent = input.move;

    if (input.jump) jump(P);
    if (input.shoot) tryShoot(P);
    if (input.melee) tryMelee(P);

    const wantGuard = input.guard && !P.action && P.shield > 0 && P.onGround;
    P.guarding = wantGuard;
    if (wantGuard) P.moveIntent = 0;
  }

  function updateAI(dt) {
    const ai = E.ai;
    ai.think -= dt;
    ai.jumpCd -= dt;
    ai.guard -= dt;
    ai.react -= dt;

    const dist = Math.abs(P.x - E.x);
    const dir = P.x >= E.x ? 1 : -1;

    if (game.startLock > 0 || game.over || E.hitstun > 0 || E.guardBreak > 0) {
      E.moveIntent = 0;
      E.guarding = false;
      return;
    }
    if (E.action) {
      E.moveIntent = 0;
      E.guarding = false;
      return;
    }
    if (ai.guard > 0 && E.shield > 0) {
      E.guarding = true;
      E.moveIntent = 0;
      return;
    }
    E.guarding = false;

    let incoming = false;
    for (let i = 0; i < projectiles.length; i++) {
      const pr = projectiles[i];
      if (pr.owner !== P) continue;
      const d = E.x - pr.x;
      if (Math.abs(d) < 132 && Math.sign(pr.vx) === Math.sign(d)) {
        incoming = true;
        break;
      }
    }
    const meleeThreat = P.action === "melee" && dist < 56;

    if ((incoming || meleeThreat) && ai.react <= 0) {
      ai.react = 0.9;
      if (E.onGround && E.shield > 24 && Math.random() < 0.6) {
        ai.guard = rand(0.3, 0.55);
        E.guarding = true;
        E.moveIntent = 0;
        return;
      }
      if (E.onGround && ai.jumpCd <= 0 && Math.random() < 0.5) {
        jump(E);
        ai.jumpCd = 1.2;
        E.moveIntent = 0;
        return;
      }
    }

    if (ai.think > 0) return;
    ai.think = rand(0.18, 0.4);

    if (dist < 48) {
      if (E.meleeCd <= 0 && Math.random() < 0.72) {
        tryMelee(E);
        E.moveIntent = 0;
        return;
      }
      if (Math.random() < 0.4) {
        E.moveIntent = -dir;
        return;
      }
    }

    if (dist > 52 && dist < 215 && E.shotCd <= 0 && Math.random() < 0.42) {
      tryShoot(E);
      E.moveIntent = 0;
      return;
    }

    if (dist > 118) E.moveIntent = dir;
    else if (dist < 64) E.moveIntent = Math.random() < 0.35 ? -dir : 0;
    else E.moveIntent = Math.random() < 0.5 ? dir : 0;

    if (E.onGround && ai.jumpCd <= 0 && Math.random() < 0.05) {
      jump(E);
      ai.jumpCd = rand(1.5, 2.6);
    }
  }

  function updateFighter(f, dt, opponent) {
    f.shotCd = Math.max(0, f.shotCd - dt);
    f.meleeCd = Math.max(0, f.meleeCd - dt);
    f.invuln = Math.max(0, f.invuln - dt);
    f.hurtFlash = Math.max(0, f.hurtFlash - dt);
    f.hitstun = Math.max(0, f.hitstun - dt);
    f.guardBreak = Math.max(0, f.guardBreak - dt);

    if (!f.action && f.hitstun <= 0 && f.guardBreak <= 0 && !game.over && opponent) {
      f.facing = opponent.x >= f.x ? 1 : -1;
    }

    if (f.action) {
      f.actionTime += dt;
      if (f.action === "shoot") {
        if (!f.didAction && f.actionTime >= 0.08) {
          f.didAction = true;
          fireProjectile(f);
        }
        if (f.actionTime >= 0.26) f.action = null;
      } else if (f.action === "melee") {
        if (!f.didAction && f.actionTime >= 0.11) {
          f.didAction = true;
          doMeleeHit(f, opponent);
        }
        if (f.actionTime >= 0.4) f.action = null;
      }
    }

    if (f.guarding) {
      f.shield = Math.max(0, f.shield - 22 * dt);
      f.shieldDelay = 0.7;
      if (f.shield <= 0) breakGuard(f);
    } else if (f.shieldDelay > 0) {
      f.shieldDelay -= dt;
    } else if (f.shield < f.maxShield) {
      f.shield = Math.min(f.maxShield, f.shield + 16 * dt);
    }

    const move = clamp(f.moveIntent || 0, -1, 1);
    const canMove = f.hitstun <= 0 && f.guardBreak <= 0;
    if (canMove) {
      let speed = f.profile.speed;
      if (f.guarding) speed *= 0.32;
      if (f.action) speed *= 0.5;
      f.vx = move * speed * (f.onGround ? 1 : 0.72);
    } else {
      f.vx *= Math.pow(0.0025, dt);
    }

    const wasAir = !f.onGround;
    f.x += f.vx * dt;
    f.vy += GRAVITY * dt;
    f.y += f.vy * dt;

    if (f.y >= GROUND) {
      f.y = GROUND;
      if (wasAir && f.vy > 150) {
        sfx("land");
        burst(f.x, GROUND, 6, {
          colors: ["#8fb6c4", "#6c8b98", "#b9d6df"],
          angle: 0,
          spread: Math.PI,
          lift: 14,
          min: 12,
          max: 42,
          gravity: 150,
          life: 0.3,
          glow: false,
        });
      }
      f.vy = 0;
      f.onGround = true;
    } else {
      f.onGround = false;
    }

    f.x = clamp(f.x, STAGE_LEFT, STAGE_RIGHT);
    const walking = f.onGround && Math.abs(f.vx) > 12 && !f.guarding;
    f.walkPhase += dt * (walking ? 11 : 2.5);

    if (f.hp > 0 && f.hp < 35 && Math.random() < dt * 6) {
      particles.push({
        x: f.x + rand(-6, 6),
        y: f.y - rand(20, 44),
        vx: rand(-6, 6),
        vy: rand(-22, -10),
        life: 0.7,
        maxLife: 0.7,
        size: Math.random() > 0.5 ? 2 : 1,
        color: Math.random() > 0.5 ? "#39414c" : "#6c4a3a",
        gravity: -26,
        glow: false,
      });
    }
  }

  function separateFighters() {
    const d = E.x - P.x;
    const min = 22;
    if (Math.abs(d) < min) {
      const push = (min - Math.abs(d)) / 2;
      const s = d >= 0 ? 1 : -1;
      P.x = clamp(P.x - s * push, STAGE_LEFT, STAGE_RIGHT);
      E.x = clamp(E.x + s * push, STAGE_LEFT, STAGE_RIGHT);
    }
  }

  function updateProjectiles(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const pr = projectiles[i];
      pr.x += pr.vx * dt;
      pr.life -= dt;
      pr.trailClock -= dt;
      if (pr.trailClock <= 0) {
        pr.trailClock = 0.025;
        particles.push({
          x: pr.x,
          y: pr.y + rand(-1, 1),
          vx: -pr.vx * 0.05,
          vy: rand(-8, 8),
          life: 0.18,
          maxLife: 0.18,
          size: 1,
          color: pr.owner === P ? "#55f6ff" : "#ff9a5a",
          gravity: 0,
          glow: true,
        });
      }
      if (pr.x < STAGE_LEFT - 24 || pr.x > STAGE_RIGHT + 24 || pr.life <= 0) {
        projectiles.splice(i, 1);
        continue;
      }
      const target = pr.owner === P ? E : P;
      if (target.invuln > 0) continue;
      const half = 13;
      if (
        pr.x > target.x - half &&
        pr.x < target.x + half &&
        pr.y > target.y - 56 &&
        pr.y < target.y - 2
      ) {
        applyDamage(target, pr.dmg, { attacker: pr.owner, dir: Math.sign(pr.vx) });
        burst(pr.x, pr.y, 8, {
          colors: pr.owner === P
            ? ["#a9f2ff", "#55f6ff", "#ffffff"]
            : ["#ffdca0", "#ff9a5a", "#ffffff"],
          min: 30,
          max: 130,
          gravity: 120,
          life: 0.34,
        });
        projectiles.splice(i, 1);
      }
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.vx *= Math.pow(0.22, dt);
    }
  }

  function updatePopups(dt) {
    for (let i = popups.length - 1; i >= 0; i--) {
      const p = popups[i];
      p.life -= dt;
      if (p.life <= 0) {
        popups.splice(i, 1);
        continue;
      }
      p.y += p.vy * dt;
      p.vy += 46 * dt;
    }
  }

  function updateBattle(dt) {
    game.startLock = Math.max(0, game.startLock - dt);
    game.flash = Math.max(0, game.flash - dt * 2.6);
    game.shake = Math.max(0, game.shake - dt);
    if (game.shake <= 0) game.shakePower = 0;

    controlPlayer();
    updateAI(dt);
    updateFighter(P, dt, E);
    updateFighter(E, dt, P);
    separateFighters();
    updateProjectiles(dt);
    updateParticles(dt);
    updatePopups(dt);

    if (!game.over && game.startLock <= 0) {
      game.roundTime -= dt;
      if (game.roundTime <= 0) triggerTimeUp();
    }

    if (game.over) {
      game.koTimer += dt;
      const loser = game.winner === P ? E : game.winner === E ? P : null;
      if (loser) loser.koTime += dt;
      if (game.winner && game.koTimer > 0.85) game.winner.victory = true;
      if (game.koTimer > (game.reason === "time" ? 1.7 : 2.2)) endRound();
    }

    updateHud();
    pressed.clear();
  }

  /* ---------------- 6. mech & effects rendering ---------------- */

  function mechShape(g, f, pal, t) {
    const moving = f.onGround && Math.abs(f.vx) > 12 && !f.guarding;
    const strideOn = moving ? 1 : 0;
    const phase = f.walkPhase;
    const air = GROUND - f.y;
    const airTuck = air > 2 ? 3 : 0;
    const bob =
      Math.round(Math.sin(t * 2.4 + (f.id === "p2" ? 1.8 : 0)) * (moving ? 0 : 1)) +
      (f.guarding ? 2 : 0);

    function px(x, y, w, h, color) {
      g.fillStyle = color;
      g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    }

    const stepF = Math.round(Math.sin(phase) * 3.2) * strideOn;
    const stepB = -stepF;
    const liftF = strideOn ? Math.round(Math.max(0, Math.sin(phase)) * 3) : 0;
    const liftB = strideOn ? Math.round(Math.max(0, -Math.sin(phase)) * 3) : 0;

    function leg(hx, step, lift, thigh, shin, shine) {
      const footY = -3 - lift - airTuck;
      px(hx - 3, -20, 6, 9, pal.outline);
      px(hx - 2, -20, 4, 8, thigh);
      px(hx - 2 + Math.round(step * 0.5), -13, 5, Math.max(2, footY + 13), pal.outline);
      px(hx - 1 + Math.round(step * 0.5), -12, 3, Math.max(2, footY + 12), shin);
      px(hx - 5 + step, footY - 1, 11, 4, pal.outline);
      px(hx - 4 + step, footY - 2, 9, 3, shine);
      px(hx - 4 + step, footY - 2, 9, 1, pal.light);
    }

    leg(-6, stepB, liftB, pal.dark, pal.mid, pal.metal);

    px(-14, -38 + bob, 6, 15, pal.outline);
    px(-13, -37 + bob, 4, 13, pal.dark);
    px(-13, -24 + bob, 4, 3, pal.metal);

    leg(3, stepF, liftF, pal.mid, pal.light, pal.metal);

    px(-8, -23 + bob, 16, 6, pal.outline);
    px(-7, -23 + bob, 14, 4, pal.dark);
    px(-5, -23 + bob, 10, 1, pal.metal);

    px(-12, -44 + bob, 24, 24, pal.outline);
    px(-11, -43 + bob, 22, 22, pal.dark);
    px(-10, -42 + bob, 20, 18, pal.mid);
    px(-10, -42 + bob, 6, 18, pal.light);
    px(5, -41 + bob, 4, 16, pal.light);
    px(-10, -42 + bob, 20, 2, pal.pale);

    px(-6, -39 + bob, 14, 9, pal.dark);
    px(-5, -38 + bob, 12, 7, pal.mid);
    g.globalAlpha = 0.22;
    px(0, -38 + bob, 8, 9, pal.accent);
    g.globalAlpha = 1;
    px(1, -36 + bob, 6, 5, pal.accent);
    px(2, -35 + bob, 4, 3, pal.core);

    px(-8, -30 + bob, 4, 1, pal.accent);
    px(-8, -28 + bob, 3, 1, pal.metal);
    px(4, -30 + bob, 4, 1, pal.metal);

    px(-7, -58 + bob, 14, 14, pal.outline);
    px(-6, -57 + bob, 12, 12, pal.dark);
    px(-5, -56 + bob, 10, 10, pal.mid);
    px(-5, -56 + bob, 10, 2, pal.light);
    px(0, -53 + bob, 6, 4, pal.outline);
    px(1, -52 + bob, 5, 2, pal.accent);
    px(3, -52 + bob, 2, 1, pal.core);
    px(-4, -48 + bob, 4, 1, pal.metal);

    if (f.id === "p1") {
      px(0, -62 + bob, 1, 6, pal.metal);
      px(-1, -65 + bob, 3, 3, pal.accent);
      px(0, -65 + bob, 1, 1, pal.core);
      px(-8, -56 + bob, 2, 4, pal.light);
      px(7, -56 + bob, 2, 3, pal.light);
    } else {
      px(-7, -58 + bob, 3, 2, pal.metal);
      px(-9, -61 + bob, 3, 3, pal.metal);
      px(-11, -63 + bob, 2, 3, pal.light);
      px(6, -59 + bob, 2, 3, pal.metal);
      px(4, -62 + bob, 2, 3, pal.metal);
      px(3, -64 + bob, 2, 2, pal.light);
      px(-4, -53 + bob, 3, 1, pal.accent);
    }

    px(-16, -44 + bob, 9, 11, pal.outline);
    px(-15, -43 + bob, 7, 9, pal.dark);
    px(-15, -43 + bob, 7, 2, pal.metal);
    px(-13, -38 + bob, 3, 2, pal.accent);

    px(7, -46 + bob, 10, 12, pal.outline);
    px(8, -45 + bob, 8, 10, pal.mid);
    px(8, -45 + bob, 8, 2, pal.pale);
    px(9, -40 + bob, 6, 3, pal.metal);

    if (f.id === "p2") {
      px(13, -49 + bob, 3, 3, pal.accent);
      px(-17, -47 + bob, 3, 3, pal.accent);
    } else {
      px(10, -46 + bob, 2, 2, pal.accent);
    }

    if (f.victory) {
      px(10, -52 + bob, 5, 14, pal.outline);
      px(11, -51 + bob, 3, 12, pal.dark);
      px(9, -58 + bob, 7, 7, pal.outline);
      px(10, -57 + bob, 5, 5, pal.metal);
      px(12, -60 + bob, 2, 2, pal.accent);
      px(12, -64 + bob, 2, 2, pal.core);
    } else {
      const rx = f.action === "shoot" ? Math.round(Math.max(0, 1 - f.actionTime / 0.26) * -4) : 0;
      px(9, -40 + bob, 5, 10, pal.outline);
      px(10, -39 + bob, 3, 8, pal.light);
      px(11 + rx, -35 + bob, 13, 7, pal.outline);
      px(12 + rx, -34 + bob, 11, 5, pal.mid);
      px(12 + rx, -34 + bob, 11, 2, pal.light);
      px(21 + rx, -33 + bob, 5, 3, pal.metal);
      px(25 + rx, -33 + bob, 2, 3, pal.accent);
      if (f.action === "shoot") {
        g.globalAlpha = 0.55;
        px(27 + rx, -34 + bob, 3, 5, pal.core);
        g.globalAlpha = 1;
      }
    }

    if (f.guarding) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 16);
      g.save();
      g.globalAlpha = 0.14 + pulse * 0.08;
      g.fillStyle = pal.accent;
      g.beginPath();
      g.arc(15, -30 + bob, 17, -1.15, 1.15);
      g.closePath();
      g.fill();
      g.restore();
      g.globalAlpha = 0.24 + pulse * 0.1;
      px(5, -45 + bob, 10, 28, pal.accent);
      g.globalAlpha = 1;
      for (let i = 0; i < 12; i++) {
        const a = -1.1 + (i / 11) * 2.2;
        const rx2 = 15 + Math.cos(a) * 18;
        const ry2 = -30 + bob + Math.sin(a) * 18;
        px(rx2 - 1, ry2 - 1, i % 3 === 0 ? 3 : 2, i % 3 === 0 ? 3 : 2, i % 4 === 0 ? pal.core : pal.accent);
      }
    }

    if (f.action === "melee") {
      const k = clamp(f.actionTime / 0.4, 0, 1);
      const ang = -1.2 + k * 2.2;
      g.save();
      g.translate(11, -30 + bob);
      g.rotate(ang);
      g.globalAlpha = 0.9 - Math.abs(k - 0.5) * 0.55;
      g.fillStyle = pal.accent;
      g.fillRect(0, -1, 26, 3);
      g.fillStyle = pal.core;
      g.fillRect(2, -1, 22, 1);
      g.restore();
      for (let i = 0; i < 5; i++) {
        const aa = ang - 0.5 + i * 0.22;
        px(
          13 + Math.cos(aa) * 24,
          -30 + bob + Math.sin(aa) * 24,
          2,
          2,
          i % 2 ? pal.core : pal.accent
        );
      }
      g.globalAlpha = 1;
    }

    if (air > 4) {
      const fl = 3 + Math.round(Math.random() * 3);
      px(-6, 0, 3, fl, pal.flame);
      px(2, 0, 3, fl, pal.flame);
      px(-5, fl - 1, 1, 1, pal.core);
    }
  }

  function drawMech(f, t) {
    const air = Math.max(0, GROUND - f.y);
    const sw = clamp(30 - air * 0.18, 12, 30);
    ctx.fillStyle = "rgba(2,6,11," + (0.48 - Math.min(0.3, air * 0.004)) + ")";
    ctx.fillRect(Math.round(f.x - sw / 2), GROUND, Math.round(sw), 2);
    ctx.fillRect(Math.round(f.x - sw / 2) + 3, GROUND + 2, Math.round(sw) - 6, 1);

    ctx.save();
    ctx.translate(Math.round(f.x), Math.round(f.y));
    if (f.hitstun > 0 && f.koTime <= 0) {
      ctx.translate(Math.round(Math.sin(t * 72) * 1.5), 0);
    }
    ctx.scale(f.facing, 1);
    if (f.koTime > 0) {
      const k = clamp(f.koTime / 0.6, 0, 1);
      const fall = k * k * (3 - 2 * k);
      ctx.translate(0, -24);
      ctx.rotate(-fall * 1.32);
      ctx.translate(0, 24);
    }

    mechShape(ctx, f, PAL[f.id], t);
    if (f.hurtFlash > 0) {
      ctx.globalAlpha = clamp(f.hurtFlash * 2.6, 0, 0.62);
      mechShape(ctx, f, WHITE_PAL, t);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawProjectiles() {
    for (let i = 0; i < projectiles.length; i++) {
      const pr = projectiles[i];
      const cyan = pr.owner === P;
      const x = Math.round(pr.x);
      const y = Math.round(pr.y);
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = cyan ? "#55f6ff" : "#ff9a5a";
      ctx.fillRect(x - 7, y - 3, 14, 6);
      ctx.globalAlpha = 1;
      ctx.fillStyle = cyan ? "#a9f2ff" : "#ffe1b0";
      ctx.fillRect(x - 4, y - 2, 8, 4);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x - 1, y - 1, 3, 2);
      ctx.fillStyle = cyan ? "rgba(85,246,255,0.65)" : "rgba(255,154,90,0.65)";
      const dir = pr.vx > 0 ? -1 : 1;
      ctx.fillRect(x + dir * 7, y - 1, 3, 2);
    }
  }

  function drawParticles() {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const a = clamp(p.life / p.maxLife, 0, 1);
      if (p.glow) {
        ctx.globalAlpha = a * 0.22;
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, p.size + 2, p.size + 2);
      }
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawPopups() {
    ctx.textAlign = "center";
    ctx.font = "bold 9px 'Courier New', monospace";
    for (let i = 0; i < popups.length; i++) {
      const p = popups[i];
      ctx.globalAlpha = clamp((p.life / p.maxLife) * 1.4, 0, 1);
      ctx.fillStyle = "rgba(2,6,10,0.75)";
      ctx.fillText(p.text, p.x + 1, p.y + 1);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
  }

  /* ---------------- 7. HUD / main loop ---------------- */

  function updateHud() {
    const hp1 = clamp(P.hp / P.maxHp, 0, 1);
    const hp2 = clamp(E.hp / E.maxHp, 0, 1);
    UI.hp1Fill.style.transform = "scaleX(" + hp1 + ")";
    UI.hp1Ghost.style.transform = "scaleX(" + hp1 + ")";
    UI.hp2Fill.style.transform = "scaleX(" + hp2 + ")";
    UI.hp2Ghost.style.transform = "scaleX(" + hp2 + ")";

    const n1 = Math.max(0, Math.ceil(P.hp));
    const n2 = Math.max(0, Math.ceil(E.hp));
    if (UI.hp1Num.textContent !== String(n1)) UI.hp1Num.textContent = String(n1);
    if (UI.hp2Num.textContent !== String(n2)) UI.hp2Num.textContent = String(n2);
    UI.hp1Bar.classList.toggle("low", P.hp <= 25);
    UI.hp2Bar.classList.toggle("low", E.hp <= 25);
    UI.hp1Bar.setAttribute("aria-valuenow", String(n1));
    UI.hp2Bar.setAttribute("aria-valuenow", String(n2));

    const sh1 = clamp(P.shield / P.maxShield, 0, 1);
    const sh2 = clamp(E.shield / E.maxShield, 0, 1);
    UI.shield1Fill.style.transform = "scaleX(" + sh1 + ")";
    UI.shield2Fill.style.transform = "scaleX(" + sh2 + ")";
    UI.shield1Bar.classList.toggle("broken", P.guardBreak > 0);
    UI.shield2Bar.classList.toggle("broken", E.guardBreak > 0);
    UI.shield1Bar.setAttribute("aria-valuenow", String(Math.round(sh1 * 100)));
    UI.shield2Bar.setAttribute("aria-valuenow", String(Math.round(sh2 * 100)));

    const secs = Math.max(0, Math.ceil(game.roundTime));
    const txt = secs < 10 ? "0" + secs : String(secs);
    if (UI.timer.textContent !== txt) UI.timer.textContent = txt;
    UI.timer.classList.toggle("danger", secs <= 10);
  }

  function render() {
    const t = game.time;
    ctx.fillStyle = "#04070d";
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    if (game.shake > 0) {
      const amp = game.shakePower * Math.min(1, game.shake * 2.2);
      ctx.translate(Math.round(rand(-amp, amp)), Math.round(rand(-amp, amp)));
    }
    ctx.drawImage(backdrop, 0, 0);
    drawDynamicBackdrop(t);
    drawAmbient(t);
    drawProjectiles();
    drawMech(E, t);
    drawMech(P, t);
    drawParticles();
    drawPopups();
    ctx.restore();

    if (game.flash > 0) {
      ctx.fillStyle = "rgba(232,250,255," + clamp(game.flash, 0, 0.5) + ")";
      ctx.fillRect(0, 0, W, H);
    }
  }

  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    if (game.mode !== "paused") game.time += dt;

    if (game.mode === "playing") {
      updateBattle(dt);
    } else if (game.mode === "menu") {
      P.moveIntent = 0;
      E.moveIntent = 0;
      P.guarding = false;
      E.guarding = false;
    } else if (game.mode === "result") {
      updateParticles(dt);
      updatePopups(dt);
      game.flash = Math.max(0, game.flash - dt * 2.6);
      game.shake = Math.max(0, game.shake - dt);
      if (game.shake <= 0) game.shakePower = 0;
    }

    if (game.mode !== "paused") updateAmbient(dt, game.time);
    render();
    requestAnimationFrame(frame);
  }

  resetFighters();
  updateHud();
  requestAnimationFrame(frame);
})();
