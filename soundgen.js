/*
 * SoundGen – prozedurale Soundeffekte und Melodien für MakeCode Arcade.
 * Läuft im Browser (window.SoundGen) und in Node (require).
 *  - Effekte  -> music.createSoundEffect(...)
 *  - Melodien -> music.melodyPlayable(new music.Melody("..."))
 * Vorschau im Browser per WebAudio (angenähert an den MakeCode-Klang).
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.SoundGen = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    function hashSeed(s) {
        if (typeof s === 'number') return s >>> 0;
        let h = 2166136261;
        for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
        return h >>> 0;
    }
    function makeRand(seed) {
        let s = hashSeed(seed);
        const next = () => {
            s = (s + 0x6D2B79F5) >>> 0;
            let t = s;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        return {
            next,
            int: (a, b) => a + Math.floor(next() * (b - a + 1)),
            pick: arr => arr[Math.floor(next() * arr.length)],
            chance: p => next() < p,
        };
    }

    // =====================================================================
    //  SOUNDEFFEKTE
    // =====================================================================
    const WAVES = ['Sine', 'Sawtooth', 'Triangle', 'Square', 'Noise'];
    const EFFECTS = ['None', 'Vibrato', 'Tremolo', 'Warble'];
    const CURVES = ['Linear', 'Curve', 'Logarithmic'];
    const WAVE_NAMES = { Sine: 'Sinus', Sawtooth: 'Sägezahn', Triangle: 'Dreieck', Square: 'Rechteck', Noise: 'Rauschen' };
    const EFFECT_NAMES = { None: 'keiner', Vibrato: 'Vibrato', Tremolo: 'Tremolo', Warble: 'Trällern' };
    const CURVE_NAMES = { Linear: 'linear', Curve: 'Kurve', Logarithmic: 'logarithmisch' };

    // Jede Vorlage: Wertebereiche, aus denen der Seed eine Variante würfelt
    const SFX_TYPES = {
        jump: { name: 'Sprung', wave: ['Square', 'Square', 'Triangle'], f0: [220, 400], f1: [600, 950], v0: [90, 140], v1: [0, 0], dur: [100, 180], effect: ['None'], curve: ['Linear', 'Curve'] },
        doubleJump: { name: 'Doppelsprung', wave: ['Square', 'Triangle'], f0: [450, 650], f1: [1000, 1500], v0: [80, 130], v1: [0, 0], dur: [110, 170], effect: ['None', 'Vibrato'], curve: ['Linear', 'Curve'] },
        coin: { name: 'Münze', wave: ['Sine', 'Square', 'Triangle'], f0: [1000, 1400], f1: [1600, 2300], v0: [120, 170], v1: [0, 0], dur: [60, 120], effect: ['None'], curve: ['Linear', 'Logarithmic'] },
        powerup: { name: 'Power-Up', wave: ['Triangle', 'Square', 'Sine'], f0: [250, 400], f1: [1200, 1900], v0: [100, 150], v1: [20, 60], dur: [320, 520], effect: ['Vibrato', 'None', 'Warble'], curve: ['Curve', 'Linear'] },
        hit: { name: 'Treffer', wave: ['Noise', 'Square'], f0: [600, 1000], f1: [80, 220], v0: [140, 200], v1: [0, 0], dur: [70, 150], effect: ['None'], curve: ['Linear', 'Logarithmic'] },
        explosion: { name: 'Explosion', wave: ['Noise'], f0: [300, 700], f1: [30, 80], v0: [200, 255], v1: [0, 0], dur: [400, 800], effect: ['None', 'Tremolo'], curve: ['Logarithmic', 'Curve'] },
        laser: { name: 'Laser', wave: ['Sawtooth', 'Square'], f0: [1300, 2000], f1: [200, 450], v0: [80, 130], v1: [0, 0], dur: [100, 220], effect: ['None', 'Vibrato'], curve: ['Logarithmic', 'Linear'] },
        death: { name: 'Niederlage', wave: ['Sawtooth', 'Triangle', 'Square'], f0: [500, 800], f1: [50, 110], v0: [110, 160], v1: [0, 20], dur: [450, 800], effect: ['Warble', 'Vibrato'], curve: ['Curve', 'Linear'] },
        blip: { name: 'Menü-Blip', wave: ['Square', 'Sine'], f0: [700, 1200], f1: [700, 1200], v0: [70, 110], v1: [0, 0], dur: [35, 70], effect: ['None'], curve: ['Linear'] },
        alarm: { name: 'Alarm', wave: ['Square', 'Sawtooth'], f0: [500, 700], f1: [800, 1000], v0: [90, 130], v1: [90, 130], dur: [350, 550], effect: ['Tremolo', 'Warble'], curve: ['Linear'] },
    };

    function sfx(type, seed) {
        const t = SFX_TYPES[type], r = makeRand('sfx:' + type + ':' + seed);
        const f0 = r.int(t.f0[0], t.f0[1]);
        const f1 = type === 'blip' ? f0 : r.int(t.f1[0], t.f1[1]);
        return {
            type, wave: r.pick(t.wave), f0, f1,
            v0: r.int(t.v0[0], t.v0[1]), v1: r.int(t.v1[0], t.v1[1]),
            dur: r.int(t.dur[0], t.dur[1]), effect: r.pick(t.effect), curve: r.pick(t.curve),
        };
    }

    function sfxToTS(name, s, indent) {
        indent = indent || '    ';
        return `${indent}export const ${name} = music.createSoundEffect(WaveShape.${s.wave}, ${s.f0}, ${s.f1}, ${s.v0}, ${s.v1}, ${s.dur}, SoundExpressionEffect.${s.effect}, InterpolationCurve.${s.curve})\n`;
    }

    // Frequenzverlauf 0..1 -> Hz (für Vorschau und Zeichnung)
    function sfxFreqAt(s, t) {
        let k = t;
        if (s.curve === 'Curve') k = 1 - Math.pow(1 - t, 2);
        if (s.curve === 'Logarithmic') k = Math.log(1 + t * 9) / Math.log(10);
        let f = s.f0 + (s.f1 - s.f0) * k;
        const time = t * s.dur / 1000;
        if (s.effect === 'Vibrato') f *= 1 + 0.04 * Math.sin(2 * Math.PI * 12 * time);
        if (s.effect === 'Warble') f *= 1 + 0.12 * Math.sin(2 * Math.PI * 20 * time);
        return f;
    }
    function sfxVolAt(s, t) {
        let v = (s.v0 + (s.v1 - s.v0) * t) / 255;
        if (s.effect === 'Tremolo') v *= 0.55 + 0.45 * Math.sin(2 * Math.PI * 16 * t * s.dur / 1000);
        return Math.max(0, v);
    }

    // =====================================================================
    //  MELODIEN
    // =====================================================================
    const NOTE_NAMES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
    const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const MAJOR = [0, 2, 4, 5, 7, 9, 11], MINOR = [0, 2, 3, 5, 7, 8, 10];
    const MELODY_TYPES = {
        start: { name: 'Startmelodie', minor: false, tempo: [140, 180] },
        level: { name: 'Level geschafft', minor: false, tempo: [160, 200] },
        win: { name: 'Sieg-Fanfare', minor: false, tempo: [140, 170] },
        gameover: { name: 'Game Over', minor: true, tempo: [90, 120] },
        death: { name: 'Todesmelodie', minor: true, tempo: [180, 220] },
        boss: { name: 'Boss taucht auf', minor: true, tempo: [100, 130] },
        theme: { name: 'Level-Thema (Loop)', minor: false, tempo: [130, 160] },
    };

    // Tonleiterstufe (kann negativ / >7 sein) -> MIDI-Nummer
    function degreeToMidi(root, scale, degree, octave) {
        const o = Math.floor(degree / 7), d = ((degree % 7) + 7) % 7;
        return 12 * (octave + 1 + o) + root + scale[d];
    }
    const midiToName = m => NOTE_NAMES[m % 12] + (Math.floor(m / 12) - 1);
    const midiToHz = m => 440 * Math.pow(2, (m - 69) / 12);

    function melody(type, seed, opts) {
        opts = opts || {};
        const T = MELODY_TYPES[type], r = makeRand('mel:' + type + ':' + seed);
        const root = opts.key != null ? opts.key : r.int(0, 11);
        const minor = opts.minor != null ? opts.minor : T.minor;
        const scale = minor ? MINOR : MAJOR;
        const oct = opts.octave || 4;
        const tempo = opts.tempo || r.int(T.tempo[0], T.tempo[1]);
        const notes = []; // {m: midi|null, d: Dauer in 1/4-Schlägen}
        const n = (deg, d, o) => notes.push({ m: degreeToMidi(root, scale, deg, o == null ? oct : o), d });
        const rest = d => notes.push({ m: null, d });

        if (type === 'start') {
            const arp = r.pick([[0, 2, 4, 7], [0, 4, 7, 9], [0, 2, 4, 6, 7]]);
            arp.forEach(g => n(g, 2));
            rest(r.pick([1, 2]));
            n(r.pick([4, 5, 6]), 2); n(7, 8);
        } else if (type === 'level') {
            const a = r.pick([[4, 7, 9, 11], [0, 4, 7, 11], [2, 4, 7, 14]]);
            a.forEach((g, i) => n(g, i === a.length - 1 ? 5 : 1));
        } else if (type === 'win') {
            n(0, 2); n(0, 1); n(0, 1); n(4, 4); n(2, 2); n(4, 2);
            n(r.pick([5, 6, 7]), 6); rest(1);
            const end = r.pick([[4, 7], [6, 7], [9, 7]]);
            n(end[0], 1); n(end[1], 8);
        } else if (type === 'gameover') {
            let d = r.pick([4, 5]);
            for (let i = 0; i < 3; i++) { n(d, 3); d -= r.pick([1, 1, 2]); }
            if (r.chance(0.5)) notes.push({ m: notes[notes.length - 1].m - 1, d: 3 });
            n(0, 10, oct - 1 + (d > 2 ? 1 : 0));
        } else if (type === 'death') {
            let d = r.pick([7, 9]);
            for (let i = 0; i < 4; i++) { n(d, 1); d -= r.pick([2, 2, 3]); }
            n(d, 4);
        } else if (type === 'boss') {
            const lo = oct - 1;
            for (let bar = 0; bar < 2; bar++) { n(0, 2, lo); n(0, 2, lo); n(r.pick([1, 2]), 2, lo); n(0, 4, lo); }
            n(r.pick([4, 5]), 2, lo); n(r.pick([3, 4]), 2, lo); notes.push({ m: degreeToMidi(root, scale, 0, lo) + 1, d: 6 });
        } else if (type === 'theme') {
            const prog = r.pick([[0, 4, 5, 3], [0, 5, 3, 4], [0, 3, 4, 4], [5, 3, 0, 4]]);
            const rhythms = [[2, 2, 2, 2], [2, 1, 1, 4], [3, 1, 2, 2], [4, 2, 2], [1, 1, 2, 2, 2], [2, 2, 4]];
            let prev = 4;
            prog.forEach((chord, bar) => {
                const rh = bar === 3 ? r.pick([[2, 2, 4], [4, 4]]) : r.pick(rhythms);
                const tones = [chord, chord + 2, chord + 4];
                rh.forEach((d, i) => {
                    let g;
                    if (i === 0 || r.chance(0.5)) { // Akkordton, nah am vorigen Ton
                        g = tones.map(t => { let c = t; while (c - prev > 3) c -= 7; while (prev - c > 3) c += 7; return c; })
                            .sort((a, b) => Math.abs(a - prev) - Math.abs(b - prev))[r.int(0, 1)];
                    } else g = prev + r.pick([-1, 1, 1, 2, -2]);
                    g = Math.max(-2, Math.min(11, g));
                    if (bar === 3 && i === rh.length - 1) g = r.pick([4, 1, 6]); // offenes Ende für den Loop
                    n(g, d); prev = g;
                });
            });
        }
        return { type, tempo, root, minor, notes };
    }

    function melodyToString(mel) {
        return mel.notes.map((x, i) => (x.m == null ? 'r' : midiToName(x.m)) + ':' + x.d + (i === 0 ? '-' + mel.tempo : '')).join(' ');
    }
    function melodyToTS(name, mel, indent) {
        indent = indent || '    ';
        return `${indent}export const ${name} = music.melodyPlayable(new music.Melody("${melodyToString(mel)}"))\n`;
    }
    const noteMs = (mel, d) => d * 15000 / mel.tempo;
    const melodyLength = mel => mel.notes.reduce((s, x) => s + noteMs(mel, x.d), 0);

    // =====================================================================
    //  WebAudio-Vorschau (nur Browser)
    // =====================================================================
    let ctx = null, noiseBuf = null;
    function audio() {
        if (!ctx) {
            const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
            if (!AC) return null;
            ctx = new AC();
        }
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
    }
    const MASTER = 0.25;
    function source(ac, wave) {
        if (wave === 'Noise') {
            if (!noiseBuf) {
                noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
                const d = noiseBuf.getChannelData(0);
                for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
            }
            const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
            // Rauschen über Filterfrequenz "tönen"
            const filt = ac.createBiquadFilter(); filt.type = 'bandpass'; filt.Q.value = 1.2;
            src.connect(filt);
            return { node: src, out: filt, freq: filt.frequency };
        }
        const o = ac.createOscillator();
        o.type = { Sine: 'sine', Sawtooth: 'sawtooth', Triangle: 'triangle', Square: 'square' }[wave];
        return { node: o, out: o, freq: o.frequency };
    }
    function playSfx(s) {
        const ac = audio(); if (!ac) return;
        const t0 = ac.currentTime + 0.01, dur = s.dur / 1000, steps = 64;
        const src = source(ac, s.wave), g = ac.createGain();
        src.out.connect(g); g.connect(ac.destination);
        const fc = new Float32Array(steps), vc = new Float32Array(steps);
        for (let i = 0; i < steps; i++) {
            const t = i / (steps - 1);
            fc[i] = Math.max(20, Math.min(12000, sfxFreqAt(s, t) * (s.wave === 'Noise' ? 3 : 1)));
            vc[i] = sfxVolAt(s, t) * MASTER * (s.wave === 'Square' || s.wave === 'Sawtooth' ? 0.6 : 1);
        }
        src.freq.setValueCurveAtTime(fc, t0, dur);
        g.gain.setValueAtTime(0, ac.currentTime);
        g.gain.setValueCurveAtTime(vc, t0, dur);
        src.node.start(t0); src.node.stop(t0 + dur + 0.02);
        return dur * 1000;
    }
    let melodyTimers = [];
    function stopMelody() { melodyTimers.forEach(clearTimeout); melodyTimers = []; }
    function playMelody(mel, onNote) {
        const ac = audio(); if (!ac) return;
        stopMelody();
        let t = ac.currentTime + 0.03, ms = 0;
        mel.notes.forEach((x, i) => {
            const len = noteMs(mel, x.d) / 1000;
            if (onNote) melodyTimers.push(setTimeout(() => onNote(i), ms));
            if (x.m != null) {
                const o = ac.createOscillator(), g = ac.createGain();
                o.type = 'square'; o.frequency.value = midiToHz(x.m);
                o.connect(g); g.connect(ac.destination);
                g.gain.setValueAtTime(0, t);
                g.gain.linearRampToValueAtTime(MASTER * 0.45, t + 0.005);
                g.gain.setValueAtTime(MASTER * 0.45, t + len * 0.85);
                g.gain.linearRampToValueAtTime(0, t + len * 0.98);
                o.start(t); o.stop(t + len);
            }
            t += len; ms += len * 1000;
        });
        if (onNote) melodyTimers.push(setTimeout(() => onNote(-1), ms));
        return ms;
    }

    return {
        WAVES, EFFECTS, CURVES, WAVE_NAMES, EFFECT_NAMES, CURVE_NAMES, SFX_TYPES, MELODY_TYPES, KEYS,
        sfx, sfxToTS, sfxFreqAt, sfxVolAt, melody, melodyToString, melodyToTS, melodyLength, noteMs,
        midiToName, playSfx, playMelody, stopMelody,
    };
});
