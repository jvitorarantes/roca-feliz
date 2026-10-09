// Sons da Roça Feliz: 3 músicas calmas e efeitos, tudo sintetizado no navegador (Web Audio).
// Nada é baixado: as notas estão escritas aqui e os instrumentos são montados com osciladores.
(() => {
  'use strict';
  const AC = window.AudioContext || window.webkitAudioContext;
  let ac = null, master, musicBus, sfxBus, noiseBuf;
  const cfg = { music: true, sfx: true, musicVol: 0.5, sfxVol: 0.7, track: 0 };

  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  function ensure() {
    if (ac || !AC) return ac;
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination);
    musicBus = ac.createGain(); sfxBus = ac.createGain();
    // Um pouco de "sala" (reverb) deixa a música mais macia.
    const rev = ac.createConvolver(); rev.buffer = impulse(2.4);
    const revGain = ac.createGain(); revGain.gain.value = 0.28;
    musicBus.connect(master); musicBus.connect(rev); rev.connect(revGain); revGain.connect(master);
    sfxBus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVolumes();
    document.addEventListener('visibilitychange', () => {
      if (!ac) return;
      if (document.hidden) ac.suspend(); else if (unlocked) ac.resume();
    });
    return ac;
  }
  function impulse(sec) {
    const len = Math.floor(ac.sampleRate * sec), b = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return b;
  }
  function applyVolumes() {
    if (!ac) return;
    const t = ac.currentTime;
    musicBus.gain.setTargetAtTime(cfg.music ? cfg.musicVol * 0.55 : 0, t, 0.15);
    sfxBus.gain.setTargetAtTime(cfg.sfx ? cfg.sfxVol * 0.8 : 0, t, 0.03);
  }

  // ---------- Instrumentos ----------
  function env(g, t, a, peak, dec, sus, rel, end) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * sus), t + a + dec);
    g.gain.setValueAtTime(Math.max(0.0001, peak * sus), end);
    g.gain.exponentialRampToValueAtTime(0.0001, end + rel);
  }
  function osc(type, f, t, stop, dest, detune = 0) {
    const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = detune;
    o.connect(dest); o.start(t); o.stop(stop); return o;
  }
  function lowpass(f, q = 0.7) { const b = ac.createBiquadFilter(); b.type = 'lowpass'; b.frequency.value = f; b.Q.value = q; return b; }

  // Corda dedilhada (violão/viola): ataque rápido, decaimento longo, brilho que some.
  function pluck(bus, t, m, dur, vel = 0.2, bright = 2600) {
    const f = lowpass(bright, 1); f.frequency.setValueAtTime(bright, t); f.frequency.exponentialRampToValueAtTime(500, t + 1.2);
    const g = ac.createGain(); f.connect(g); g.connect(bus);
    const end = t + Math.max(0.5, dur * 1.6);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, end);
    osc('triangle', mtof(m), t, end + 0.05, f);
    osc('sine', mtof(m + 12), t, end + 0.05, f, 4).frequency.value = mtof(m + 12);
    osc('sawtooth', mtof(m), t, t + 0.08, f, -5);
  }
  // Flauta doce: seno com vibrato que entra devagar.
  function flute(bus, t, m, dur, vel = 0.11) {
    const g = ac.createGain(), f = lowpass(3200); f.connect(g); g.connect(bus);
    const end = t + dur;
    env(g, t, 0.07, vel, 0.2, 0.8, 0.25, end);
    const o = osc('sine', mtof(m), t, end + 0.3, f);
    const o2 = osc('triangle', mtof(m), t, end + 0.3, f); o2.detune.value = 3;
    const lfo = ac.createOscillator(), lg = ac.createGain();
    lfo.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(mtof(m) * 0.006, t + 0.35);
    lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency); lfo.start(t); lfo.stop(end + 0.3);
  }
  // Sanfona suave: duas ondas levemente desafinadas, filtradas.
  function accordion(bus, t, m, dur, vel = 0.05) {
    const g = ac.createGain(), f = lowpass(1500, 1.2); f.connect(g); g.connect(bus);
    const end = t + dur;
    env(g, t, 0.05, vel, 0.1, 0.85, 0.18, end);
    osc('sawtooth', mtof(m), t, end + 0.25, f, -7);
    osc('sawtooth', mtof(m), t, end + 0.25, f, 7);
    osc('square', mtof(m - 12), t, end + 0.25, f).detune.value = 0;
    const trem = ac.createOscillator(), tg = ac.createGain();
    trem.frequency.value = 4.5; tg.gain.value = vel * 0.25; trem.connect(tg); tg.connect(g.gain); trem.start(t); trem.stop(end + 0.25);
  }
  // Sininho / xilofone de brinquedo: som cristalino que some rápido.
  function sino(bus, t, m, dur, vel = 0.12) {
    const g = ac.createGain(); g.connect(bus);
    const end = t + Math.max(0.4, dur * 1.3);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, end);
    osc('sine', mtof(m), t, end + 0.05, g);
    osc('triangle', mtof(m + 12), t, t + end - t + 0.05, g, 3);
    const g2 = ac.createGain(); g2.gain.value = 0.25; g2.connect(g); osc('sine', mtof(m + 19), t, t + 0.3, g2);
  }
  function bass(bus, t, m, dur, vel = 0.16) {
    const g = ac.createGain(), f = lowpass(700); f.connect(g); g.connect(bus);
    const end = t + dur;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, end + 0.3);
    osc('triangle', mtof(m), t, end + 0.35, f); osc('sine', mtof(m), t, end + 0.35, f);
  }
  function shaker(bus, t, vel = 0.03) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const b = ac.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = 7000; b.Q.value = 1.5;
    const g = ac.createGain(); s.connect(b); b.connect(g); g.connect(bus);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    s.start(t, Math.random() * 0.5); s.stop(t + 0.1);
  }

  // ---------- Rock rural: guitarra com distorção, bateria e baixo ----------
  let distIn = null;
  function distorcao() {
    if (distIn && distIn.context === ac) return distIn;
    const ws = ac.createWaveShaper(), n = 1024, curva = new Float32Array(n), k = 28;
    for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; curva[i] = (1 + k) * x / (1 + k * Math.abs(x)); }
    ws.curve = curva; ws.oversample = '2x';
    const f = lowpass(2800, 0.9), g = ac.createGain(); g.gain.value = 0.3;
    ws.connect(f); f.connect(g); g.connect(musicBus);
    return (distIn = ws);
  }
  // Power chord (tônica, quinta e oitava); "abafado" é a palhetada com a mão na ponte.
  function guitarra(t, m, dur, vel = 0.1, abafado = false) {
    const g = ac.createGain(); g.connect(distorcao());
    const end = t + dur;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.005);
    g.gain.exponentialRampToValueAtTime(abafado ? 0.0001 : vel * 0.5, abafado ? t + 0.12 : end); g.gain.linearRampToValueAtTime(0.0001, end + 0.05);
    for (const [iv, dt] of [[0, -6], [7, 5], [12, 0]]) osc('sawtooth', mtof(m + iv), t, end + 0.08, g, dt);
  }
  function solo(t, m, dur, vel = 0.07) {
    const g = ac.createGain(); g.connect(distorcao());
    const end = t + dur;
    env(g, t, 0.01, vel, 0.1, 0.7, 0.08, end);
    const o = osc('square', mtof(m), t, end + 0.12, g), o2 = osc('sawtooth', mtof(m), t, end + 0.12, g, 8);
    const lfo = ac.createOscillator(), lg = ac.createGain();
    lfo.frequency.value = 6; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(mtof(m) * 0.012, t + Math.min(0.3, dur));
    lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency); lfo.start(t); lfo.stop(end + 0.12);
  }
  function bumbo(t, vel = 0.5) {
    const g = ac.createGain(); g.connect(musicBus);
    g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    const o = osc('sine', 120, t, t + 0.3, g); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
  }
  function caixa(t, vel = 0.18) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const b = ac.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = 1900; b.Q.value = 0.8;
    const g = ac.createGain(); s.connect(b); b.connect(g); g.connect(musicBus);
    g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    s.start(t, Math.random() * 0.5); s.stop(t + 0.2);
    const tg = ac.createGain(); tg.connect(musicBus); tg.gain.setValueAtTime(vel * 0.5, t); tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    osc('triangle', 190, t, t + 0.1, tg);
  }

  // ---------- As músicas ----------
  // Cada compasso: acorde (notas MIDI) + melodia [nota, duração em colcheias] (0 = pausa).
  const N = { C4: 60, D4: 62, E4: 64, F4: 65, Fs4: 66, G4: 67, A4: 69, B4: 71, C5: 72, Cs5: 73, D5: 74, E5: 76, F5: 77, Fs5: 78, G5: 79, A5: 81, B5: 83, C6: 84 };
  const TRACKS = [
    { // Violão dedilhado e flauta, 4/4
      nome: 'Manhã no Campo', bpm: 86, steps: 8, lead: 'flute', shaker: true,
      chords: [[48, 60, 64, 67], [53, 60, 65, 69], [48, 60, 64, 67], [43, 59, 62, 67], [45, 60, 64, 69], [53, 60, 65, 69], [43, 59, 62, 67], [48, 60, 64, 67]],
      arp: [1, 2, 3, 2, 1, 2, 3, 2],
      melody: [
        [[N.E5, 2], [N.G5, 2], [N.A5, 2], [N.G5, 2]],
        [[N.A5, 3], [N.G5, 1], [N.F5, 2], [N.E5, 2]],
        [[N.E5, 2], [N.D5, 2], [N.C5, 2], [N.D5, 2]],
        [[N.E5, 4], [N.D5, 4]],
        [[N.C6, 2], [N.A5, 2], [N.G5, 2], [N.E5, 2]],
        [[N.F5, 2], [N.A5, 2], [N.G5, 4]],
        [[N.E5, 2], [N.D5, 2], [N.C5, 2], [N.D5, 2]],
        [[N.C5, 8]],
      ],
    },
    { // Valsa lenta de sanfona, 3/4
      nome: 'Rede na Varanda', bpm: 70, steps: 6, lead: 'accordion', waltz: true,
      chords: [[43, 59, 62, 67], [40, 59, 64, 67], [48, 60, 64, 67], [50, 57, 62, 66], [43, 59, 62, 67], [48, 60, 64, 67], [50, 57, 62, 66], [43, 59, 62, 67]],
      melody: [
        [[N.B4, 2], [N.D5, 2], [N.G5, 2]],
        [[N.G5, 4], [N.E5, 2]],
        [[N.E5, 2], [N.G5, 2], [N.E5, 2]],
        [[N.D5, 6]],
        [[N.B4, 2], [N.D5, 2], [N.G5, 2]],
        [[N.A5, 3], [N.G5, 1], [N.E5, 2]],
        [[N.Fs5, 2], [N.E5, 2], [N.D5, 2]],
        [[N.G5, 6]],
      ],
    },
    { // Viola caipira em terças, 4/4
      nome: 'Viola ao Entardecer', bpm: 92, steps: 8, lead: 'viola', shaker: false,
      chords: [[50, 62, 66, 69], [43, 59, 62, 67], [50, 62, 66, 69], [45, 61, 64, 69], [50, 62, 66, 69], [43, 59, 62, 67], [45, 61, 64, 69], [50, 62, 66, 69]],
      arp: [0, 2, 1, 3, 2, 1, 3, 2],
      melody: [
        [[N.Fs5, 2], [N.A5, 2], [N.Fs5, 2], [N.E5, 2]],
        [[N.D5, 2], [N.E5, 2], [N.G5, 4]],
        [[N.Fs5, 2], [N.E5, 2], [N.D5, 4]],
        [[N.E5, 4], [N.A4, 4]],
        [[N.A5, 2], [N.B5, 2], [N.A5, 2], [N.Fs5, 2]],
        [[N.G5, 2], [N.B5, 2], [N.A5, 4]],
        [[N.G5, 2], [N.Fs5, 2], [N.E5, 4]],
        [[N.D5, 8]],
      ],
    },
    { // Rock rural: guitarra, bateria, baixo e viola fazendo a segunda voz, 4/4
      nome: 'Rock na Porteira', bpm: 132, steps: 8, lead: 'rock', rock: true,
      chords: [[40], [36], [43], [38], [40], [36], [38], [40]],
      melody: [
        [[N.E5, 1], [N.G5, 1], [N.A5, 2], [N.G5, 1], [N.E5, 1], [N.D5, 2]],
        [[N.E5, 3], [N.G5, 1], [N.E5, 2], [0, 2]],
        [[N.D5, 1], [N.D5, 1], [N.G5, 2], [N.A5, 2], [N.B5, 2]],
        [[N.A5, 4], [N.Fs5, 2], [N.D5, 2]],
        [[N.B5, 2], [N.A5, 1], [N.G5, 1], [N.A5, 2], [N.B5, 2]],
        [[N.G5, 2], [N.E5, 2], [N.G5, 2], [N.A5, 2]],
        [[N.Fs5, 2], [N.A5, 2], [N.D5, 2], [N.E5, 2]],
        [[N.E5, 6], [0, 2]],
      ],
    },
    { // Exclusiva da Loja do Trevo: moda de viola em sol, com a viola fazendo a melodia em terças
      nome: 'Moda de Viola', bpm: 100, steps: 8, lead: 'viola', shaker: false, trevo: true,
      chords: [[43, 59, 62, 67], [48, 60, 64, 67], [50, 62, 66, 69], [43, 59, 62, 67], [40, 59, 64, 67], [48, 60, 64, 67], [50, 62, 66, 69], [43, 59, 62, 67]],
      arp: [0, 3, 2, 3, 1, 3, 2, 3],
      melody: [
        [[N.B4, 2], [N.D5, 2], [N.G5, 3], [N.Fs5, 1]],
        [[N.E5, 2], [N.G5, 2], [N.E5, 2], [N.C5, 2]],
        [[N.D5, 3], [N.E5, 1], [N.Fs5, 2], [N.A5, 2]],
        [[N.G5, 6], [0, 2]],
        [[N.E5, 2], [N.G5, 2], [N.B5, 2], [N.A5, 2]],
        [[N.G5, 2], [N.E5, 2], [N.C5, 4]],
        [[N.D5, 2], [N.Fs5, 2], [N.A5, 2], [N.Fs5, 2]],
        [[N.G5, 8]],
      ],
    },
    { // Exclusiva da Loja do Trevo: forró com sanfona, zabumba (baixo no ritmo de baião) e triângulo
      nome: 'Forró na Roça', bpm: 118, steps: 8, lead: 'accordion', shaker: true, baiao: true, trevo: true,
      chords: [[50, 62, 66, 69], [50, 62, 66, 69], [45, 61, 64, 69], [45, 61, 64, 69], [43, 59, 62, 67], [45, 61, 64, 69], [50, 62, 66, 69], [50, 62, 66, 69]],
      arp: [1, 2, 3, 2, 1, 2, 3, 2],
      melody: [
        [[N.A5, 1], [N.A5, 1], [N.Fs5, 1], [N.D5, 1], [N.E5, 2], [N.Fs5, 2]],
        [[N.A5, 3], [N.G5, 1], [N.Fs5, 4]],
        [[N.E5, 1], [N.E5, 1], [N.Cs5, 1], [N.A4, 1], [N.B4, 2], [N.Cs5, 2]],
        [[N.E5, 3], [N.D5, 1], [N.Cs5, 4]],
        [[N.B4, 2], [N.D5, 2], [N.G5, 2], [N.Fs5, 2]],
        [[N.E5, 2], [N.Cs5, 2], [N.A4, 2], [N.Cs5, 2]],
        [[N.D5, 2], [N.Fs5, 2], [N.A5, 2], [N.Fs5, 2]],
        [[N.D5, 6], [0, 2]],
      ],
    },
    { // Exclusiva da Loja do Trevo: valsa de flauta e violão, para a noite
      nome: 'Seresta ao Luar', bpm: 74, steps: 6, lead: 'flute', waltz: true, trevo: true,
      chords: [[48, 60, 64, 67], [45, 60, 64, 69], [41, 60, 65, 69], [43, 59, 62, 67], [48, 60, 64, 67], [40, 59, 64, 67], [41, 60, 65, 69], [43, 59, 62, 67]],
      melody: [
        [[N.E5, 2], [N.G5, 2], [N.C6, 2]],
        [[N.A5, 4], [N.E5, 2]],
        [[N.F5, 2], [N.A5, 2], [N.C6, 2]],
        [[N.B5, 4], [N.G5, 2]],
        [[N.E5, 2], [N.G5, 2], [N.C6, 2]],
        [[N.B5, 3], [N.A5, 1], [N.G5, 2]],
        [[N.A5, 2], [N.F5, 2], [N.D5, 2]],
        [[N.C5, 6]],
      ],
    },
    { // Dia das Crianças: cirandinha de sininhos, alegre e saltitante, 4/4
      nome: 'Ciranda das Crianças', bpm: 126, steps: 8, lead: 'bell', shaker: true,
      chords: [[48, 60, 64, 67], [53, 60, 65, 69], [48, 60, 64, 67], [43, 59, 62, 67], [48, 60, 64, 67], [53, 60, 65, 69], [43, 59, 62, 67], [48, 60, 64, 67]],
      arp: [1, 2, 3, 2, 1, 2, 3, 2],
      melody: [
        [[N.E5, 1], [N.E5, 1], [N.G5, 2], [N.G5, 1], [N.E5, 1], [N.C5, 2]],
        [[N.F5, 1], [N.F5, 1], [N.A5, 2], [N.A5, 1], [N.F5, 1], [N.C5, 2]],
        [[N.E5, 1], [N.E5, 1], [N.G5, 2], [N.G5, 1], [N.E5, 1], [N.C5, 2]],
        [[N.D5, 2], [N.B4, 2], [N.D5, 4]],
        [[N.C5, 1], [N.E5, 1], [N.G5, 2], [N.C6, 2], [N.G5, 2]],
        [[N.A5, 2], [N.G5, 2], [N.F5, 2], [N.A5, 2]],
        [[N.G5, 2], [N.F5, 2], [N.D5, 2], [N.B4, 2]],
        [[N.C5, 6], [0, 2]],
      ],
    },
  ];
  // Terça abaixo dentro de ré maior (a "segunda voz" da viola).
  const D_MAJOR = [2, 4, 6, 7, 9, 11, 1];
  function thirdBelow(m) {
    for (let k = 3; k <= 4; k++) if (D_MAJOR.includes(((m - k) % 12 + 12) % 12)) return m - k;
    return m - 3;
  }

  let playing = false, timer = null, step = 0, loop = 0, nextTime = 0;
  function startMusic() {
    if (!ac || playing || !cfg.music) return;
    playing = true; step = 0; loop = 0; nextTime = ac.currentTime + 0.15;
    timer = setInterval(schedule, 90);
    schedule();
  }
  function stopMusic() {
    playing = false;
    if (timer) { clearInterval(timer); timer = null; }
  }
  function schedule() {
    if (!playing) return;
    const tr = TRACKS[cfg.track] || TRACKS[0];
    const eighth = 60 / tr.bpm / 2, barLen = tr.steps, total = barLen * tr.chords.length;
    while (nextTime < ac.currentTime + 0.4) {
      const bar = Math.floor(step / barLen), s = step % barLen, t = nextTime;
      const ch = tr.chords[bar];
      // A melodia descansa de vez em quando (a cada 3ª volta) para a música respirar.
      const withMelody = loop % 3 !== 2;
      if (tr.rock) {
        // bateria: bumbo no 1, no "e" do 2 e no 3; caixa no 2 e no 4; chimbal em todas as colcheias
        if (s === 0 || s === 3 || s === 4) bumbo(t);
        if (s === 2 || s === 6) caixa(t);
        shaker(musicBus, t, s % 2 ? 0.025 : 0.045);
        bass(musicBus, t, ch[0] - 12, eighth * 0.9, 0.17);
        // guitarra: acento no 1 e na síncope, o resto abafado
        const acento = s === 0 || s === 3 || s === 6;
        guitarra(t, ch[0] + 12, acento ? eighth * (s === 6 ? 2 : 1.5) : eighth * 0.9, acento ? 0.11 : 0.07, !acento);
        if (withMelody) {
          let pos = 0;
          for (const [m, len] of tr.melody[bar]) {
            if (pos === s && m) {
              const d = len * eighth;
              if (loop % 3 === 1) solo(t, m, d * 0.95);          // na 2ª volta, a guitarra sola
              else { pluck(musicBus, t, m, d, 0.14, 4000); pluck(musicBus, t + 0.012, thirdBelow(m), d, 0.1, 3400); } // a viola em terças
            }
            pos += len;
          }
        }
        nextTime += eighth; step++;
        if (step >= total) { step = 0; loop++; }
        continue;
      }
      if (s === 0) bass(musicBus, t, ch[0] - 12 + (tr.waltz ? 12 : 0), eighth * (tr.waltz ? 2 : 3));
      if (tr.baiao && s === 3) bass(musicBus, t, ch[0] - 12, eighth, 0.14);          // a zabumba do baião
      if (!tr.waltz && s === 4) bass(musicBus, t, ch[0] - 5, eighth * 3, 0.1); // a quinta, uma oitava abaixo
      if (tr.waltz) {
        if (s === 2 || s === 4) for (const n of ch.slice(1)) pluck(musicBus, t, n, eighth * 1.5, 0.05, 1800);
      } else {
        const n = ch[tr.arp[s]];
        pluck(musicBus, t, n, eighth * 2, tr.lead === 'viola' ? 0.1 : 0.085, tr.lead === 'viola' ? 3400 : 2400);
      }
      if (tr.shaker && s % 2 === 1) shaker(musicBus, t);
      if (withMelody) {
        let pos = 0;
        for (const [m, len] of tr.melody[bar]) {
          if (pos === s && m) {
            const d = len * eighth;
            if (tr.lead === 'flute') flute(musicBus, t, m, d * 0.95);
            else if (tr.lead === 'accordion') accordion(musicBus, t, m, d * 0.92);
            else if (tr.lead === 'bell') sino(musicBus, t, m, d);
            else { pluck(musicBus, t, m, d, 0.13, 3800); pluck(musicBus, t + 0.012, thirdBelow(m), d, 0.09, 3200); }
          }
          pos += len;
        }
      }
      nextTime += eighth;
      step++;
      if (step >= total) { step = 0; loop++; }
    }
  }

  // ---------- Efeitos ----------
  function noise(t, dur, type, f0, f1, vel, q = 1) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const b = ac.createBiquadFilter(); b.type = type; b.Q.value = q;
    b.frequency.setValueAtTime(f0, t); b.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ac.createGain(); s.connect(b); b.connect(g); g.connect(sfxBus);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + Math.min(0.02, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.start(t, Math.random() * 0.4); s.stop(t + dur + 0.05);
  }
  function blip(t, type, f0, f1, dur, vel) {
    const o = ac.createOscillator(), g = ac.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    o.connect(g); g.connect(sfxBus);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.02);
  }
  // Voz de bicho: oscilador com glissando, filtro e um tremido (vibrato) opcional.
  function voz(t, { tipo = 'sawtooth', f = [[0, 400]], dur = 0.3, vel = 0.2, filtro = 1400, q = 1.5, vib = 0, vibD = 0, passa = 'bandpass' }) {
    const o = ac.createOscillator(), b = ac.createBiquadFilter(), g = ac.createGain();
    o.type = tipo; b.type = passa; b.frequency.value = filtro; b.Q.value = q;
    o.frequency.setValueAtTime(f[0][1], t); for (const [dt, fr] of f.slice(1)) o.frequency.linearRampToValueAtTime(fr, t + dt);
    if (vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = vib; lg.gain.value = vibD; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.05); }
    o.connect(b); b.connect(g); g.connect(sfxBus);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + Math.min(0.03, dur / 4)); g.gain.setValueAtTime(vel, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.05);
  }
  const muu = (t, f0, dur) => voz(t, { f: [[0, f0], [dur * 0.3, f0 * 1.15], [dur, f0 * 0.85]], dur, vel: 0.35, filtro: 700, q: 1, passa: 'lowpass', vib: 5, vibD: 4 });
  const mee = (t, f0) => voz(t, { f: [[0, f0], [0.5, f0 * 0.95]], dur: 0.55, vel: 0.22, filtro: 1400, q: 2, vib: 9, vibD: f0 * 0.09 });
  const oinc = t => { for (const d of [0, 0.16]) { voz(t + d, { tipo: 'square', f: [[0, 260], [0.1, 180]], dur: 0.12, vel: 0.18, filtro: 700, q: 2 }); noise(t + d, 0.1, 'bandpass', 700, 500, 0.1, 3); } };
  const cacarejo = t => { for (let k = 0; k < 3; k++) voz(t + k * 0.1, { tipo: 'square', f: [[0, 720], [0.06, 560]], dur: 0.07, vel: 0.1, filtro: 1500, q: 3 }); voz(t + 0.34, { tipo: 'square', f: [[0, 600], [0.25, 950]], dur: 0.3, vel: 0.12, filtro: 1700, q: 3 }); };
  const relincho = (t, f0) => voz(t, { f: [[0, f0], [0.2, f0 * 1.3], [0.8, f0 * 0.55]], dur: 0.85, vel: 0.2, filtro: 1500, q: 2, vib: 13, vibD: f0 * 0.12 });
  const BICHOS = {
    galinha: cacarejo,
    angola: t => { for (let k = 0; k < 3; k++) { voz(t + k * 0.24, { f: [[0, 1300], [0.08, 1000]], dur: 0.09, vel: 0.15, filtro: 1500, q: 4 }); voz(t + k * 0.24 + 0.1, { f: [[0, 1100], [0.1, 800]], dur: 0.11, vel: 0.15, filtro: 1300, q: 4 }); } },
    pato: t => { for (const d of [0, 0.22]) voz(t + d, { f: [[0, 430], [0.16, 320]], dur: 0.18, vel: 0.25, filtro: 1100, q: 5 }); },
    coelho: t => { blip(t, 'sine', 1800, 2400, 0.06, 0.08); blip(t + 0.1, 'sine', 1900, 2500, 0.06, 0.07); noise(t + 0.2, 0.12, 'highpass', 3000, 4000, 0.05); },
    cabra: t => mee(t, 420), ovelha: t => mee(t, 330),
    vaca: t => muu(t, 140, 1.0), bufala: t => muu(t, 115, 1.1), bezerro: t => muu(t, 230, 0.7),
    porco: oinc, porca: oinc,
    cavalo: t => relincho(t, 800), potro: t => relincho(t, 1000),
    burro: t => { for (let k = 0; k < 2; k++) { voz(t + k * 0.55, { f: [[0, 750], [0.2, 700]], dur: 0.22, vel: 0.22, filtro: 1400, q: 1.5 }); voz(t + k * 0.55 + 0.25, { f: [[0, 260], [0.25, 230]], dur: 0.27, vel: 0.25, filtro: 800, q: 1.5 }); } },
    abelha: t => voz(t, { f: [[0, 220], [0.8, 240]], dur: 0.85, vel: 0.12, filtro: 1600, q: 1, passa: 'lowpass', vib: 28, vibD: 25 }),
    pavao: t => { for (const d of [0, 0.4]) voz(t + d, { f: [[0, 1100], [0.3, 1600]], dur: 0.32, vel: 0.15, filtro: 1800, q: 3 }); },
    avestruz: t => { for (const d of [0, 0.35]) blip(t + d, 'sine', 95, 60, 0.3, 0.4); },
    gato: t => voz(t, { tipo: 'triangle', f: [[0, 480], [0.18, 820], [0.5, 460]], dur: 0.55, vel: 0.2, filtro: 2000, q: 1.2 }),
    tartaruga: t => blip(t, 'sine', 300, 260, 0.12, 0.1),
    arara: t => { voz(t, { f: [[0, 1500], [0.22, 900]], dur: 0.25, vel: 0.18, filtro: 2000, q: 2 }); noise(t, 0.2, 'bandpass', 2500, 1500, 0.08, 2); },
  };
  const SFX = {
    click: t => blip(t, 'sine', 880, 620, 0.05, 0.12),
    water: t => { noise(t, 0.5, 'bandpass', 900, 2600, 0.22, 1.2); for (let k = 0; k < 4; k++) blip(t + 0.08 + k * 0.09 + Math.random() * 0.04, 'sine', 1400 + Math.random() * 900, 700, 0.06, 0.05); },
    hoe: t => { blip(t, 'sine', 150, 55, 0.16, 0.45); noise(t, 0.18, 'lowpass', 1400, 300, 0.25); noise(t + 0.05, 0.12, 'bandpass', 2400, 900, 0.08, 2); },
    plant: t => { blip(t, 'sine', 260, 520, 0.09, 0.22); noise(t, 0.08, 'lowpass', 900, 400, 0.1); },
    harvest: t => { [72, 76, 79, 84].forEach((m, k) => pluck(sfxBus, t + k * 0.055, m, 0.25, 0.16, 4200)); noise(t, 0.15, 'highpass', 2000, 3000, 0.05); },
    pest: t => noise(t, 0.35, 'highpass', 5000, 3000, 0.16),
    weed: t => { noise(t, 0.2, 'bandpass', 400, 2200, 0.2, 1.5); blip(t + 0.17, 'sine', 400, 800, 0.06, 0.15); },
    fert: t => { noise(t, 0.3, 'bandpass', 800, 3000, 0.1); for (let k = 0; k < 6; k++) blip(t + 0.05 + k * 0.05, 'sine', 1500 + k * 250, 2200 + k * 250, 0.07, 0.07); },
    // caçada: tiro de espingarda (estouro grave) e o estalo do estilingue
    // alerta de praga na plantação: sirene de dois tons
    alarme: t => { for (let k = 0; k < 3; k++) { blip(t + k * 0.36, 'square', 880, 880, 0.16, 0.07); blip(t + k * 0.36 + 0.18, 'square', 660, 660, 0.16, 0.07); } },
    armadilha: t => { blip(t, 'square', 300, 90, 0.12, 0.2); noise(t, 0.15, 'highpass', 3000, 1200, 0.2); },
    tiro: t => { noise(t, 0.4, 'lowpass', 3200, 180, 0.55); blip(t, 'sine', 140, 40, 0.3, 0.5); },
    estilingue: t => { blip(t, 'triangle', 280, 950, 0.09, 0.16); noise(t + 0.02, 0.07, 'highpass', 3000, 5200, 0.06); },
    uivo: t => voz(t, { f: [[0, 300], [0.4, 700], [1.2, 420]], dur: 1.3, vel: 0.22, filtro: 1200, q: 2, vib: 6, vibD: 25 }),
    coin: t => { blip(t, 'square', 988, 988, 0.07, 0.06); blip(t + 0.07, 'square', 1319, 1319, 0.18, 0.06); },
    buy: t => { blip(t, 'sine', 180, 90, 0.15, 0.3); SFX.coin(t + 0.05); },
    level: t => { [60, 64, 67, 72, 76].forEach((m, k) => pluck(sfxBus, t + k * 0.09, m + 12, 0.4, 0.16, 4500)); },
    // Toquinho de viola: um dedilhado curtinho pra avisar que chegou novidade de um amigo.
    aviso: t => { [67, 71, 74].forEach((m, k) => pluck(sfxBus, t + k * 0.045, m, 0.3, 0.14, 3800)); },
    feed: t => { for (let k = 0; k < 3; k++) noise(t + k * 0.07, 0.07, 'bandpass', 3000, 1800, 0.12, 2); },
    collect: t => { pluck(sfxBus, t, 79, 0.3, 0.16, 4000); pluck(sfxBus, t + 0.08, 84, 0.4, 0.16, 4000); },
    error: t => { blip(t, 'square', 220, 200, 0.09, 0.05); blip(t + 0.11, 'square', 185, 165, 0.12, 0.05); },
    // Sapo: dois "croac" graves com o som tremendo.
    sapo: t => {
      for (const d of [0, 0.28]) {
        const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
        o.type = 'sawtooth'; o.frequency.setValueAtTime(150, t + d); o.frequency.linearRampToValueAtTime(110, t + d + 0.18);
        f.type = 'bandpass'; f.frequency.value = 600; f.Q.value = 3;
        lfo.frequency.value = 38; lg.gain.value = 0.25; lfo.connect(lg); lg.connect(g.gain);
        o.connect(f); f.connect(g); g.connect(sfxBus);
        g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.4, t + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.2);
        o.start(t + d); o.stop(t + d + 0.22); lfo.start(t + d); lfo.stop(t + d + 0.22);
      }
    },
    // Grilo: "cri-cri" agudo, em pulsinhos.
    grilo: t => {
      for (let k = 0; k < 6; k++) {
        const d = (k % 3) * 0.045 + Math.floor(k / 3) * 0.3, o = ac.createOscillator(), g = ac.createGain();
        o.type = 'sine'; o.frequency.value = 4400; o.connect(g); g.connect(sfxBus);
        g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.18, t + d + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.035);
        o.start(t + d); o.stop(t + d + 0.04);
      }
    },
    // Porquinho-da-índia: "uíí!" que sobe, duas vezes.
    prea: t => {
      for (const d of [0, 0.22]) {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = 'triangle'; o.frequency.setValueAtTime(900, t + d); o.frequency.exponentialRampToValueAtTime(2000, t + d + 0.16);
        o.connect(g); g.connect(sfxBus);
        g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.25, t + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.18);
        o.start(t + d); o.stop(t + d + 0.2);
      }
    },
    // "fala" do avatar: umas sílabas curtinhas, tipo desenho animado
    fala: t => { [0, 0.09, 0.18, 0.3].forEach((d, k) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime([420, 520, 470, 600][k], t + d); o.frequency.exponentialRampToValueAtTime([380, 480, 430, 700][k], t + d + 0.07); o.connect(g); g.connect(sfxBus); g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.25, t + d + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.08); o.start(t + d); o.stop(t + d + 0.09); }); },
    bark: t => { for (const d of [0, 0.22]) { const o = ac.createOscillator(), b = ac.createBiquadFilter(), g = ac.createGain(); o.type = 'sawtooth'; b.type = 'bandpass'; b.frequency.value = 900; b.Q.value = 2; o.frequency.setValueAtTime(380, t + d); o.frequency.exponentialRampToValueAtTime(170, t + d + 0.14); o.connect(b); b.connect(g); g.connect(sfxBus); g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.35, t + d + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.16); o.start(t + d); o.stop(t + d + 0.2); } },
  };

  // Cada raça de cachorro late de um jeito: tom (f0→f1), quantos latidos, intervalo, duração, timbre e volume.
  const LATIDOS = {
    caramelo:     { f0: 380, f1: 170, n: 2, gap: 0.22, dur: 0.16, filt: 900,  q: 2, type: 'sawtooth', vol: 0.35 },
    pinscher:     { f0: 980, f1: 560, n: 4, gap: 0.12, dur: 0.08, filt: 2400, q: 3, type: 'square',   vol: 0.22 },
    pastor:       { f0: 270, f1: 115, n: 2, gap: 0.32, dur: 0.24, filt: 700,  q: 2, type: 'sawtooth', vol: 0.45 },
    bordercollie: { f0: 600, f1: 330, n: 3, gap: 0.15, dur: 0.11, filt: 1500, q: 2, type: 'sawtooth', vol: 0.3 },
    heeler:       { f0: 500, f1: 230, n: 2, gap: 0.19, dur: 0.13, filt: 1900, q: 5, type: 'square',   vol: 0.28 },
    fila:         { f0: 200, f1: 80,  n: 2, gap: 0.5,  dur: 0.34, filt: 500,  q: 1.5, type: 'sawtooth', vol: 0.5 },
    corso:        { f0: 150, f1: 62,  n: 2, gap: 0.42, dur: 0.3,  filt: 380,  q: 1.5, type: 'sawtooth', vol: 0.55 },
  };
  const latir = (cfgL, t) => {
    for (let k = 0; k < cfgL.n; k++) {
      const d = k * cfgL.gap, o = ac.createOscillator(), b = ac.createBiquadFilter(), g = ac.createGain();
      o.type = cfgL.type; b.type = 'bandpass'; b.frequency.value = cfgL.filt; b.Q.value = cfgL.q;
      const f0 = cfgL.f0 * (1 - 0.04 * k), f1 = cfgL.f1 * (1 - 0.04 * k);
      o.frequency.setValueAtTime(f0, t + d); o.frequency.exponentialRampToValueAtTime(f1, t + d + cfgL.dur * 0.9);
      o.connect(b); b.connect(g); g.connect(sfxBus);
      g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(cfgL.vol, t + d + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d + cfgL.dur);
      o.start(t + d); o.stop(t + d + cfgL.dur + 0.04);
    }
  };

  let unlocked = false, rainSrc = null, rainGain = null;
  const RFAudio = {
    tracks: TRACKS.map(t => t.nome),
    exclusivas: TRACKS.map(t => !!t.trevo),
    // Navegadores só liberam som depois de um toque/clique do jogador.
    unlock() {
      if (!ensure()) return;
      if (ac.state === 'suspended') ac.resume();
      unlocked = true;
      if (cfg.music) startMusic();
    },
    configure(c) {
      const trackChanged = c.track !== undefined && c.track !== cfg.track;
      Object.assign(cfg, c);
      applyVolumes();
      if (!ac || !unlocked) return;
      if (!cfg.music) stopMusic();
      else if (trackChanged) { stopMusic(); startMusic(); }
      else startMusic();
    },
    // Chuva: um chiado baixinho em loop (segue o botão de sons).
    rain(on) {
      if (!ac || !unlocked) return;
      if (on && !rainSrc) {
        rainSrc = ac.createBufferSource(); rainSrc.buffer = noiseBuf; rainSrc.loop = true;
        const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400;
        rainGain = ac.createGain(); rainGain.gain.setValueAtTime(0.0001, ac.currentTime); rainGain.gain.exponentialRampToValueAtTime(0.18, ac.currentTime + 2);
        rainSrc.connect(f); f.connect(rainGain); rainGain.connect(sfxBus); rainSrc.start();
      } else if (!on && rainSrc) {
        const src = rainSrc; rainGain.gain.setTargetAtTime(0.0001, ac.currentTime, 0.6);
        setTimeout(() => { try { src.stop(); } catch (e) { /* já parou */ } }, 3000);
        rainSrc = null;
      }
    },
    play(name) {
      const fn = SFX[name] || (name.startsWith('bicho_') && BICHOS[name.slice(6)]) || (name.startsWith('bark_') && (t => latir(LATIDOS[name.slice(5)] || LATIDOS.caramelo, t)));
      if (!ac || !unlocked || !cfg.sfx || !fn) return;
      try { fn(ac.currentTime + 0.01); } catch (e) { /* som é enfeite: nunca quebra o jogo */ }
    },
  };
  window.RFAudio = RFAudio;
})();
