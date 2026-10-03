/*
 * AssetGen – prozeduraler Pixelgrafik-Generator für MakeCode Arcade.
 * Läuft im Browser (window.AssetGen) und in Node (require).
 * Alle Grafiken nutzen die 16-Farben-Standardpalette von MakeCode Arcade.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.AssetGen = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // ---------------------------------------------------------------- Palette
    const PALETTE = ['#00000000', '#ffffff', '#ff2121', '#ff93c4', '#ff8135', '#fff609', '#249ca3', '#78dc52',
        '#003fad', '#87f2ff', '#8e2ec4', '#a4839f', '#5c406c', '#e5cdc4', '#91463d', '#000000'];
    const COLOR_NAMES = ['transparent', 'weiß', 'rot', 'rosa', 'orange', 'gelb', 'türkis', 'grün',
        'blau', 'hellblau', 'lila', 'mauve', 'dunkellila', 'beige', 'braun', 'schwarz'];
    const HEX = '.123456789abcdef';
    // dunklere / hellere Nachbarfarbe für Schattierung
    const DARK = [0, 0xb, 0xe, 0x2, 0xe, 0x4, 0x8, 0x6, 0xc, 0x6, 0xc, 0xc, 0xf, 0xb, 0xc, 0xf];
    const LIGHT = [0, 1, 3, 1, 5, 1, 9, 5, 6, 1, 3, 0xd, 0xb, 1, 4, 0xc];

    // ---------------------------------------------------------------- Zufall
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
            range: (a, b) => a + next() * (b - a),
            pick: arr => arr[Math.floor(next() * arr.length)],
            chance: p => next() < p,
            fork: tag => makeRand(hashSeed(String(s) + ':' + tag)),
        };
    }

    // ---------------------------------------------------------------- Bild
    class Pix {
        constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8Array(w * h); }
        get(x, y) { return (x < 0 || y < 0 || x >= this.w || y >= this.h) ? 0 : this.d[y * this.w + x]; }
        set(x, y, c) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c; return this; }
        setWrap(x, y, c) { if (y >= 0 && y < this.h) this.d[y * this.w + (((x % this.w) + this.w) % this.w)] = c; }
        getWrap(x, y) { return (y < 0 || y >= this.h) ? 0 : this.d[y * this.w + (((x % this.w) + this.w) % this.w)]; }
        rect(x, y, w, h, c, wrap) {
            for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) wrap ? this.setWrap(i, j, c) : this.set(i, j, c);
            return this;
        }
        circle(cx, cy, r, c, wrap) {
            for (let j = Math.floor(cy - r); j <= cy + r; j++)
                for (let i = Math.floor(cx - r); i <= cx + r; i++)
                    if ((i - cx) * (i - cx) + (j - cy) * (j - cy) <= r * r + r * 0.6) wrap ? this.setWrap(i, j, c) : this.set(i, j, c);
            return this;
        }
        ellipse(cx, cy, rx, ry, c) {
            for (let j = Math.floor(cy - ry); j <= cy + ry; j++)
                for (let i = Math.floor(cx - rx); i <= cx + rx; i++) {
                    const dx = (i - cx) / (rx + 0.35), dy = (j - cy) / (ry + 0.35);
                    if (dx * dx + dy * dy <= 1) this.set(i, j, c);
                }
            return this;
        }
        line(x0, y0, x1, y1, c) {
            const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
            let err = dx + dy;
            for (; ;) {
                this.set(x0, y0, c);
                if (x0 === x1 && y0 === y1) break;
                const e2 = 2 * err;
                if (e2 >= dy) { err += dy; x0 += sx; }
                if (e2 <= dx) { err += dx; y0 += sy; }
            }
            return this;
        }
        // Umriss um alle gefüllten Pixel (4er-Nachbarschaft)
        outline(c) {
            const src = this.clone();
            for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
                if (src.get(x, y)) continue;
                if (src.get(x - 1, y) || src.get(x + 1, y) || src.get(x, y - 1) || src.get(x, y + 1)) this.set(x, y, c);
            }
            return this;
        }
        map(fn) { for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) this.d[y * this.w + x] = fn(this.get(x, y), x, y); return this; }
        replace(from, to) { return this.map(c => c === from ? to : c); }
        blit(src, dx, dy) { for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) { const c = src.get(x, y); if (c) this.set(dx + x, dy + y, c); } return this; }
        shift(dx, dy) { const s = this.clone(); this.d.fill(0); return this.blit(s, dx, dy); }
        clone() { const p = new Pix(this.w, this.h); p.d.set(this.d); return p; }
        flipX() { const p = new Pix(this.w, this.h); for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) p.set(this.w - 1 - x, y, this.get(x, y)); return p; }
        toMakeCode(indent) {
            indent = indent || '    ';
            let s = 'img`\n';
            for (let y = 0; y < this.h; y++) {
                const row = [];
                for (let x = 0; x < this.w; x++) row.push(HEX[this.get(x, y)]);
                s += indent + '    ' + row.join(' ') + '\n';
            }
            return s + indent + '`';
        }
        toRGBA(scale) {
            scale = scale || 1;
            const W = this.w * scale, H = this.h * scale, out = new Uint8ClampedArray(W * H * 4);
            for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
                const c = this.get(Math.floor(x / scale), Math.floor(y / scale)), o = (y * W + x) * 4;
                if (!c) continue;
                const h = PALETTE[c];
                out[o] = parseInt(h.substr(1, 2), 16); out[o + 1] = parseInt(h.substr(3, 2), 16);
                out[o + 2] = parseInt(h.substr(5, 2), 16); out[o + 3] = 255;
            }
            return { width: W, height: H, data: out };
        }
        static fromRows(rows, map) {
            const p = new Pix(rows[0].length, rows.length);
            rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const ch = r[x]; p.set(x, y, map && ch in map ? map[ch] : Math.max(0, HEX.indexOf(ch))); } });
            return p;
        }
    }

    // ---------------------------------------------------------------- Helfer
    const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
    const dither = (x, y, t) => t > (BAYER[((y % 4) + 4) % 4][((x % 4) + 4) % 4] + 0.5) / 16;
    const clamp01 = v => Math.max(0, Math.min(1, v));
    // periodische (nahtlos kachelbare) 1D-Rauschfunktion
    function periodicNoise(r, width, points) {
        const vals = []; for (let i = 0; i < points; i++) vals.push(r.next());
        return x => {
            const t = (((x / width) * points) % points + points) % points;
            const i = Math.floor(t), f = t - i, s = (1 - Math.cos(f * Math.PI)) / 2;
            return vals[i % points] * (1 - s) + vals[(i + 1) % points] * s;
        };
    }
    function fractal(r, width, octaves) {
        const fns = octaves.map(o => periodicNoise(r, width, o));
        return x => { let v = 0, w = 0, a = 1; fns.forEach(f => { v += f(x) * a; w += a; a *= 0.5; }); return v / w; };
    }

    // =====================================================================
    //  BIOME
    // =====================================================================
    const BIOMES = {
        grass: { name: 'Gras', mood: 'sonnig' },
        scifi: { name: 'SciFi', mood: 'Neon-Nacht' },
        dungeon: { name: 'Dungeon', mood: 'düster' },
        underwater: { name: 'Unter Wasser', mood: 'Korallenriff' },
        space: { name: 'Weltall', mood: 'Mondkrater' },
        desert: { name: 'Wüste', mood: 'Glutwüste' },
        ice: { name: 'Eis', mood: 'Polarnacht' },
        magic: { name: 'Magie', mood: 'Zauberwald' },
    };

    // =====================================================================
    //  HINTERGRÜNDE (3 Ebenen: sky opak, far + near transparent, 160x120, nahtlos)
    // =====================================================================
    const BW = 160, BH = 120;

    function bgGrass(r) {
        const sky = new Pix(BW, BH), far = new Pix(BW, BH), near = new Pix(BW, BH);
        for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) {
            let c = dither(x, y, clamp01(y / 44)) ? 9 : 8;
            if (y > 58 && dither(x, y, clamp01((y - 58) / 70) * 0.55)) c = 1;
            sky.set(x, y, c);
        }
        // Sonne
        const sx = r.int(20, 140), sy = r.int(12, 24);
        sky.circle(sx, sy, 9, 1).circle(sx, sy, 7, 5);
        // Wolken
        const nc = r.int(3, 5);
        for (let i = 0; i < nc; i++) {
            const cx = Math.floor(i * BW / nc + r.int(0, 20)), cy = r.int(14, 44), n = r.int(3, 5);
            const cl = new Pix(BW, BH);
            for (let k = 0; k < n; k++) cl.circle(cx + k * 6 - n * 3, cy - (k % 2 ? 3 : 0) - (k === Math.floor(n / 2) ? 3 : 0), r.int(4, 6), 1, true);
            for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) if (cl.get(x, y) && y <= cy + 3)
                sky.set(x, y, (y >= cy + 2 && !cl.get(x, y + 2)) || (y === cy + 3) ? 0xd : 1);
        }
        // Berge (ferne Ebene)
        const m = fractal(r, BW, [3, 6, 13]);
        for (let x = 0; x < BW; x++) {
            const v = m(x), ridge = 1 - Math.abs(2 * v - 1);
            const top = Math.round(34 + (1 - ridge) * 42);
            const slope = Math.round(34 + (1 - (1 - Math.abs(2 * m(x + 1) - 1))) * 42) - top;
            for (let y = top; y < BH; y++) {
                let c = 6;
                if (y < 52 && y < top + 5) c = 1;
                else if (slope > 0 && dither(x, y, 0.5)) c = 8;
                if (y > 88 && dither(x, y, clamp01((y - 88) / 20))) c = 8;
                far.set(x, y, c);
            }
        }
        // Hügel + Bäume (nahe Ebene)
        const hfn = fractal(r, BW, [2, 5]);
        const hy = x => Math.round(78 + hfn(x) * 20);
        for (let x = 0; x < BW; x++) for (let y = hy(x); y < BH; y++) {
            let c = 7;
            if (y > hy(x) + 1 && dither(x, y, clamp01((y - hy(x) - 4) / 26))) c = 6;
            near.set(x, y, c);
        }
        const nt = r.int(4, 6);
        for (let i = 0; i < nt; i++) {
            const tx = Math.floor(i * BW / nt + r.int(0, 18)), base = hy(tx), th = r.int(6, 10), rad = r.int(5, 8);
            near.rect(tx - 1, base - th, 2, th + 2, 0xe, true);
            const tree = new Pix(BW, BH);
            tree.circle(tx, base - th - rad + 2, rad, 6, true);
            tree.circle(tx - Math.round(rad * 0.6), base - th - 1, Math.round(rad * 0.7), 6, true);
            tree.circle(tx + Math.round(rad * 0.6), base - th - 1, Math.round(rad * 0.7), 6, true);
            for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) if (tree.get(x, y)) {
                const hl = !tree.get(x, y - 2) || !tree.get(x - 2, y);
                near.set(x, y, hl && dither(x, y, 0.7) ? 7 : 6);
            }
        }
        return { sky, far, near };
    }

    function bgScifi(r) {
        const sky = new Pix(BW, BH), far = new Pix(BW, BH), near = new Pix(BW, BH);
        for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++)
            sky.set(x, y, dither(x, y, clamp01((y - 10) / 80)) ? 0xc : 0xf);
        for (let i = 0; i < 70; i++) {
            const x = r.int(0, BW - 1), y = r.int(0, 85);
            sky.set(x, y, r.pick([1, 1, 9, 5, 0xb]));
            if (r.chance(0.08)) { sky.set(x - 1, y, 9); sky.set(x + 1, y, 9); sky.set(x, y - 1, 9); sky.set(x, y + 1, 9); sky.set(x, y, 1); }
        }
        // Planet mit Ring
        const px = r.int(24, 136), py = r.int(18, 34), pr = r.int(9, 13), pc = r.pick([0xa, 6, 4, 2]);
        sky.circle(px, py, pr, pc);
        for (let y = py - pr; y <= py + pr; y++) for (let x = px - pr; x <= px + pr; x++) {
            if (!sky.get(x, y) || sky.get(x, y) !== pc) continue;
            const d = (x - px + 4) * (x - px + 4) + (y - py + 4) * (y - py + 4);
            if (d > pr * pr * 1.1) sky.set(x, y, dither(x, y, 0.6) ? DARK[pc] : pc);
            if ((x - px + 5) * (x - px + 5) + (y - py + 5) * (y - py + 5) < 6) sky.set(x, y, LIGHT[pc]);
        }
        for (let a = 0; a < 360; a += 2) {
            const x = Math.round(px + Math.cos(a * Math.PI / 180) * pr * 1.8), y = Math.round(py + Math.sin(a * Math.PI / 180) * pr * 0.45);
            const behind = Math.sin(a * Math.PI / 180) < 0 && (x - px) * (x - px) + (y - py) * (y - py) < pr * pr;
            if (!behind) sky.set(x, y, 9);
        }
        // ferne Skyline
        let x = 0;
        while (x < BW) {
            const w = Math.min(r.int(10, 20), BW - x), h = r.int(28, 62), top = BH - h;
            far.rect(x, top, w - 1, h, 8);
            for (let wy = top + 3; wy < BH - 2; wy += 4) for (let wx = x + 2; wx < x + w - 3; wx += 3)
                if (r.chance(0.35)) far.set(wx, wy, r.chance(0.8) ? 9 : 5);
            if (r.chance(0.4)) { const ax = x + r.int(2, w - 3); far.rect(ax, top - r.int(4, 9), 1, 9, 8); }
            x += w + r.int(0, 3);
        }
        // nahe Türme mit Neon
        x = r.int(0, 10);
        const neon = [2, 0xa, 9, 3, 7];
        while (x < BW + 10) {
            const w = r.int(14, 24), h = r.int(48, 82), top = BH - h;
            near.rect(x, top, w, h, 0xf, true);
            near.rect(x + 1, top, w - 2, 1, 0xc, true);
            for (let wy = top + 4; wy < BH; wy += 5) for (let wx = x + 2; wx < x + w - 2; wx += 3)
                if (r.chance(0.2)) near.setWrap(wx, wy, 0xc);
            if (r.chance(0.8)) {
                const nc = r.pick(neon), ny = top + r.int(6, 20), nw = r.int(6, w - 4), nx = x + r.int(2, w - nw - 1);
                near.rect(nx, ny, nw, 1, nc, true); near.rect(nx, ny + 3, nw, 1, nc, true);
                near.rect(nx, ny, 1, 4, nc, true); near.rect(nx + nw - 1, ny, 1, 4, nc, true);
                for (let k = nx + 2; k < nx + nw - 2; k += 2) near.setWrap(k, ny + 1 + (k % 4 ? 0 : 1), nc);
            }
            const ax = x + Math.floor(w / 2);
            near.rect(ax, top - 8, 1, 8, 0xf, true); near.setWrap(ax, top - 9, 2);
            x += w + r.int(10, 26);
        }
        return { sky, far, near };
    }

    function bgDungeon(r) {
        const sky = new Pix(BW, BH), far = new Pix(BW, BH), near = new Pix(BW, BH);
        // Ziegelwand
        for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) {
            const row = Math.floor(y / 6), off = (row % 2) * 6, bx = (x + off) % 12, by = y % 6;
            let c = (bx === 0 || by === 0) ? 0xf : 0xc;
            if (c === 0xc && by === 1 && dither(x, y, 0.3)) c = 0xb;
            sky.set(x, y, c);
        }
        for (let i = 0; i < 25; i++) { // dunkle/moosige Steine
            const bxi = r.int(0, 12), byi = r.int(0, 19), off = (byi % 2) * 6;
            const c = r.pick([0xf, 0xe, 0xf]);
            for (let y = byi * 6 + 1; y < byi * 6 + 6; y++) for (let x = bxi * 12 - off + 1; x < bxi * 12 - off + 12; x++)
                if (dither(x, y, 0.5)) sky.setWrap(x, y, c);
        }
        // Bogenfenster mit Mondlicht + Banner (fern)
        for (let k = 0; k < 2; k++) {
            const cx = k * 80 + 40, top = r.int(22, 30), w = 22, h = 44;
            for (let y = top - 11; y < top + h; y++) for (let x = cx - w / 2 - 2; x < cx + w / 2 + 2; x++) {
                const inArch = y >= top ? Math.abs(x - cx + 0.5) <= w / 2 + 2 : (x - cx + 0.5) ** 2 + (y - top) ** 2 <= (w / 2 + 2) ** 2;
                if (!inArch) continue;
                const inner = y >= top ? Math.abs(x - cx + 0.5) <= w / 2 : (x - cx + 0.5) ** 2 + (y - top) ** 2 <= (w / 2) ** 2;
                let c = inner ? (dither(x, y, clamp01((y - top + 10) / 60)) ? 0xc : 8) : 0xb;
                if (inner && (x - cx) % 5 === 0) c = 0xf;
                if (inner && y === top + 14) c = 0xf;
                far.set(x, y, c);
            }
            // Mond
            const mx = cx + r.int(-4, 4), my = top - 2;
            for (let y = my - 3; y <= my + 3; y++) for (let x = mx - 3; x <= mx + 3; x++)
                if ((x - mx) ** 2 + (y - my) ** 2 <= 9 && far.get(x, y) !== 0xf) far.set(x, y, (x - mx - 1) ** 2 + (y - my + 1) ** 2 <= 3 ? 1 : 9);
            // Banner
            const bx = cx + 40 - 5, bc = r.pick([2, 0xa, 8]), by = r.int(14, 22), bh = r.int(26, 34);
            far.rect(bx - 2, by - 1, 14, 1, 0xe);
            for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + 10; x++) {
                const tip = y - (by + bh - 5);
                if (tip > 0 && Math.abs(x - bx - 4.5) < tip) continue;
                let c = bc;
                if (x === bx || x === bx + 9) c = 5;
                if (y >= by + 8 && y <= by + 13 && Math.abs(x - bx - 4.5) + Math.abs(y - by - 10.5) < 3.5) c = 5;
                far.set(x, y, c);
            }
        }
        // Säulen mit Fackeln (nah)
        for (let k = 0; k < 2; k++) {
            const cx = k * 80 + r.int(8, 14), w = 14;
            for (let y = 0; y < BH; y++) for (let x = cx; x < cx + w; x++) {
                let c = 0xb;
                if (x >= cx + w - 4) c = dither(x, y, 0.6) ? 0xc : 0xb;
                if (x === cx + w - 1) c = 0xc;
                if (x === cx) c = 0xd;
                if (y % 16 === 0) c = 0xc;
                near.set(x, y, c);
            }
            near.rect(cx - 3, 0, w + 6, 5, 0xb).rect(cx - 3, 4, w + 6, 1, 0xc);
            near.rect(cx - 3, BH - 5, w + 6, 5, 0xb).rect(cx - 3, BH - 5, w + 6, 1, 0xd);
            // Fackel
            const ty = r.int(44, 56), tx = cx + w + 1;
            near.rect(tx, ty, 3, 2, 0xe).rect(tx + 1, ty - 4, 2, 5, 0xe);
            near.set(tx + 1, ty - 5, 2).set(tx + 2, ty - 5, 4).set(tx + 1, ty - 6, 4).set(tx + 2, ty - 6, 5).set(tx + 2, ty - 7, 5).set(tx + 1, ty - 8, 4);
            // Kette
            const chx = cx + w + r.int(18, 30), chl = r.int(20, 40);
            for (let y = 0; y < chl; y++) near.set(chx + (y % 4 === 1 ? 1 : 0), y, y % 4 < 2 ? 0xb : 0xc);
        }
        return { sky, far, near };
    }

    // kleine Luftblase (Ring mit Glanzpunkt, innen durchsichtig)
    function bubble(p, x, y, rad) {
        if (rad <= 1) { p.setWrap(x, y - 1, 9); p.setWrap(x - 1, y, 9); p.setWrap(x + 1, y, 9); p.setWrap(x, y + 1, 9); return; }
        for (let a = 0; a < 360; a += 15) p.setWrap(Math.round(x + Math.cos(a * Math.PI / 180) * rad), Math.round(y + Math.sin(a * Math.PI / 180) * rad), 9);
        p.setWrap(x - 1, y - 1, 1);
    }

    function bgUnderwater(r) {
        const sky = new Pix(BW, BH), far = new Pix(BW, BH), near = new Pix(BW, BH);
        // Wasser: hell an der Oberfläche, nach unten dunkler
        for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) {
            const t = y / BH;
            let c;
            if (t < 0.22) c = dither(x, y, t / 0.22) ? 6 : 9;
            else if (t < 0.62) c = dither(x, y, (t - 0.22) / 0.4) ? 8 : 6;
            else c = dither(x, y, (t - 0.62) / 0.38 * 0.45) ? 0xc : 8;
            sky.set(x, y, c);
        }
        // Wellen an der Oberfläche (Periode teilt 160 -> nahtlos)
        for (let x = 0; x < BW; x++) {
            const w = Math.round(1.5 + Math.sin(x * Math.PI * 2 / 20) * 1.2 + Math.sin(x * Math.PI * 2 / 32) * 0.8);
            for (let y = 0; y <= w; y++) sky.set(x, y, y === w ? 1 : 9);
        }
        // Lichtstrahlen von oben
        const nr = r.int(3, 5);
        for (let k = 0; k < nr; k++) {
            const x0 = Math.floor(k * BW / nr + r.int(0, 20)), w = r.int(4, 9), len = r.int(55, 80);
            for (let y = 3; y < len; y++) for (let i = 0; i < w; i++) {
                const x = x0 + i + Math.floor(y * 0.4);
                if (!dither(x, y, 0.55 * (1 - y / len))) continue;
                const c = sky.getWrap(x, y);
                sky.setWrap(x, y, c === 8 ? 6 : c === 6 ? 9 : c === 0xc ? 8 : c);
            }
        }
        for (let i = 0; i < 30; i++) sky.set(r.int(0, BW - 1), r.int(8, 100), 9); // Schwebeteilchen
        // Felsenriff (ferne Ebene)
        const m = fractal(r, BW, [4, 9, 17]);
        for (let x = 0; x < BW; x++) {
            const top = Math.round(66 + (1 - m(x)) * 34);
            for (let y = top; y < BH; y++) {
                let c = 0xc;
                if (y < top + 2 && dither(x, y, 0.6)) c = 8;
                if (y > 100 && dither(x, y, clamp01((y - 100) / 18))) c = 0xf;
                far.set(x, y, c);
            }
        }
        const np = r.int(2, 3); // Felssäulen
        for (let k = 0; k < np; k++) {
            const cx = Math.floor(k * BW / np + r.int(10, 40)), w = r.int(7, 11), top = r.int(34, 52);
            for (let y = top; y < BH; y++) {
                const ww = w + Math.round(Math.sin(y / 6 + k) * 1.5) + (y > 90 ? Math.floor((y - 90) / 4) : 0);
                for (let i = 0; i < ww; i++) far.setWrap(cx + i - Math.floor(ww / 2), y, i === 0 && dither(cx + i, y, 0.6) ? 8 : 0xc);
            }
            for (let i = -Math.floor(w / 2) - 1; i <= Math.floor(w / 2) + 1; i++) far.setWrap(cx + i, top, dither(cx + i, top, 0.7) ? 8 : 0xc);
        }
        // Seetang, Korallen und Luftblasen (nahe Ebene)
        const nk = r.int(5, 8);
        for (let k = 0; k < nk; k++) {
            const bx = Math.floor(k * BW / nk + r.int(0, 14)), h = r.int(36, 78), ph = r.next() * 6, c = r.pick([7, 6, 7]);
            for (let y = BH - 1; y > BH - h; y--) {
                const x = bx + Math.round(Math.sin((BH - y) / 9 + ph) * 2.2);
                near.setWrap(x, y, c); near.setWrap(x + 1, y, DARK[c]);
                if ((BH - y) % 7 === 3) { const s = (BH - y) % 14 === 3 ? -1 : 2; near.setWrap(x + s, y - 1, c); near.setWrap(x + s * 2 - (s > 0 ? 1 : 0), y - 2, c); }
            }
        }
        const nc = r.int(3, 5);
        for (let k = 0; k < nc; k++) {
            const bx = Math.floor(k * BW / nc + r.int(4, 24)), c = r.pick([3, 2, 4, 0xa]), arms = r.int(3, 5);
            for (let a = 0; a < arms; a++) {
                const ax = bx + (a - Math.floor(arms / 2)) * 3, h = r.int(7, 14);
                for (let y = 0; y < h; y++) near.setWrap(ax + (y > h / 2 ? Math.sign(a - arms / 2) : 0), BH - 4 - y, y > h - 3 ? LIGHT[c] : c);
                near.setWrap(ax + 1, BH - 4 - Math.floor(h / 2), c);
            }
            near.rect(bx - arms * 2, BH - 4, arms * 4 + 1, 4, 0xb, true);
            near.rect(bx - arms * 2, BH - 4, arms * 4 + 1, 1, 0xd, true);
        }
        const nb = r.int(3, 4);
        for (let k = 0; k < nb; k++) {
            const bx = r.int(0, BW - 1);
            let y = BH - r.int(6, 20);
            while (y > 12) { bubble(near, bx + r.int(-2, 2), y, r.pick([1, 1, 2, 3])); y -= r.int(9, 18); }
        }
        return { sky, far, near };
    }

    // unregelmäßiger Asteroid mit Kratern
    function asteroid(p, r, cx, cy, rad, wrap) {
        const bumps = [0, 1, 2, 3, 4, 5].map(() => r.range(0.75, 1.15)), ph = r.next() * 6;
        for (let y = Math.floor(cy - rad * 1.3); y <= cy + rad * 1.3; y++) for (let x = Math.floor(cx - rad * 1.3); x <= cx + rad * 1.3; x++) {
            const a = Math.atan2(y - cy, x - cx), d = Math.hypot(x - cx, y - cy);
            const k = (a + Math.PI) / (Math.PI * 2) * 6, i = Math.floor(k) % 6, f = k - Math.floor(k);
            const rr = rad * (bumps[i] * (1 - f) + bumps[(i + 1) % 6] * f) * (1 + 0.06 * Math.sin(a * 5 + ph));
            if (d > rr) continue;
            let c = 0xb;
            if (x - cx + y - cy > rad * 0.5) c = 0xc;
            else if (x - cx + y - cy < -rad * 0.9 && d > rr - 1.6) c = 0xd;
            wrap ? p.setWrap(x, y, c) : p.set(x, y, c);
        }
        const nc = Math.max(1, Math.floor(rad / 3));
        for (let k = 0; k < nc; k++) {
            const x = Math.round(cx + r.range(-rad * 0.5, rad * 0.4)), y = Math.round(cy + r.range(-rad * 0.5, rad * 0.4));
            const set = wrap ? (a, b, c) => p.setWrap(a, b, c) : (a, b, c) => p.set(a, b, c);
            set(x, y, 0xc); set(x + 1, y, 0xc); set(x, y - 1, 0xc); set(x + 1, y + 1, 0xd);
        }
    }

    function bgSpace(r) {
        const sky = new Pix(BW, BH), far = new Pix(BW, BH), near = new Pix(BW, BH);
        for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) sky.set(x, y, dither(x, y, clamp01((y - 70) / 140)) ? 0xc : 0xf);
        // Nebel: weiche, nahtlose Wolke aus Sinus-Überlagerung
        const nb = [0, 1, 2, 3].map(() => ({ fx: r.int(1, 3), fy: r.range(0.03, 0.07), ph: r.next() * 6, py: r.next() * 6 }));
        const ny = r.int(30, 60), nc = r.pick([[0xa, 3], [8, 9], [2, 4], [0xa, 9]]);
        for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) {
            let v = 0;
            nb.forEach(o => v += Math.sin(x / BW * Math.PI * 2 * o.fx + o.ph) * Math.cos(y * o.fy + o.py));
            v = v / 4 + 0.55 - Math.abs(y - ny) / 55;
            if (v > 0.55 && dither(x, y, (v - 0.55) * 3)) sky.set(x, y, v > 0.75 && dither(x, y, (v - 0.75) * 3) ? nc[1] : nc[0]);
            else if (v > 0.42 && dither(x, y, (v - 0.42) * 2)) sky.set(x, y, 0xc);
        }
        // Sterne
        for (let i = 0; i < 90; i++) {
            const x = r.int(0, BW - 1), y = r.int(0, BH - 1);
            sky.set(x, y, r.pick([1, 1, 1, 9, 5, 0xd]));
            if (r.chance(0.07)) { sky.setWrap(x - 1, y, 0xb); sky.setWrap(x + 1, y, 0xb); sky.set(x, y - 1, 0xb); sky.set(x, y + 1, 0xb); sky.set(x, y, 1); }
        }
        // Planet mit Kontinenten und Schattenseite
        const px = r.int(26, 134), py = r.int(18, 34), pr = r.int(10, 15);
        const [sea, land] = r.pick([[8, 7], [4, 5], [2, 4], [6, 9]]);
        const lfx = periodicNoise(r, 24, 4), lfy = periodicNoise(r, 24, 4);
        for (let y = py - pr; y <= py + pr; y++) for (let x = px - pr; x <= px + pr; x++) {
            const dx = x - px, dy = y - py;
            if (dx * dx + dy * dy > pr * pr + pr * 0.6) continue;
            let c = lfx(x - px + 30) + lfy(y - py + 30) > 1.1 ? land : sea;
            const sh = (dx + 0.7 * dy) / pr;
            if (sh > 0.7 || (sh > 0.45 && dither(x, y, (sh - 0.45) * 4))) c = 0xf;
            else if (sh > 0.25 && dither(x, y, 0.5)) c = DARK[c];
            if (sh < -0.75) c = LIGHT[c];
            sky.set(x, y, c);
        }
        // Mondlandschaft mit Kratern (ferne Ebene)
        const hf = fractal(r, BW, [3, 7]);
        const top = x => Math.round(84 + hf(x) * 16);
        for (let x = 0; x < BW; x++) for (let y = top(x); y < BH; y++) {
            let c = y === top(x) ? 0xd : 0xb;
            if (y > top(x) + 8 && dither(x, y, clamp01((y - top(x) - 8) / 22))) c = 0xc;
            far.set(x, y, c);
        }
        const ncr = r.int(4, 6);
        for (let k = 0; k < ncr; k++) {
            const cx = Math.floor(k * BW / ncr + r.int(2, 18)), rx = r.int(4, 8), cy = top(cx) + r.int(4, 10);
            for (let y = cy - 2; y <= cy + 2; y++) for (let x = cx - rx; x <= cx + rx; x++) {
                const e = ((x - cx) / rx) ** 2 + ((y - cy) / 2.2) ** 2;
                if (e <= 1) far.setWrap(x, y, y <= cy ? 0xc : 0xb);
                else if (e <= 1.5 && y > cy) far.setWrap(x, y, 0xd);
            }
        }
        // schwebende Asteroiden (nahe Ebene)
        const na = r.int(4, 6);
        for (let k = 0; k < na; k++) {
            const cx = Math.floor(k * BW / na + r.int(0, 18)), cy = r.int(12, 72), rad = r.pick([3, 4, 5, 7, 9]);
            asteroid(near, r, cx, cy, rad, true);
        }
        return { sky, far, near };
    }

    // Kaktus (Saguaro) an Fußpunkt x/y, Höhe h
    function cactus(p, x, y, h, wrap) {
        const set = wrap ? (a, b, c) => p.setWrap(a, b, c) : (a, b, c) => p.set(a, b, c);
        for (let j = 0; j < h; j++) { set(x, y - j, 7); set(x + 1, y - j, 6); set(x - 1, y - j, j < h - 1 ? 6 : 0); }
        set(x, y - h, 7);
        const arm = (dir, ay, ah) => {
            for (let i = 1; i <= 2; i++) set(x + (dir > 0 ? 1 : -1) * i + (dir > 0 ? 1 : 0), y - ay, 6);
            for (let j = 0; j < ah; j++) set(x + dir * 3 + (dir > 0 ? 0 : 0), y - ay - j, j === ah - 1 ? 7 : 6);
        };
        if (h > 7) arm(-1, Math.floor(h * 0.45), Math.floor(h * 0.35));
        if (h > 9) arm(1, Math.floor(h * 0.6), Math.floor(h * 0.3));
    }

    function bgDesert(r) {
        const sky = new Pix(BW, BH), far = new Pix(BW, BH), near = new Pix(BW, BH);
        // flirrender Himmel: oben blau, zum Horizont hell
        for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) {
            let c = dither(x, y, clamp01((y - 10) / 50)) ? 9 : 8;
            if (y > 50 && dither(x, y, clamp01((y - 50) / 45) * 0.8)) c = 0xd;
            if (y > 80 && dither(x, y, clamp01((y - 80) / 30) * 0.6)) c = 1;
            sky.set(x, y, c);
        }
        // große Sonne mit Strahlenkranz
        const sx = r.int(20, 140), sy = r.int(14, 26);
        for (let y = sy - 14; y <= sy + 14; y++) for (let x = sx - 14; x <= sx + 14; x++) {
            const d = Math.hypot(x - sx, y - sy);
            if (d <= 7) sky.set(x, y, d < 5 ? 1 : 5);
            else if (d <= 11 && dither(x, y, (11 - d) / 5)) sky.set(x, y, d < 9 ? 5 : 1);
        }
        // ferne Dünen mit Pyramiden
        const df = fractal(r, BW, [2, 4]);
        const dtop = x => Math.round(76 + df(x) * 16);
        const np = r.int(1, 3);
        for (let k = 0; k < np; k++) {
            const cx = Math.floor(k * BW / np + r.int(10, 40)), h = r.int(16, 30), base = 88;
            for (let y = base - h; y < BH; y++) {
                const hw = y - (base - h);
                for (let x = cx - hw; x <= cx + hw; x++) far.setWrap(x, y, x < cx ? 0xd : (dither(x, y, 0.75) ? 0xb : 0xd));
            }
            for (let y = base - h + 3; y < base; y += 3) for (let x = cx - (y - base + h); x <= cx + (y - base + h); x++) if ((x + y) % 4 === 0) far.setWrap(x, y, 0xb);
        }
        for (let x = 0; x < BW; x++) for (let y = dtop(x); y < BH; y++) far.set(x, y, y === dtop(x) ? 1 : (dither(x, y, 0.3 + clamp01((y - dtop(x)) / 30) * 0.4) ? 4 : 0xd));
        // nahe Dünen mit Kakteen und Felsen
        const nf = fractal(r, BW, [2, 3]);
        const ntop = x => Math.round(94 + nf(x) * 14);
        for (let x = 0; x < BW; x++) {
            const slope = ntop(x + 1) - ntop(x);
            for (let y = ntop(x); y < BH; y++) {
                let c = 4;
                if (y === ntop(x)) c = 5;
                else if (slope > 0 && dither(x, y, 0.55)) c = 0xe;
                near.set(x, y, c);
            }
        }
        const nc = r.int(2, 4);
        for (let k = 0; k < nc; k++) { const cx = Math.floor(k * BW / nc + r.int(4, 30)); cactus(near, cx, ntop(cx) + 1, r.int(8, 16), true); }
        const nr = r.int(2, 3);
        for (let k = 0; k < nr; k++) {
            const cx = r.int(0, BW - 1), w = r.int(3, 6), y0 = ntop(cx);
            for (let j = 0; j < w - 1; j++) for (let i = -w + j; i <= w - j; i++) near.setWrap(cx + i, y0 - j + 1, j === w - 2 ? 0xd : i > 0 ? 0xc : 0xb);
        }
        return { sky, far, near };
    }

    // verschneite Tanne
    function pine(p, x, y, h, wrap) {
        const set = wrap ? (a, b, c) => p.setWrap(a, b, c) : (a, b, c) => p.set(a, b, c);
        set(x, y, 0xe); set(x, y - 1, 0xe);
        for (let j = 2; j < h; j++) {
            const w = Math.floor(((h - j) % Math.max(3, Math.floor(h / 3))) * 0.9 + (h - j) / 4);
            for (let i = -w; i <= w; i++) set(x + i, y - j, (i === -w || i === w) && j % 2 === 0 ? 1 : (i > 0 ? 0xf : 6));
            if (j % 3 === 0) for (let i = -w; i < 0; i++) set(x + i, y - j, 1);
        }
        set(x, y - h, 1);
    }

    function bgIce(r) {
        const sky = new Pix(BW, BH), far = new Pix(BW, BH), near = new Pix(BW, BH);
        // Polarnacht mit Nordlicht
        for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) {
            let c = dither(x, y, clamp01(y / 70)) ? 8 : 0xf;
            if (y > 70 && dither(x, y, clamp01((y - 70) / 40) * 0.5)) c = 6;
            sky.set(x, y, c);
        }
        for (let i = 0; i < 50; i++) sky.set(r.int(0, BW - 1), r.int(0, 60), r.pick([1, 1, 9]));
        const nb = r.int(2, 3), ac = r.pick([[7, 6], [9, 6], [3, 0xa]]);
        for (let k = 0; k < nb; k++) {
            const by = r.int(14, 34), amp = r.range(5, 10), f = r.int(1, 3), ph = r.next() * 6, len = r.int(14, 26);
            for (let x = 0; x < BW; x++) {
                const top = Math.round(by + Math.sin(x / BW * Math.PI * 2 * f + ph) * amp);
                for (let j = 0; j < len; j++) {
                    const t = j / len;
                    if (!dither(x, top + j, (1 - t) * 0.7 * (0.6 + 0.4 * Math.sin(x / 7 + k)))) continue;
                    sky.set(x, top + j, t < 0.25 ? ac[0] : ac[1]);
                }
            }
        }
        // verschneite Berge (fern)
        const m = fractal(r, BW, [3, 6, 11]);
        for (let x = 0; x < BW; x++) {
            const v = m(x), ridge = 1 - Math.abs(2 * v - 1), top = Math.round(48 + (1 - ridge) * 36);
            const slope = Math.round(48 + (1 - (1 - Math.abs(2 * m(x + 1) - 1))) * 36) - top;
            for (let y = top; y < BH; y++) {
                let c = 6;
                if (y < top + 3 + ((x * 7) % 3)) c = 1;
                else if (y < top + 8 && dither(x, y, 0.5)) c = 9;
                else if (slope > 0 && dither(x, y, 0.5)) c = 8;
                if (y > 96 && dither(x, y, clamp01((y - 96) / 20))) c = 8;
                far.set(x, y, c);
            }
        }
        // Schneehügel mit Tannen (nah)
        const hf = fractal(r, BW, [2, 4]);
        const hy = x => Math.round(90 + hf(x) * 14);
        for (let x = 0; x < BW; x++) for (let y = hy(x); y < BH; y++) near.set(x, y, y < hy(x) + 2 ? 1 : (dither(x, y, 0.35) ? 9 : 1));
        const nt = r.int(4, 7);
        for (let k = 0; k < nt; k++) { const tx = Math.floor(k * BW / nt + r.int(0, 16)); pine(near, tx, hy(tx) + 1, r.int(14, 26), true); }
        for (let i = 0; i < 40; i++) near.set(r.int(0, BW - 1), r.int(0, 88), 1); // Schneeflocken
        return { sky, far, near };
    }

    // Riesenpilz
    function mushroom(p, x, y, h, rad, c, wrap) {
        const set = wrap ? (a, b, v) => p.setWrap(a, b, v) : (a, b, v) => p.set(a, b, v);
        const sw = rad > 5 ? 2 : 1;
        for (let j = 0; j < h; j++) { for (let i = -sw; i < sw; i++) set(x + i, y - j, 0xd); set(x + sw, y - j, 0xb); }
        for (let j = 0; j <= rad; j++) {
            const w = Math.round(Math.sqrt(rad * rad - j * j) * 1.5);
            for (let i = -w; i <= w; i++) set(x + i, y - h - j + Math.floor(rad / 2), j === 0 ? DARK[c] : c);
        }
        for (let k = 0; k < 4; k++) set(x - rad + k * Math.ceil(rad / 2) + 1, y - h - Math.floor(rad / 2) + (k % 2), 1);
    }

    function bgMagic(r) {
        const sky = new Pix(BW, BH), far = new Pix(BW, BH), near = new Pix(BW, BH);
        // Zauberdämmerung: dunkellila oben, rosa am Horizont
        for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) {
            let c = dither(x, y, clamp01(y / 50)) ? 0xa : 0xc;
            if (y > 50 && dither(x, y, clamp01((y - 50) / 50))) c = 3;
            sky.set(x, y, c);
        }
        for (let i = 0; i < 45; i++) {
            const x = r.int(0, BW - 1), y = r.int(0, 70);
            sky.set(x, y, r.pick([1, 5, 9]));
            if (r.chance(0.12)) { sky.setWrap(x - 1, y, 5); sky.setWrap(x + 1, y, 5); sky.set(x, y - 1, 5); sky.set(x, y + 1, 5); sky.set(x, y, 1); }
        }
        // großer Mond mit Sichel
        const mx = r.int(24, 136), my = r.int(16, 30);
        sky.circle(mx, my, 9, 1).circle(mx + 4, my - 2, 8, 0xc);
        for (let y = my - 12; y <= my + 12; y++) for (let x = mx - 12; x <= mx + 12; x++) if (sky.get(x, y) === 0xc && Math.hypot(x - mx - 4, y - my + 2) <= 8) sky.set(x, y, dither(x, y, 0.5) ? 0xa : 0xc);
        // schwebende Inseln mit Zauberturm (fern)
        const ni = r.int(2, 3);
        for (let k = 0; k < ni; k++) {
            const cx = Math.floor(k * BW / ni + r.int(10, 40)), cy = r.int(46, 68), w = r.int(10, 16);
            for (let j = 0; j < w; j++) { const hw = Math.round(w * (1 - j / w) ** 0.7); for (let i = -hw; i <= hw; i++) far.setWrap(cx + i, cy + j, j === 0 ? 7 : (i > hw / 3 ? 0xf : 0xc)); }
            if (k === 0 || r.chance(0.5)) { // Turm
                const th = r.int(14, 22);
                far.rect(cx - 3, cy - th, 6, th, 0xc, true).rect(cx + 1, cy - th, 2, th, 0xf, true);
                for (let j = 0; j < 7; j++) far.rect(cx - 4 + Math.floor(j / 2), cy - th - j, 9 - j, 1, 0xa, true);
                far.setWrap(cx, cy - th - 8, 5); far.setWrap(cx - 1, cy - th + 5, 5); far.setWrap(cx, cy - th + 11, 5);
            }
        }
        for (let x = 0; x < BW; x++) for (let y = 104 + Math.round(Math.sin(x / BW * Math.PI * 6) * 3); y < BH; y++) far.set(x, y, 0xc);
        // Riesenpilze und Glühwürmchen (nah)
        const np = r.int(3, 5);
        for (let k = 0; k < np; k++) {
            const x = Math.floor(k * BW / np + r.int(4, 24));
            mushroom(near, x, BH - 1, r.int(26, 50), r.int(6, 10), r.pick([2, 2, 0xa, 3, 9]), true);
        }
        for (let i = 0; i < 18; i++) { const x = r.int(0, BW - 1), y = r.int(30, 110); near.set(x, y, 5); if (r.chance(0.4)) near.setWrap(x + 1, y, 4); }
        return { sky, far, near };
    }

    function background(biome, seed) {
        const r = makeRand('bg:' + biome + ':' + seed);
        if (biome === 'ice') return bgIce(r);
        if (biome === 'magic') return bgMagic(r);
        if (biome === 'desert') return bgDesert(r);
        if (biome === 'space') return bgSpace(r);
        if (biome === 'underwater') return bgUnderwater(r);
        if (biome === 'scifi') return bgScifi(r);
        if (biome === 'dungeon') return bgDungeon(r);
        return bgGrass(r);
    }

    // =====================================================================
    //  TILES (16x16): groundTop, ground, platform, spikes, goal, deco
    // =====================================================================
    function speckle(p, r, colors, n, y0, y1) {
        for (let i = 0; i < n; i++) { const x = r.int(0, 15), y = r.int(y0 || 0, y1 || 15); p.set(x, y, r.pick(colors)); }
    }
    function spikes(fill, tip, base) {
        const p = new Pix(16, 16);
        for (let k = 0; k < 2; k++) for (let y = 3; y < 14; y++) {
            const hw = 0.5 + (y - 3) * 0.33;
            for (let x = k * 8; x < k * 8 + 8; x++) {
                const dx = x + 0.5 - (k * 8 + 4);
                if (Math.abs(dx) > hw) continue;
                let c = dx < 0 ? fill : DARK[fill];
                if (dx < 0 && dx > -1.2 && y > 5) c = LIGHT[fill];
                if (y < 6) c = tip;
                p.set(x, y, c);
            }
        }
        p.outline(0xf);
        p.rect(0, 13, 16, 3, base).rect(0, 13, 16, 1, DARK[base]);
        return p;
    }

    function tilesGrass(r) {
        const dirt = new Pix(16, 16).rect(0, 0, 16, 16, 0xe);
        speckle(dirt, r, [0xc, 0xc, 4, 0xd], 14);
        const top = dirt.clone();
        for (let x = 0; x < 16; x++) {
            const d = 3 + ((x * 7 + r.int(0, 2)) % 3);
            for (let y = 0; y < d; y++) top.set(x, y, y === 0 && r.chance(0.3) ? 5 : 7);
            top.set(x, d, 6);
            if (r.chance(0.25)) top.set(x, d + 1, 6);
        }
        const plat = top.clone();
        for (let x = 0; x < 16; x++) { plat.set(x, 15, 0xc); if (x % 5 === 2) plat.set(x, 14, 0xc); }
        const spk = spikes(0xb, 1, 0xc);
        const goal = new Pix(16, 16);
        goal.rect(3, 2, 1, 14, 1).rect(4, 2, 1, 14, 0xb).rect(3, 0, 2, 2, 5);
        for (let y = 2; y < 10; y++) for (let x = 5; x < 5 + (8 - Math.abs(y - 6) * 2) + 2; x++) goal.set(x, y, 2);
        goal.set(7, 5, 5).set(8, 5, 5).set(7, 6, 5).set(8, 6, 5);
        goal.rect(1, 15, 6, 1, 0xb);
        const deco = new Pix(16, 16);
        for (let i = 0; i < 7; i++) { const x = r.int(1, 14), h = r.int(2, 5); deco.rect(x, 16 - h, 1, h, r.pick([7, 6])); }
        const fx = r.int(4, 11), fc = r.pick([2, 3, 5, 0xa]);
        deco.rect(fx, 10, 1, 6, 6);
        deco.set(fx, 7, fc).set(fx - 1, 8, fc).set(fx + 1, 8, fc).set(fx, 9, fc).set(fx, 8, fc === 5 ? 4 : 5);
        return { groundTop: top, ground: dirt, platform: plat, spikes: spk, goal, deco };
    }

    function tilesScifi(r) {
        const plate = new Pix(16, 16).rect(0, 0, 16, 16, 0xc);
        plate.rect(0, 0, 16, 1, 0xb).rect(0, 0, 1, 16, 0xb).rect(15, 0, 1, 16, 0xf).rect(0, 15, 16, 1, 0xf);
        [[2, 2], [13, 2], [2, 13], [13, 13]].forEach(([x, y]) => plate.set(x, y, 0xb));
        if (r.chance(0.5)) plate.rect(5, 6, 6, 4, 0xf).rect(6, 7, 4, 2, r.pick([8, 0xa]));
        else plate.rect(4, 7, 8, 1, 0xf).rect(4, 9, 8, 1, 0xf);
        const neon = r.pick([9, 7, 3]);
        const top = plate.clone();
        top.rect(0, 0, 16, 1, 1).rect(0, 1, 16, 1, neon).rect(0, 2, 16, 1, DARK[neon]).rect(0, 3, 16, 1, 0xf);
        const crate = new Pix(16, 16).rect(0, 0, 16, 16, 0xb);
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++)
            if (x < 2 || y < 2 || x > 13 || y > 13) crate.set(x, y, ((x + y) >> 1) % 2 ? 5 : 0xf);
        crate.rect(4, 4, 8, 8, 0xc).rect(5, 5, 6, 6, 0xb).line(4, 4, 11, 11, 0xc).line(11, 4, 4, 11, 0xc);
        const spk = spikes(0xb, 2, 0xc);
        const goal = new Pix(16, 16);
        for (let y = 0; y < 12; y++) for (let x = 2; x < 14; x++) if (dither(x, y, 0.25 + (y / 24))) goal.set(x, y, x > 4 && x < 11 ? 1 : 9);
        goal.rect(1, 12, 14, 2, 0xb).rect(0, 14, 16, 2, 0xc).rect(3, 12, 10, 1, 9);
        const deco = new Pix(16, 16);
        deco.rect(3, 6, 10, 10, 0xc).rect(4, 7, 8, 5, 0xf);
        for (let y = 8; y < 12; y += 1) deco.rect(5, y, r.int(2, 6), 1, y % 2 ? 7 : 0);
        deco.set(5, 13, 2).set(7, 13, 5).set(9, 13, 7).rect(3, 6, 10, 1, 0xb);
        return { groundTop: top, ground: plate, platform: crate, spikes: spk, goal, deco };
    }

    function tilesDungeon(r) {
        const stone = new Pix(16, 16);
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
            const row = y >> 2, bx = (x + (row % 2) * 4) % 8, by = y % 4;
            stone.set(x, y, bx === 0 || by === 3 ? 0xc : (by === 0 && dither(x, y, 0.5) ? 0xd : 0xb));
        }
        speckle(stone, r, [0xc], 6);
        const top = stone.clone();
        top.rect(0, 0, 16, 1, 0xd);
        for (let x = 0; x < 16; x++) if (r.chance(0.35)) { top.set(x, 0, r.pick([7, 6])); if (r.chance(0.5)) top.set(x, 1, 6); }
        const wood = new Pix(16, 16).rect(0, 0, 16, 16, 0xe);
        [0, 5, 10].forEach(y0 => { wood.rect(0, y0, 16, 1, 4); wood.rect(0, y0 + 4, 16, 1, 0xc); });
        wood.rect(0, 15, 16, 1, 0xc);
        for (let i = 0; i < 5; i++) { const y = r.pick([2, 7, 12]), x = r.int(1, 12); wood.rect(x, y, r.int(2, 4), 1, 0xc); }
        [[2, 1], [13, 1], [2, 6], [13, 6], [2, 11], [13, 11]].forEach(([x, y]) => wood.set(x, y, 0xb));
        const spk = spikes(0xb, 1, 0xc);
        const goal = new Pix(16, 16);
        for (let y = 0; y < 16; y++) for (let x = 1; x < 15; x++) {
            const arch = y >= 6 || (x - 7.5) ** 2 + (y - 6) ** 2 <= 42;
            if (!arch) continue;
            const inner = y >= 6 ? (x > 2 && x < 13) : (x - 7.5) ** 2 + (y - 6) ** 2 <= 22;
            goal.set(x, y, inner ? ((x - 3) % 3 === 0 ? 0xc : (x % 3 === 1 ? 4 : 0xe)) : 0xb);
        }
        goal.set(10, 9, 5).set(10, 10, 5);
        const deco = new Pix(16, 16);
        deco.rect(6, 9, 4, 2, 0xe).rect(7, 11, 2, 5, 0xe).rect(6, 8, 4, 1, 0xb);
        deco.rect(6, 5, 4, 3, 4).rect(7, 3, 2, 3, 5).set(7, 2, 4).set(8, 7, 2).set(6, 7, 2).set(9, 5, 2);
        return { groundTop: top, ground: stone, platform: wood, spikes: spk, goal, deco };
    }

    function tilesUnderwater(r) {
        // Meeresboden: Sand mit Rippeln und Kieseln
        const sand = new Pix(16, 16).rect(0, 0, 16, 16, 0xd);
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ((y + Math.round(Math.sin(x / 2.5) * 1.2)) % 5 === 0 && dither(x, y, 0.7)) sand.set(x, y, 0xb);
        speckle(sand, r, [0xb, 0xe, 1], 8);
        const top = sand.clone();
        for (let x = 0; x < 16; x++) {
            const d = 1 + ((x * 5 + r.int(0, 1)) % 3 === 0 ? 1 : 0);
            for (let y = 0; y < d; y++) top.set(x, y, dither(x, y, 0.5) ? 1 : 0xd);
        }
        const sx = r.int(2, 11), shell = r.pick([3, 4, 1]); // Muschel
        top.rect(sx, 2, 3, 2, shell).set(sx + 1, 1, shell).set(sx + 1, 2, DARK[shell]).set(sx + 1, 3, LIGHT[shell]);
        // Korallenblock als Plattform
        const coral = new Pix(16, 16), cc = r.pick([3, 4, 0xa]);
        coral.rect(0, 0, 16, 16, cc);
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
            if (y === 0 && dither(x, y, 0.6)) coral.set(x, y, LIGHT[cc]);
            if (y >= 13 && dither(x, y, (y - 12) / 4)) coral.set(x, y, DARK[cc]);
        }
        for (let i = 0; i < 7; i++) { const x = r.int(1, 13), y = r.int(2, 11); coral.set(x, y, DARK[cc]).set(x + 1, y, DARK[cc]).set(x, y - 1, LIGHT[cc]); }
        // Seeigel
        const spk = new Pix(16, 16);
        for (let a = 180; a <= 360; a += 22.5) {
            const rad = a * Math.PI / 180;
            spk.line(8, 12, Math.round(8 + Math.cos(rad) * 7.5), Math.round(12 + Math.sin(rad) * 8.5), 0xf);
        }
        spk.circle(8, 12, 3.4, 0xa).circle(7, 11, 1.2, 3).set(9, 14, 0xc).set(10, 13, 0xc);
        spk.rect(2, 15, 12, 1, 0xd);
        // Ziel: Riesenmuschel mit Perle
        const goal = new Pix(16, 16);
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
            const dx = x - 7.5;
            if (y >= 10 && dx * dx / 56 + (y - 10) * (y - 10) / 30 <= 1) goal.set(x, y, Math.floor(Math.abs(dx)) % 3 === 0 ? 0xb : 0xd);
            if (y <= 7 && y >= 1 && dx * dx / 50 + (y - 7) * (y - 7) / 40 <= 1) goal.set(x, y, Math.floor(Math.abs(dx)) % 3 === 0 ? 0xb : 3);
        }
        goal.rect(3, 8, 10, 2, 0xc).circle(7.5, 8.5, 2, 1).set(7, 8, 9).set(8, 9, 9).set(7, 7, 1);
        goal.outline(0xf);
        // Deko: Seetang-Büschel mit Blase
        const deco = new Pix(16, 16);
        for (let k = 0; k < 3; k++) {
            const bx = 4 + k * 4 + r.int(-1, 1), h = r.int(6, 12), c = r.pick([7, 6]);
            for (let y = 0; y < h; y++) deco.set(bx + Math.round(Math.sin(y / 2.5 + k) * 1), 15 - y, c);
        }
        deco.set(12, 3, 9).set(11, 4, 9).set(13, 4, 9).set(12, 5, 9).set(5, 1, 9);
        return { groundTop: top, ground: sand, platform: coral, spikes: spk, goal, deco };
    }

    function tilesSpace(r) {
        // Mondgestein mit kleinen Kratern
        const rock = new Pix(16, 16).rect(0, 0, 16, 16, 0xb);
        speckle(rock, r, [0xc], 18);
        for (let k = 0; k < 2; k++) {
            const cx = r.int(3, 12), cy = r.int(3 + k * 6, 6 + k * 6);
            rock.set(cx, cy, 0xc).set(cx + 1, cy, 0xc).set(cx - 1, cy, 0xc).set(cx, cy - 1, 0xc).set(cx - 1, cy - 1, 0xf);
            rock.set(cx, cy + 1, 0xd).set(cx + 1, cy + 1, 0xd);
        }
        speckle(rock, r, [0xd], 4);
        const top = rock.clone();
        for (let x = 0; x < 16; x++) {
            const d = 2 + ((x * 3 + r.int(0, 1)) % 4 === 0 ? 1 : 0);
            for (let y = 0; y < d; y++) top.set(x, y, y === 0 ? 1 : 0xd);
            top.set(x, d, dither(x, d, 0.5) ? 0xd : 0xb);
        }
        // Gitterträger der Raumstation (durchsichtige Lücken)
        const girder = new Pix(16, 16);
        girder.rect(0, 0, 16, 3, 0xb).rect(0, 13, 16, 3, 0xb).rect(0, 0, 16, 1, 0xd).rect(0, 15, 16, 1, 0xc).rect(0, 2, 16, 1, 0xc);
        girder.line(0, 3, 9, 12, 0xb).line(1, 3, 10, 12, 0xc).line(9, 3, 15, 9, 0xb).line(15, 3, 6, 12, 0xb);
        girder.rect(0, 3, 1, 10, 0xb).rect(15, 3, 1, 10, 0xc);
        [[3, 1], [12, 1], [3, 14], [12, 14]].forEach(([x, y]) => girder.set(x, y, 0xf));
        const lamp = r.pick([2, 5, 7]); girder.set(8, 1, lamp);
        // leuchtende Kristalle als Gefahr
        const spk = new Pix(16, 16), kc = r.pick([7, 9, 5]);
        [[3, 7, 2], [8, 3, 2.5], [12, 6, 2]].forEach(([cx, ty, hw]) => {
            for (let y = ty; y < 15; y++) {
                const w = Math.min(hw, (y - ty) * 0.8 + 0.5);
                for (let x = Math.floor(cx - w); x <= Math.ceil(cx + w); x++) if (Math.abs(x - cx) <= w) spk.set(x, y, x < cx ? LIGHT[kc] : x > cx ? DARK[kc] : kc);
            }
            spk.set(cx, ty, 1);
        });
        spk.outline(0xf).rect(1, 14, 14, 2, 0xb).rect(1, 14, 14, 1, 0xd);
        // Ziel: Rakete
        const goal = new Pix(16, 16), hull = 1, nose = r.pick([2, 4, 8]);
        for (let y = 1; y < 13; y++) {
            const w = y < 5 ? Math.floor((y + 1) / 2) : 3;
            goal.rect(8 - w, y, w * 2, 1, y < 4 ? nose : (Math.floor(8 - w) === 8 - w ? hull : hull));
            goal.set(8 + w - 1, y, y < 4 ? DARK[nose] : 0xd);
        }
        goal.circle(7.5, 7, 1.5, 9).set(7, 6, 1).set(8, 8, 8);
        goal.rect(3, 10, 2, 4, nose).rect(11, 10, 2, 4, nose).rect(5, 13, 6, 1, 0xb);
        goal.set(6, 14, 4).set(9, 14, 4).set(7, 14, 5).set(8, 14, 5).set(7, 15, 2).set(8, 15, 4);
        goal.outline(0xf);
        // Deko: Flagge im Mondstaub
        const deco = new Pix(16, 16), fc = r.pick([[2, 1], [8, 5], [7, 1], [0xa, 5]]);
        deco.rect(5, 3, 1, 12, 0xb).set(5, 2, 0xd);
        deco.rect(6, 3, 7, 5, fc[0]).rect(6, 7, 7, 1, DARK[fc[0]]);
        deco.set(9, 4, fc[1]).set(8, 5, fc[1]).set(9, 5, fc[1]).set(10, 5, fc[1]).set(9, 6, fc[1]); // Stern
        deco.rect(2, 15, 9, 1, 0xd).set(10, 14, 0xb).set(11, 14, 0xb).set(12, 15, 0xb);
        return { groundTop: top, ground: rock, platform: girder, spikes: spk, goal, deco };
    }

    function tilesDesert(r) {
        // Sandstein in Schichten
        const stone = new Pix(16, 16);
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
            const yy = y + Math.round(Math.sin(x / 3) * 0.8);
            stone.set(x, y, yy % 5 === 0 ? 0xe : (yy % 5 === 3 && dither(x, y, 0.5) ? 0xe : 4));
        }
        speckle(stone, r, [0xe, 0xd], 7);
        // Sandoberfläche mit Rippeln
        const top = stone.clone();
        for (let x = 0; x < 16; x++) {
            const d = 3 + (Math.sin(x / 2.2) > 0.3 ? 1 : 0);
            for (let y = 0; y < d; y++) top.set(x, y, y === 0 ? 1 : (y === 1 && (x + 1) % 5 === 0 ? 4 : 5));
            top.set(x, d, 4);
        }
        // Ruinenblock aus Sandsteinziegeln
        const ruin = new Pix(16, 16);
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
            const row = y >> 2, bx = (x + (row % 2) * 4) % 8, by = y % 4;
            ruin.set(x, y, bx === 0 || by === 3 ? 0xb : (by === 0 ? 1 : 0xd));
        }
        speckle(ruin, r, [0xb, 4], 5, 0, 15);
        const glyph = r.int(0, 2); // eingeritzte Hieroglyphe
        if (glyph === 0) ruin.rect(5, 5, 1, 3, 0xe).rect(4, 5, 3, 1, 0xe).set(5, 4, 0xe);
        if (glyph === 1) ruin.rect(9, 5, 3, 1, 0xe).set(10, 6, 0xe).set(9, 7, 0xe).set(11, 7, 0xe);
        // Kaktus als Gefahr
        const spk = new Pix(16, 16);
        cactus(spk, 7, 14, 11, false);
        for (let y = 4; y < 14; y += 2) { spk.set(5, y, spk.get(6, y) ? 1 : 0); spk.set(9, y + 1, spk.get(8, y + 1) ? 1 : 0); }
        spk.set(7, 2, 3).set(8, 3, 3); // Blüte
        spk.outline(0xf).rect(2, 14, 12, 2, 4).rect(2, 14, 12, 1, 5);
        // Ziel: Oase mit Palme
        const goal = new Pix(16, 16);
        goal.ellipse(8, 14, 7, 1.6, 9).rect(3, 14, 10, 1, 8).set(5, 13, 1);
        for (let y = 4; y < 13; y++) goal.rect(8 + Math.round((13 - y) / 5), y, 2, 1, (y % 2) ? 0xe : 4);
        [[-1, 0], [1, 0], [-1, 1], [1, 1], [0, -1]].forEach(([dx, dy]) => {
            for (let i = 0; i < 6; i++) goal.set(10 + dx * i, 4 + dy * Math.floor(i * i / 6) - (dy < 0 ? i >> 1 : 0) + (i > 3 ? 1 : 0), i > 3 ? 6 : 7);
        });
        goal.set(9, 5, 0xe).set(11, 5, 0xe);
        goal.outline(0xf);
        // Deko: Tierschädel und Steinchen
        const deco = new Pix(16, 16);
        deco.rect(5, 11, 5, 3, 1).rect(6, 14, 3, 1, 1).set(6, 12, 0xf).set(8, 12, 0xf).set(7, 14, 0xb);
        deco.line(4, 11, 2, 9, 0xd).line(10, 11, 12, 9, 0xd).set(2, 8, 1).set(12, 8, 1);
        deco.rect(12, 14, 3, 2, 0xb).set(13, 13, 0xd).rect(1, 15, 2, 1, 0xe);
        return { groundTop: top, ground: stone, platform: ruin, spikes: spk, goal, deco };
    }

    function tilesIce(r) {
        // Eis mit Rissen und Glanz
        const ice = new Pix(16, 16).rect(0, 0, 16, 16, 9);
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (dither(x + 2, y, 0.12 + y / 60)) ice.set(x, y, 6);
        let cx = r.int(2, 6), cy = r.int(4, 8);
        for (let i = 0; i < 9; i++) { ice.set(cx, cy, 8); cx += r.pick([1, 1, 0]); cy += r.pick([1, -1, 0, 1]); cy = Math.max(1, Math.min(14, cy)); }
        ice.line(10, 2, 13, 5, 1).set(11, 2, 1).set(3, 12, 1).set(4, 11, 1);
        // Schneedecke
        const top = ice.clone();
        for (let x = 0; x < 16; x++) {
            const d = 3 + (Math.sin(x / 2.5 + r.next()) > 0.4 ? 1 : 0);
            for (let y = 0; y < d; y++) top.set(x, y, 1);
            top.set(x, d, dither(x, d, 0.5) ? 9 : 0xd);
            if (r.chance(0.2)) top.set(x, d + 1, 1); // Tropfen/Eiszapfen
        }
        // Eisblock-Plattform
        const block = new Pix(16, 16).rect(0, 0, 16, 16, 9);
        block.rect(0, 0, 16, 1, 1).rect(0, 0, 1, 16, 1).rect(15, 0, 1, 16, 6).rect(0, 15, 16, 1, 6);
        block.line(3, 3, 7, 3, 1).line(3, 3, 3, 6, 1).set(12, 11, 1).set(11, 12, 1);
        for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) if (x + y > 20 && dither(x, y, 0.4)) block.set(x, y, 6);
        // Eisspitzen als Gefahr
        const spk = new Pix(16, 16);
        [[2, 6, 1.6], [6, 2, 2], [10, 5, 1.8], [13, 8, 1.4]].forEach(([sx, ty, hw]) => {
            for (let y = ty; y < 14; y++) {
                const w = Math.min(hw, (y - ty) * 0.45 + 0.3);
                for (let x = Math.floor(sx - w); x <= Math.ceil(sx + w); x++) if (Math.abs(x - sx) <= w) spk.set(x, y, x < sx ? 1 : x > sx ? 6 : 9);
            }
        });
        spk.outline(8).rect(0, 13, 16, 3, 1).rect(0, 15, 16, 1, 9);
        // Ziel: Iglu
        const goal = new Pix(16, 16);
        for (let y = 3; y < 16; y++) for (let x = 0; x < 16; x++) {
            const dx = x - 7.5, dy = y - 15;
            if (dx * dx / 56 + dy * dy / 144 > 1) continue;
            goal.set(x, y, (y % 4 === 3) || ((x + (Math.floor(y / 4) % 2) * 2) % 4 === 0) ? 9 : 1);
        }
        goal.rect(5, 10, 6, 6, 0xf).rect(6, 9, 4, 1, 0xf).rect(4, 9, 1, 7, 6).rect(11, 9, 1, 7, 6).set(7, 12, 4).set(8, 12, 5);
        // Deko: kleiner Schneemann
        const deco = new Pix(16, 16), scarf = r.pick([2, 8, 7, 4]);
        deco.circle(8, 12, 3.2, 1).circle(8, 6, 2.2, 1).set(7, 5, 0xf).set(9, 5, 0xf).set(10, 6, 4);
        deco.rect(6, 8, 5, 1, scarf).set(10, 9, scarf).set(8, 11, 0xf).set(8, 13, 0xf);
        deco.rect(6, 3, 5, 1, 0xf).rect(7, 1, 3, 2, 0xf);
        deco.line(5, 11, 2, 9, 0xe).line(11, 11, 14, 9, 0xe);
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (deco.get(x, y) === 1 && x > 8 && dither(x, y, 0.5)) deco.set(x, y, 9);
        return { groundTop: top, ground: ice, platform: block, spikes: spk, goal, deco };
    }

    function tilesMagic(r) {
        // dunkle Zaubererde mit glimmenden Kristallsplittern
        const soil = new Pix(16, 16).rect(0, 0, 16, 16, 0xc);
        speckle(soil, r, [0xf, 0xf, 0xa], 14);
        for (let i = 0; i < 3; i++) { const x = r.int(1, 14), y = r.int(4, 14); soil.set(x, y, 9).set(x, y - 1, 1); }
        // violettes Zaubermoos mit Funkeln
        const top = soil.clone();
        for (let x = 0; x < 16; x++) {
            const d = 3 + ((x * 7 + r.int(0, 2)) % 3);
            for (let y = 0; y < d; y++) top.set(x, y, y === 0 && r.chance(0.3) ? 3 : 0xa);
            top.set(x, d, 0xc === 0xc ? 0xf : 0xf);
            if (r.chance(0.2)) top.set(x, d + 1, 0xa);
        }
        top.set(r.int(1, 14), 1, 5).set(r.int(1, 14), 2, 1);
        // schwebender Runenstein
        const rune = new Pix(16, 16).rect(0, 0, 16, 16, 0xb);
        rune.rect(0, 0, 16, 1, 0xd).rect(0, 15, 16, 1, 0xc).rect(15, 0, 1, 16, 0xc).rect(0, 0, 1, 16, 0xd);
        speckle(rune, r, [0xc], 6, 1, 14);
        const rc = r.pick([9, 5, 3]), g = r.int(0, 2);
        if (g === 0) rune.line(5, 4, 8, 11, rc).line(8, 11, 11, 4, rc).line(6, 7, 10, 7, rc);
        if (g === 1) rune.line(8, 3, 8, 12, rc).line(8, 6, 5, 4, rc).line(8, 6, 11, 4, rc).line(8, 10, 5, 12, rc);
        if (g === 2) rune.circle(8, 8, 3, rc).circle(8, 8, 2, 0xb).set(8, 8, rc).line(8, 3, 8, 13, rc);
        // Amethyst-Kristalle als Gefahr
        const spk = new Pix(16, 16), kc = r.pick([0xa, 3, 2]);
        [[4, 6, -1], [8, 1, 0], [12, 5, 1], [6, 9, -1], [10, 8, 1]].forEach(([sx, ty, lean]) => {
            for (let y = ty; y < 14; y++) {
                const x0 = sx + Math.round(lean * (14 - y) / 6);
                const w = Math.min(1.6, (y - ty) * 0.5 + 0.4);
                for (let x = Math.floor(x0 - w); x <= Math.ceil(x0 + w); x++) if (Math.abs(x - x0) <= w) spk.set(x, y, x < x0 ? LIGHT[kc] : x > x0 ? DARK[kc] : kc);
            }
            spk.set(sx + Math.round(lean * (14 - ty) / 6), ty, 1);
        });
        spk.outline(0xf).rect(1, 13, 14, 3, 0xc).rect(1, 13, 14, 1, 0xa);
        // Ziel: Zauberportal
        const goal = new Pix(16, 16);
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
            const dx = (x - 7.5) / 6.5, dy = (y - 8) / 7.5, d = Math.sqrt(dx * dx + dy * dy);
            if (d > 1) continue;
            const a = Math.atan2(dy, dx) + d * 5;
            goal.set(x, y, d > 0.85 ? 0xb : (Math.sin(a * 2) > 0.2 ? (d < 0.4 ? 1 : 3) : (d < 0.5 ? 9 : 0xa)));
        }
        goal.rect(3, 15, 10, 1, 0xc);
        // Deko: leuchtende Pilze
        const deco = new Pix(16, 16), mc = r.pick([9, 3, 5]);
        mushroom(deco, 5, 15, 3, 2, mc, false); mushroom(deco, 11, 15, 5, 3, mc === 9 ? 3 : 9, false);
        deco.set(8, 6, 5).set(2, 9, 5);
        return { groundTop: top, ground: soil, platform: rune, spikes: spk, goal, deco };
    }

    function tileset(biome, seed) {
        const r = makeRand('tiles:' + biome + ':' + seed);
        if (biome === 'ice') return tilesIce(r);
        if (biome === 'magic') return tilesMagic(r);
        if (biome === 'desert') return tilesDesert(r);
        if (biome === 'space') return tilesSpace(r);
        if (biome === 'underwater') return tilesUnderwater(r);
        if (biome === 'scifi') return tilesScifi(r);
        if (biome === 'dungeon') return tilesDungeon(r);
        return tilesGrass(r);
    }

    // =====================================================================
    //  SPIELFIGUR (16x16, schaut nach rechts, auto-Umriss)
    //  Frames: idle[2], run[4], jump[1], fall[1]
    // =====================================================================
    const CHAR_DEFAULTS = { skin: 0xd, hair: 0xe, shirt: 2, pants: 8, boots: 0xe, hat: 'none', hatColor: 2, hairStyle: 'short', cape: 0 };
    const HAIR_STYLES = ['short', 'spiky', 'long', 'bald'];
    const HATS = ['none', 'cap', 'helmet', 'band'];

    function randomCharacter(seed) {
        const r = makeRand('char:' + seed);
        return {
            skin: r.pick([0xd, 0xd, 4, 0xe, 3]),
            hair: r.pick([0xe, 5, 0xc, 4, 2, 1, 0xa]),
            shirt: r.pick([2, 8, 7, 0xa, 6, 4]),
            pants: r.pick([8, 0xc, 0xe, 6, 0xb]),
            boots: r.pick([0xe, 0xc, 2, 0xb]),
            hat: r.pick(HATS), hatColor: r.pick([2, 8, 7, 5, 0xa, 0xb]),
            hairStyle: r.pick(HAIR_STYLES),
            cape: r.chance(0.35) ? r.pick([2, 0xa, 8, 5]) : 0,
        };
    }

    function charFrame(o, pose) {
        const p = new Pix(16, 16);
        const bob = pose.bob || 0;
        // Umhang (hinten)
        if (o.cape) { p.rect(4 - (pose.capeFly || 0), 7 + bob, 2, 5 - (pose.capeFly ? 1 : 0), o.cape); if (pose.capeFly) p.rect(2, 8 + bob, 2, 3, o.cape); }
        // Beine: [x,y] Listen für hinteres und vorderes Bein
        const leg = (pts, shade) => pts.forEach(([x, y], i) => {
            const isBoot = i === pts.length - 1;
            p.rect(x, y, 2, 1, isBoot ? (shade ? DARK[o.boots] || o.boots : o.boots) : (shade ? DARK[o.pants] : o.pants));
        });
        leg(pose.back, true);
        leg(pose.front, false);
        // Körper
        p.rect(6, 7 + bob, 4, 3, o.shirt);
        p.rect(6, 10 + bob, 4, 1, o.pants);
        p.set(8, 10 + bob, 5); // Gürtelschnalle
        // Kopf
        const hy = 1 + bob;
        p.rect(5, hy, 6, 6, o.skin);
        p.set(10, hy + 3, o.skin); p.set(11, hy + 3, o.skin); // Nase
        if (pose.blink) p.rect(9, hy + 3, 1, 1, 0xf);
        else p.rect(9, hy + 2, 1, 2, 0xf);
        // Haare
        const h = o.hair;
        if (o.hairStyle !== 'bald') {
            p.rect(5, hy, 6, 2, h); p.rect(5, hy + 2, 2, 2, h); p.set(10, hy + 1, o.skin === h ? h : h);
            if (o.hairStyle === 'spiky') { p.set(5, hy - 1, h); p.set(7, hy - 1, h); p.set(9, hy - 1, h); p.set(4, hy + 1, h); }
            if (o.hairStyle === 'long') { p.rect(5, hy + 2, 2, 5, h); p.rect(4, hy + 3, 1, 4, h); }
        }
        // Hut
        if (o.hat === 'cap') { p.rect(5, hy - 1, 6, 2, o.hatColor); p.rect(10, hy + 1, 3, 1, o.hatColor); p.set(6, hy - 1, LIGHT[o.hatColor]); }
        if (o.hat === 'helmet') { p.rect(4, hy - 1, 8, 3, o.hatColor); p.rect(4, hy + 2, 2, 3, o.hatColor); p.set(6, hy - 1, LIGHT[o.hatColor]); p.set(7, hy - 1, LIGHT[o.hatColor]); }
        if (o.hat === 'band') { p.rect(5, hy + 1, 6, 1, o.hatColor); p.set(4, hy + 2, o.hatColor); p.set(3, hy + 3, o.hatColor); }
        // Arm (vorne)
        const [ax, ay] = pose.hand;
        p.line(8, 8 + bob, ax, ay + bob - 1, DARK[o.shirt]);
        p.set(ax, ay + bob, o.skin);
        return p.outline(0xf);
    }

    function character(opts) {
        const o = Object.assign({}, CHAR_DEFAULTS, opts || {});
        const stand = { back: [[6, 11], [6, 12], [6, 13]], front: [[8, 11], [8, 12], [8, 13]], hand: [8, 10] };
        const poses = {
            idle: [stand, Object.assign({}, stand, { blink: true })],
            run: [
                { back: [[6, 11], [5, 12], [4, 13]], front: [[8, 11], [9, 12], [10, 13]], hand: [6, 10], capeFly: 1 },
                { back: [[7, 11], [7, 12], [7, 13]], front: [[8, 10], [9, 11], [9, 12]], hand: [8, 10], bob: -1, capeFly: 1 },
                { back: [[8, 11], [9, 12], [10, 13]], front: [[6, 11], [5, 12], [4, 13]], hand: [10, 9], capeFly: 1 },
                { back: [[8, 10], [9, 11], [9, 12]], front: [[7, 11], [7, 12], [7, 13]], hand: [8, 10], bob: -1, capeFly: 1 },
            ],
            jump: [{ back: [[6, 11], [5, 12], [5, 12]], front: [[8, 10], [9, 11], [10, 11]], hand: [11, 5], bob: -1, capeFly: 1 }],
            fall: [{ back: [[6, 11], [6, 12], [5, 13]], front: [[8, 11], [9, 12], [10, 13]], hand: [11, 7], capeFly: 1 }],
        };
        const out = {};
        for (const k in poses) out[k] = poses[k].map(p => charFrame(o, p));
        return out;
    }

    // =====================================================================
    //  GEGNER
    // =====================================================================
    const ENEMY_TYPES = {
        slime: { name: 'Schleim', kind: 'walker' },
        robot: { name: 'Roboter', kind: 'walker' },
        skeleton: { name: 'Skelett', kind: 'walker' },
        bird: { name: 'Vogel', kind: 'flyer' },
        drone: { name: 'Drohne', kind: 'flyer' },
        bat: { name: 'Fledermaus', kind: 'flyer' },
        crab: { name: 'Krabbe', kind: 'walker' },
        fish: { name: 'Fisch', kind: 'flyer' },
        alien: { name: 'Alien', kind: 'walker' },
        ufo: { name: 'UFO', kind: 'flyer' },
        scorpion: { name: 'Skorpion', kind: 'walker' },
        vulture: { name: 'Geier', kind: 'flyer' },
        penguin: { name: 'Pinguin', kind: 'walker' },
        owl: { name: 'Schneeeule', kind: 'flyer' },
        shroom: { name: 'Pilzling', kind: 'walker' },
        wisp: { name: 'Irrlicht', kind: 'flyer' },
    };
    const BIOME_ENEMIES = { grass: ['slime', 'bird'], scifi: ['robot', 'drone'], dungeon: ['skeleton', 'bat'], underwater: ['crab', 'fish'], space: ['alien', 'ufo'], desert: ['scorpion', 'vulture'], ice: ['penguin', 'owl'], magic: ['shroom', 'wisp'] };

    function eyes(p, x, y, big) {
        p.set(x, y, 1); p.set(x + 1, y, big ? 1 : 0xf); p.set(x + 1, y + 1, 0xf); p.set(x, y + 1, 1);
    }

    function enemySlime(r) {
        const c = r.pick([7, 2, 0xa, 9, 4]);
        const frame = (rx, ry, dy) => {
            const p = new Pix(16, 16);
            p.ellipse(8, 15 - ry + dy, rx, ry, c);
            p.rect(8 - rx, 15, rx * 2 + 1, 1, 0);
            for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (p.get(x, y) === c && !p.get(x, y + 1)) p.set(x, y, DARK[c]);
            p.set(8 - Math.floor(rx / 2), 15 - ry * 2 + 2 + dy, LIGHT[c]); p.set(8 - Math.floor(rx / 2) + 1, 15 - ry * 2 + 2 + dy, LIGHT[c]);
            eyes(p, 9, 15 - ry + dy - 1); eyes(p, 12, 15 - ry + dy - 1);
            return p.outline(0xf);
        };
        const dead = new Pix(16, 16).rect(2, 13, 12, 2, c).rect(3, 12, 10, 1, c).outline(0xf);
        return { walk: [frame(5, 5, 0), frame(6, 4, 0), frame(5, 5, 0), frame(4, 6, 0)], dead };
    }

    function enemyRobot(r) {
        const body = r.pick([0xb, 8, 6]), eye = r.pick([2, 5, 7, 9]);
        const frame = (legA, legB, bob) => {
            const p = new Pix(16, 16);
            p.rect(4, 3 + bob, 9, 8, body);
            p.rect(4, 10 + bob, 9, 1, DARK[body]);
            p.rect(4, 3 + bob, 9, 1, LIGHT[body]);
            p.rect(8, 5 + bob, 5, 2, 0xf); p.rect(10, 5 + bob, 2, 2, eye);
            p.rect(8, 0 + bob, 1, 3, 0xc); p.set(8, 0 + bob, eye === 2 ? 5 : 2);
            p.rect(5, 12 - (legA ? 1 : 0), 2, 3 + (legA ? 1 : 0) - (legA ? 1 : 0), 0xc); p.rect(4 + legA, 14, 3, 1, 0xc);
            p.rect(10, 12, 2, 2, 0xc); p.rect(10 + legB, 14, 3, 1, 0xc);
            p.rect(5, 11 + bob, 7, 1, 0xc);
            return p.outline(0xf);
        };
        const dead = new Pix(16, 16).rect(3, 11, 11, 4, body).rect(8, 12, 4, 1, 0xf).rect(5, 9, 3, 2, 0xc).outline(0xf);
        return { walk: [frame(0, 1, 0), frame(1, 0, -1), frame(0, 1, 0), frame(1, 0, -1)].map((p, i) => i > 1 ? p : p), dead };
    }

    function enemySkeleton(r) {
        const bone = r.pick([1, 0xd]), eye = r.pick([2, 4, 9, 7]);
        const frame = (step, bob) => {
            const p = new Pix(16, 16);
            p.rect(5, 1 + bob, 6, 5, bone); p.rect(6, 6 + bob, 4, 1, bone);
            p.set(8, 3 + bob, 0xf); p.set(9, 3 + bob, eye); p.set(6, 3 + bob, 0xf);
            p.set(7, 6 + bob, 0xf); p.set(9, 6 + bob, 0xf);
            p.rect(7, 7 + bob, 2, 5, bone);
            for (let y = 8; y < 11; y += 2) p.rect(6, y + bob, 4, 1, DARK[bone] === 0xb ? 0xb : bone);
            p.line(7, 8 + bob, 5 - step, 11 + bob, bone); p.line(9, 8 + bob, 11 + step, 10 + bob, bone);
            p.line(7, 12, 6 - step, 15, bone); p.line(8, 12, 9 + step, 15, bone);
            return p.outline(0xf);
        };
        const dead = new Pix(16, 16).rect(3, 13, 10, 1, bone).rect(9, 10, 4, 3, bone).set(10, 11, 0xf).set(5, 12, bone).set(7, 12, bone).outline(0xf);
        return { walk: [frame(0, 0), frame(1, -1), frame(0, 0), frame(-1, -1)], dead };
    }

    function wingFrames(bodyFn, wingColor, up) {
        return up.map(u => { const p = bodyFn(); drawWings(p, wingColor, u); return p.outline(0xf); });
    }
    function drawWings(p, c, u) {
        if (u === 0) { p.rect(2, 3, 4, 2, c); p.rect(1, 1, 2, 2, c); p.rect(10, 3, 4, 2, c); p.rect(13, 1, 2, 2, c); }
        if (u === 1) { p.rect(1, 6, 5, 2, c); p.rect(10, 6, 5, 2, c); }
        if (u === 2) { p.rect(2, 9, 4, 2, c); p.rect(1, 11, 2, 2, c); p.rect(10, 9, 4, 2, c); p.rect(13, 11, 2, 2, c); }
    }
    function enemyBird(r) {
        const c = r.pick([4, 2, 8, 5]);
        const body = () => { const p = new Pix(16, 16); p.ellipse(8, 7, 4, 3, c); p.rect(12, 7, 2, 1, 5); p.set(14, 7, 4); eyes(p, 10, 5); p.set(3, 6, DARK[c]); p.set(3, 8, DARK[c]); return p; };
        const walk = wingFrames(body, DARK[c], [0, 1, 2, 1]);
        const dead = body(); drawWings(dead, DARK[c], 2);
        return { walk, dead: dead.outline(0xf) };
    }
    function enemyDrone(r) {
        const c = r.pick([0xb, 8, 0xc]), eye = r.pick([2, 5]);
        const body = () => { const p = new Pix(16, 16); p.ellipse(8, 8, 4, 3, c); p.rect(5, 10, 7, 1, DARK[c]); p.rect(7, 7, 3, 2, 0xf); p.set(8, 7, eye); p.rect(7, 4, 3, 1, 0xc); p.rect(8, 3, 1, 1, 0xc); p.rect(5, 11, 1, 2, 0xc); p.rect(11, 11, 1, 2, 0xc); return p; };
        const walk = [0, 1, 2, 1].map(u => { const p = body(); if (u === 0) p.rect(3, 2, 11, 1, 1); else if (u === 1) p.rect(5, 2, 7, 1, 0xb); else p.rect(7, 2, 3, 1, 1); return p.outline(0xf); });
        return { walk, dead: body().outline(0xf) };
    }
    function enemyBat(r) {
        const c = r.pick([0xc, 0xa, 0xf === 0 ? 0xc : 0xe]);
        const body = () => { const p = new Pix(16, 16); p.ellipse(8, 7, 2, 3, c); p.set(7, 3, c); p.set(9, 3, c); p.set(7, 6, 2); p.set(9, 6, 2); p.set(8, 9, 1); return p; };
        const walk = wingFrames(body, DARK[c] === 0xf ? c : c, [0, 1, 2, 1]);
        const dead = body(); drawWings(dead, c, 2);
        return { walk, dead: dead.outline(0xf) };
    }

    function enemyCrab(r) {
        const c = r.pick([2, 2, 4, 0xa]);
        const frame = (step, claw) => {
            const p = new Pix(16, 16);
            // Beine: je drei pro Seite, abwechselnd versetzt
            for (let k = 0; k < 3; k++) {
                const o = (k + step) % 2;
                p.line(5 - k, 11, 3 - k - o, 14, DARK[c]); p.set(3 - k - o, 15, DARK[c]);
                p.line(11 + k, 11, 13 + k + o, 14, DARK[c]); p.set(13 + k + o, 15, DARK[c]);
            }
            // Panzer
            p.ellipse(8, 10, 5, 3, c);
            p.rect(4, 12, 9, 1, DARK[c]);
            p.set(6, 8, LIGHT[c]).set(7, 8, LIGHT[c]);
            // Stielaugen
            p.rect(6, 5, 1, 3, c).rect(10, 5, 1, 3, c);
            p.set(6, 4, 1).set(10, 4, 1).set(6, 5, 0xf).set(10, 5, 0xf);
            // Scheren
            const cy = 6 - claw;
            p.line(4, 9, 2, cy + 2, c); p.line(12, 9, 14, cy + 2, c);
            p.circle(2, cy, 1.6, c).circle(14, cy, 1.6, c);
            p.set(2, cy - 1, 0).set(14, cy - 1, 0).set(1, cy, LIGHT[c]).set(15, cy, LIGHT[c]);
            return p.outline(0xf);
        };
        const dead = new Pix(16, 16);
        dead.ellipse(8, 13, 5, 2, c).rect(4, 12, 9, 1, LIGHT[c]);
        for (let k = 0; k < 3; k++) { dead.line(5 + k, 11, 4 + k * 2, 8, DARK[c]); dead.line(11 - k, 11, 12 - k * 2, 8, DARK[c]); }
        dead.set(6, 13, 0xf).set(10, 13, 0xf);
        return { walk: [frame(0, 0), frame(1, 1), frame(0, 0), frame(1, 1)], dead: dead.outline(0xf) };
    }

    function enemyFish(r) {
        const c = r.pick([4, 5, 2, 3, 9]), stripe = r.pick([1, 0xf, DARK[c]]);
        const body = (tail, flip) => {
            const p = new Pix(16, 16);
            p.ellipse(9, 8, 5, 3.4, c);
            for (let x = 5; x <= 13; x++) { if (p.get(x, 10)) p.set(x, 10, LIGHT[c]); if (p.get(x, 11)) p.set(x, 11, LIGHT[c]); }
            p.rect(8, 5, 1, 7, stripe).rect(6, 6, 1, 5, stripe);
            for (let x = 7; x <= 11; x++) p.set(x, 4 - (x === 9 ? 1 : 0), DARK[c]); // Rückenflosse
            p.set(9, 4, DARK[c]);
            for (let i = 0; i < 3; i++) for (let dy = -i - 1; dy <= i + 1; dy++) p.set(3 - i, 8 + dy + (tail - 1), DARK[c]); // Schwanz
            p.set(12, 7, 1).set(13, 7, 0xf).set(14, 9, 0xf);
            p.set(10, 10, DARK[c]).set(9, 11, DARK[c]); // Brustflosse
            if (flip) { const q = new Pix(16, 16); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) q.set(x, 15 - y, p.get(x, y)); return q; }
            return p;
        };
        const walk = [0, 1, 2, 1].map(t => body(t, false).outline(0xf));
        const dead = body(1, true);
        dead.set(12, 8, 0xf).set(13, 8, 1);
        return { walk, dead: dead.outline(0xf) };
    }

    function enemyAlien(r) {
        const c = r.pick([7, 7, 5, 9, 3]), suit = r.pick([0xa, 8, 2, 0xb]);
        const frame = (step, bob) => {
            const p = new Pix(16, 16);
            // Beine
            p.rect(6 - step, 12, 2, 3, DARK[suit]).rect(9 + step, 12, 2, 3, DARK[suit]);
            p.rect(5 - step, 15, 3, 1, 0xc).rect(9 + step, 15, 3, 1, 0xc);
            // Körper im Anzug
            p.rect(6, 9 + bob, 5, 4, suit).rect(6, 9 + bob, 5, 1, LIGHT[suit]).set(8, 11 + bob, 5);
            p.set(5, 10 + bob, c).set(11, 10 + bob, c);
            // großer Kopf mit einem Auge
            p.ellipse(8.5, 5 + bob, 4, 3.4, c);
            p.rect(6, 7 + bob, 5, 1, DARK[c]);
            p.rect(8, 3 + bob, 3, 3, 1).rect(9, 4 + bob, 2, 2, 0xf).set(9, 4 + bob, 1);
            // Antennen
            p.set(6, 1 + bob, c).set(5, 0 + bob, LIGHT[c]).set(11, 1 + bob, c).set(12, 0 + bob, LIGHT[c]);
            return p.outline(0xf);
        };
        const dead = new Pix(16, 16);
        dead.ellipse(8, 13, 5, 2.4, c).rect(4, 15, 9, 1, suit).set(7, 12, 0xf).set(9, 12, 0xf).set(8, 13, 0xf).set(7, 14, 0xf).set(9, 14, 0xf);
        return { walk: [frame(0, 0), frame(1, -1), frame(0, 0), frame(-1, -1)], dead: dead.outline(0xf) };
    }

    function enemyUfo(r) {
        const hull = r.pick([0xb, 0xd, 8]), pilot = r.pick([7, 5, 3]);
        const lights = [2, 5, 7, 9];
        const body = (k) => {
            const p = new Pix(16, 16);
            p.ellipse(8, 5, 3, 3, 9); p.set(7, 3, 1).set(6, 4, 1);           // Glaskuppel
            p.rect(7, 5, 3, 2, pilot).set(8, 5, 0xf);                          // Pilot
            p.ellipse(8, 9, 7, 2.4, hull);
            p.rect(1, 9, 15, 1, LIGHT[hull]).rect(3, 11, 11, 1, DARK[hull]);
            for (let i = 0; i < 5; i++) p.set(2 + i * 3, 10, lights[(i + k) % 4]);
            p.rect(6, 12, 5, 1, DARK[hull]);
            if (k % 2 === 0) p.rect(7, 13, 3, 1, 5); // Antrieb flackert
            return p;
        };
        const walk = [0, 1, 2, 3].map(k => body(k).outline(0xf));
        const dead = body(0).map(c => c === 9 || c === 1 ? 0xc : c);
        dead.set(4, 3, 0xb).set(3, 2, 0xc).set(5, 1, 0xb); // Rauch
        return { walk, dead: dead.outline(0xf) };
    }

    function enemyScorpion(r) {
        const c = r.pick([4, 0xe, 2, 0xc]);
        const frame = (step, tail) => {
            const p = new Pix(16, 16);
            // Beine
            for (let k = 0; k < 3; k++) {
                const o = (k + step) % 2;
                p.line(7 + k * 2, 13, 6 + k * 2 - o, 15, DARK[c]);
            }
            // Körper (Kopf rechts)
            p.ellipse(9, 12, 4, 1.8, c);
            p.rect(6, 11, 7, 1, LIGHT[c]).set(12, 11, 0xf).set(13, 12, 0xf);
            // Scheren vorne
            p.line(12, 12, 14, 10, c).rect(14, 9, 2, 2, c).set(15, 9, 0);
            // Schwanz in Segmenten nach oben über den Rücken
            const seg = [[5, 11], [3, 10], [2, 8], [2 + tail, 6], [3 + tail, 4], [5 + tail, 3]];
            seg.forEach(([x, y], i) => p.rect(x, y, 2, 2, i % 2 ? DARK[c] : c));
            p.set(7 + tail, 4, 0xf).set(7 + tail, 5, 2); // Stachel
            return p.outline(0xf);
        };
        const dead = new Pix(16, 16);
        dead.ellipse(8, 13, 5, 1.6, c).rect(3, 14, 2, 1, c).rect(1, 13, 2, 1, DARK[c]);
        for (let k = 0; k < 3; k++) dead.line(6 + k * 2, 12, 5 + k * 2, 10, DARK[c]);
        dead.set(11, 13, 0xf).set(12, 12, 0xf);
        return { walk: [frame(0, 0), frame(1, 1), frame(0, 0), frame(1, -1)], dead: dead.outline(0xf) };
    }

    function enemyVulture(r) {
        const c = r.pick([0xe, 0xc, 0xb]), head = r.pick([3, 2, 0xd]);
        const body = () => {
            const p = new Pix(16, 16);
            p.ellipse(7, 8, 3.5, 2.6, c);
            p.rect(4, 10, 6, 1, DARK[c]);
            p.rect(10, 6, 2, 1, 1).set(9, 6, 1);                 // weiße Halskrause
            p.rect(11, 4, 2, 2, head).set(12, 4, 0xf);           // nackter Kopf
            p.set(13, 5, 5).set(14, 6, 5).set(13, 6, DARK[head]); // Hakenschnabel
            p.set(2, 8, DARK[c]).set(1, 9, DARK[c]).set(2, 10, DARK[c]); // Schwanz
            p.set(6, 11, 5).set(8, 11, 5);
            return p;
        };
        const wing = (p, u) => {
            const w = DARK[c];
            if (u === 0) { p.line(5, 7, 1, 1, w); p.line(6, 7, 3, 1, w); p.line(7, 7, 5, 2, w); p.line(8, 7, 9, 2, c); }
            if (u === 1) { p.rect(0, 6, 6, 2, w); p.rect(8, 6, 1, 1, w); p.set(0, 8, w).set(2, 8, w); }
            if (u === 2) { p.line(5, 9, 1, 13, w); p.line(6, 9, 3, 13, w); p.line(7, 9, 5, 12, w); }
        };
        const walk = [0, 1, 2, 1].map(u => { const p = body(); wing(p, u); return p.outline(0xf); });
        const dead = body(); wing(dead, 2);
        dead.set(12, 4, 0xf).set(11, 5, 0xf);
        return { walk, dead: dead.outline(0xf) };
    }

    function enemyPenguin(r) {
        const back = r.pick([0xf, 0xc, 8]), scarf = r.pick([2, 7, 5, 0]);
        const frame = (step, tilt) => {
            const p = new Pix(16, 16);
            p.rect(5 - step, 14, 3, 2, 4).rect(9 + step, 14, 3, 2, 4);           // Füße
            p.ellipse(8, 9 + tilt * 0, 4, 5, back);                                // Körper
            p.ellipse(9, 10, 2.6, 3.8, 1);                                         // Bauch
            p.rect(7, 3, 5, 3, back).rect(8, 4, 2, 1, 1).set(9, 4, 0xf);          // Kopf + Auge
            p.rect(12, 5, 2, 1, 4).set(12, 6, 5);                                  // Schnabel
            p.set(4, 8 + step, back).set(3, 9 + step, back).set(3, 10 + step, back); // Flügel
            if (scarf) p.rect(7, 7, 6, 1, scarf).set(6, 8, scarf).set(6, 9, scarf);
            return p.outline(0xf === back ? 0xc : 0xf);
        };
        const dead = new Pix(16, 16);
        dead.ellipse(8, 13, 6, 2.4, back).ellipse(8, 12, 4, 1.4, 1).rect(13, 12, 2, 1, 4).set(4, 11, 0xf).set(5, 12, 1);
        return { walk: [frame(0, 0), frame(1, 0), frame(0, 0), frame(-1, 0)], dead: dead.outline(back === 0xf ? 0xc : 0xf) };
    }

    function enemyOwl(r) {
        const c = r.pick([1, 0xd, 0xb]), eye = r.pick([5, 4, 9]);
        const body = () => {
            const p = new Pix(16, 16);
            p.ellipse(8, 8, 3.6, 4, c);
            for (let y = 6; y < 12; y += 2) for (let x = 6; x < 11; x += 2) p.set(x + (y % 4 ? 1 : 0), y, 0xb);
            p.set(5, 3, c).set(11, 3, c);                                           // Federohren
            p.rect(6, 5, 2, 2, eye).rect(9, 5, 2, 2, eye).set(7, 5, 0xf).set(9, 5, 0xf);
            p.set(8, 7, 4);
            p.set(7, 12, 4).set(9, 12, 4);
            return p;
        };
        const wing = (p, u) => {
            const w = c === 1 ? 0xd : DARK[c];
            if (u === 0) { p.rect(1, 3, 4, 2, w); p.rect(12, 3, 4, 2, w); p.set(0, 2, w).set(15, 2, w); }
            if (u === 1) { p.rect(0, 7, 5, 2, w); p.rect(11, 7, 5, 2, w); }
            if (u === 2) { p.rect(2, 10, 3, 3, w); p.rect(11, 10, 3, 3, w); }
        };
        const walk = [0, 1, 2, 1].map(u => { const p = body(); wing(p, u); return p.outline(0xf); });
        const dead = body(); wing(dead, 2); dead.rect(6, 5, 5, 2, c).set(7, 6, 0xf).set(9, 6, 0xf);
        return { walk, dead: dead.outline(0xf) };
    }

    function enemyShroom(r) {
        const cap = r.pick([2, 0xa, 4, 9]);
        const frame = (step, bob) => {
            const p = new Pix(16, 16);
            p.rect(5 - step, 14, 3, 2, 0xe).rect(9 + step, 14, 3, 2, 0xe);        // Füßchen
            p.rect(5, 9 + bob, 7, 5, 0xd).rect(10, 9 + bob, 2, 5, 0xb);           // Stiel
            p.set(7, 11 + bob, 0xf).set(9, 11 + bob, 0xf).set(8, 12 + bob, 0xb);  // Gesicht
            p.ellipse(8, 6 + bob, 7, 3.6, cap);
            p.rect(1, 8 + bob, 15, 1, DARK[cap]);
            p.circle(5, 5 + bob, 1.2, 1).set(10, 4 + bob, 1).set(11, 4 + bob, 1).set(12, 7 + bob, 1).set(8, 3 + bob, LIGHT[cap]);
            return p.outline(0xf);
        };
        const dead = new Pix(16, 16);
        dead.ellipse(8, 13, 7, 2, cap).rect(1, 14, 15, 1, DARK[cap]).set(5, 12, 1).set(10, 12, 1).rect(6, 15, 5, 1, 0xd);
        return { walk: [frame(0, 0), frame(1, -1), frame(0, 0), frame(-1, -1)], dead: dead.outline(0xf) };
    }

    function enemyWisp(r) {
        const c = r.pick([9, 7, 3, 5]);
        const frame = (k) => {
            const p = new Pix(16, 16);
            for (let y = 3; y < 14; y++) {
                const w = y < 8 ? Math.sqrt(Math.max(0, 16 - (y - 7) * (y - 7))) : 4 - (y - 8) * 0.6;
                const off = y > 9 ? Math.round(Math.sin(y / 1.5 + k * 1.6) * 1.2) : 0;
                for (let x = Math.round(8 - w); x <= Math.round(8 + w); x++) p.set(x + off, y, y > 10 && (x + y + k) % 3 === 0 ? 0 : (x < 7 ? LIGHT[c] === 1 ? 1 : c : c));
            }
            p.set(6, 4, 1).set(7, 3, 1);
            p.rect(9, 6, 2, 2, 0xf).rect(6, 6, 2, 2, 0xf).set(10, 6, 1).set(7, 6, 1);
            p.set(8, 9, k % 2 ? 0xf : DARK[c]);
            return p.outline(DARK[c] === 0xf ? 0xc : DARK[c]);
        };
        const walk = [0, 1, 2, 3].map(frame);
        const dead = frame(0).map(v => v ? (v === 0xf ? 0xf : 0xb) : 0);
        return { walk, dead };
    }

    function enemy(type, seed) {
        const r = makeRand('enemy:' + type + ':' + seed);
        const fn = { slime: enemySlime, robot: enemyRobot, skeleton: enemySkeleton, bird: enemyBird, drone: enemyDrone, bat: enemyBat, crab: enemyCrab, fish: enemyFish, alien: enemyAlien, ufo: enemyUfo, scorpion: enemyScorpion, vulture: enemyVulture, penguin: enemyPenguin, owl: enemyOwl, shroom: enemyShroom, wisp: enemyWisp }[type];
        return fn(r);
    }

    // =====================================================================
    //  BOSS (32x32): walk[2], hurt, attack
    // =====================================================================
    const BOSS_TYPES = { golem: 'Stein-Golem', knight: 'Dunkler Ritter', mech: 'Kampf-Mech', kraken: 'Riesen-Krake', alien: 'Alien-Riese', pharaoh: 'Mumien-Pharao', yeti: 'Yeti', wizard: 'Erzmagier' };

    function bossYeti(r) {
        const fur = r.pick([1, 1, 0xd]), face = r.pick([9, 6, 0xb]);
        const shade = fur === 1 ? 9 : 0xb;
        const frame = (step, bob, attack) => {
            const p = new Pix(32, 32);
            p.rect(9 - step, 23, 6, 6, fur).rect(18 + step, 23, 6, 6, fur);
            p.rect(8 - step, 28, 8, 3, face).rect(17 + step, 28, 8, 3, face);
            // zotteliger Körper
            p.ellipse(16, 17 + bob, 10, 8, fur);
            for (let y = 10; y < 26; y++) for (let x = 6; x < 27; x++) if (p.get(x, y) === fur && (x * 3 + y * 5) % 7 === 0) p.set(x, y, shade);
            p.ellipse(16, 19 + bob, 5, 5, shade);
            // Kopf mit blauem Gesicht und Hörnern
            p.ellipse(16, 7 + bob, 7, 6, fur);
            p.rect(12, 5 + bob, 9, 6, face).rect(13, 6 + bob, 2, 2, 1).rect(18, 6 + bob, 2, 2, 1).set(14, 7 + bob, 0xf).set(18, 7 + bob, 0xf);
            p.rect(12, 4 + bob, 9, 1, shade);
            if (attack) p.rect(14, 9 + bob, 5, 2, 0xf).set(14, 9 + bob, 1).set(18, 9 + bob, 1);
            else p.rect(14, 9 + bob, 5, 1, 0xf);
            p.rect(8, 1 + bob, 2, 4, 0xd).rect(23, 1 + bob, 2, 4, 0xd).set(9, 0 + bob, 1).set(23, 0 + bob, 1);
            // Arme
            const ay = attack ? 5 : 13;
            p.rect(2, ay + bob, 5, 11, fur).rect(26, ay + bob, 5, 11, fur);
            p.rect(2, ay + 9 + bob, 5, 3, face).rect(26, ay + 9 + bob, 5, 3, face);
            return p.outline(0xf);
        };
        const walk = [frame(0, 0, false), frame(1, 1, false)];
        const attack = frame(0, -1, true);
        const hurt = walk[0].clone().map(v => v && v !== 0xf ? 2 : v);
        return { walk, attack, hurt };
    }

    function bossWizard(r) {
        const robe = r.pick([0xa, 8, 0xc, 2]), trim = r.pick([5, 9]), orb = r.pick([9, 7, 2, 3]);
        const frame = (step, bob, attack) => {
            const p = new Pix(32, 32);
            // Robe (glockenförmig), Saum
            for (let y = 13; y < 31; y++) {
                const w = 5 + Math.floor((y - 13) / 2);
                p.rect(16 - w + (y > 27 ? step : 0), y + (y < 29 ? bob : 0), w * 2, 1, robe);
            }
            p.rect(7, 29, 18, 2, trim);
            for (let y = 14; y < 29; y += 4) p.set(16, y + bob, trim).set(15, y + 2 + bob, trim);
            // Gesicht, Bart
            p.rect(12, 8 + bob, 8, 6, 0xd).rect(13, 9 + bob, 2, 1, 0xf).rect(17, 9 + bob, 2, 1, 0xf);
            p.set(14, 9 + bob, orb).set(18, 9 + bob, orb);
            for (let y = 12; y < 22; y++) { const w = Math.max(0, 4 - Math.floor((y - 12) / 3)); p.rect(16 - w, y + bob, w * 2, 1, 1); }
            // Spitzhut mit Sternen
            for (let j = 0; j < 9; j++) p.rect(10 + Math.floor(j / 1.3) - (j > 6 ? 0 : 0), 7 - j + bob, Math.max(2, 12 - j * 1.4), 1, robe);
            p.rect(8, 7 + bob, 16, 2, robe).rect(8, 8 + bob, 16, 1, DARK[robe]);
            p.set(14, 3 + bob, trim).set(17, 5 + bob, trim).set(20, -1 + bob + 1, trim);
            // Arme und Stab mit Kugel
            const sy = attack ? 2 : 8;
            p.rect(23, 15 + bob, 4, 6, robe).rect(5, 15 + bob, 4, 6, robe);
            p.rect(26, sy + bob, 1, 22 - sy, 0xe);
            p.circle(26.5, sy - 1 + bob, 2.4, orb).set(26, sy - 2 + bob, 1);
            if (attack) { p.circle(4, 13 + bob, 2.2, orb).set(4, 12 + bob, 1); p.set(1, 10, 5).set(7, 9, 5).set(2, 16, 5); }
            return p.outline(0xf);
        };
        const walk = [frame(0, 0, false), frame(1, 1, false)];
        const attack = frame(0, -1, true);
        const hurt = walk[0].clone().map(v => v && v !== 0xf ? 1 : v);
        return { walk, attack, hurt };
    }

    function bossPharaoh(r) {
        const band = r.pick([1, 0xd]), cloth = r.pick([8, 6, 0xa]), eye = r.pick([2, 5, 7]);
        const frame = (step, bob, attack) => {
            const p = new Pix(32, 32);
            // Beine in Binden
            p.rect(10 - step, 23, 5, 7, band).rect(18 + step, 23, 5, 7, band);
            for (let y = 24; y < 30; y += 2) { p.rect(10 - step, y, 5, 1, 0xb); p.rect(18 + step, y + 1, 5, 1, 0xb); }
            p.rect(9 - step, 29, 7, 2, 0xe).rect(17 + step, 29, 7, 2, 0xe);
            // Rumpf: Binden, goldener Kragen, Gürtel
            p.rect(9, 13 + bob, 14, 11, band);
            for (let y = 15; y < 23; y += 2) p.rect(9 + (y % 4 ? 1 : 0), y + bob, 13, 1, 0xb);
            p.rect(8, 12 + bob, 16, 3, 5);
            for (let x = 8; x < 24; x += 2) p.set(x, 14 + bob, cloth);
            p.rect(9, 21 + bob, 14, 2, 5).rect(15, 21 + bob, 2, 3, cloth);
            // Kopf mit Nemes-Kopftuch
            p.rect(8, 2 + bob, 16, 3, 5);
            for (let y = 2; y < 13; y++) {
                const w = y < 5 ? 0 : Math.min(3, y - 4);
                const col = (y % 2) ? cloth : 5;
                p.rect(8 - w, y + bob, 3 + w, 1, col); p.rect(21, y + bob, 3 + w, 1, col);
            }
            for (let x = 9; x < 23; x += 2) p.set(x, 2 + bob, cloth);
            p.rect(11, 5 + bob, 10, 7, band);
            p.rect(12, 7 + bob, 3, 2, 0xf).rect(17, 7 + bob, 3, 2, 0xf).set(13, 7 + bob, eye).set(18, 7 + bob, eye);
            p.rect(11, 6 + bob, 10, 1, 0xb);
            p.rect(15, 12 + bob, 2, 2, 5); // Bart
            if (attack) p.rect(13, 10 + bob, 6, 1, 0xf);
            p.set(16, 1 + bob, 5).set(16, 0 + bob, 2); // Uräus-Schlange
            // Arme, beim Angriff mit Krummstab nach vorn
            const ay = attack ? 9 : 14;
            p.rect(4, ay + bob, 4, 9, band).rect(24, ay + bob, 4, 9, band);
            p.rect(4, ay + 3 + bob, 4, 1, 0xb).rect(24, ay + 5 + bob, 4, 1, 0xb);
            if (attack) { p.rect(28, ay - 6 + bob, 1, 14, 5).rect(28, ay - 7 + bob, 3, 1, 5).set(30, ay - 6 + bob, 5); }
            return p.outline(0xf);
        };
        const walk = [frame(0, 0, false), frame(1, 1, false)];
        const attack = frame(0, -1, true);
        const hurt = walk[0].clone().map(v => v && v !== 0xf ? 1 : v);
        return { walk, attack, hurt };
    }

    function bossAlien(r) {
        const c = r.pick([7, 5, 3, 9]), suit = r.pick([0xa, 8, 2]), eye = r.pick([2, 0xa, 4]);
        const frame = (step, bob, attack) => {
            const p = new Pix(32, 32);
            // Beine
            p.rect(10 - step, 23, 4, 6, DARK[suit]).rect(18 + step, 23, 4, 6, DARK[suit]);
            p.rect(8 - step, 29, 7, 2, 0xc).rect(18 + step, 29, 7, 2, 0xc);
            // Rumpf im Raumanzug mit Brustlicht
            p.rect(9, 15 + bob, 14, 9, suit).rect(9, 15 + bob, 14, 1, LIGHT[suit]).rect(9, 23 + bob, 14, 1, DARK[suit]);
            p.rect(14, 18 + bob, 4, 3, 0xf).rect(15, 19 + bob, 2, 1, eye);
            // riesiger Kopf, drei Augen
            p.ellipse(16, 8 + bob, 10, 7.5, c);
            for (let y = 0; y < 17; y++) for (let x = 5; x < 28; x++) if (p.get(x, y) === c && y > 11 + bob && dither(x, y, 0.5)) p.set(x, y, DARK[c]);
            p.set(11, 3 + bob, LIGHT[c]).set(12, 2 + bob, LIGHT[c]).set(20, 3 + bob, LIGHT[c]);
            [[9, 7], [15, 5], [21, 7]].forEach(([ex, ey]) => { p.rect(ex, ey + bob, 3, 3, 1).rect(ex + 1, ey + 1 + bob, 2, 2, eye).set(ex + 2, ey + 1 + bob, 0xf); });
            if (attack) { p.rect(12, 11 + bob, 8, 3, 0xf).set(13, 11 + bob, 1).set(15, 11 + bob, 1).set(17, 11 + bob, 1).set(19, 11 + bob, 1).rect(14, 13 + bob, 4, 1, 2); }
            else p.rect(13, 12 + bob, 6, 1, 0xf);
            // Arme mit Klauen
            const ay = attack ? 8 : 16;
            p.rect(4, ay + bob, 4, 8, suit).rect(24, ay + bob, 4, 8, suit);
            p.rect(3, ay + 8 + bob, 2, 2, c).rect(6, ay + 8 + bob, 2, 2, c).rect(24, ay + 8 + bob, 2, 2, c).rect(27, ay + 8 + bob, 2, 2, c);
            return p.outline(0xf);
        };
        const walk = [frame(0, 0, false), frame(1, 1, false)];
        const attack = frame(0, -1, true);
        const hurt = walk[0].clone().map(v => v && v !== 0xf ? 1 : v);
        return { walk, attack, hurt };
    }

    function bossKraken(r) {
        const c = r.pick([0xa, 2, 3, 4]), eye = r.pick([5, 7, 9]);
        const frame = (ph, attack) => {
            const p = new Pix(32, 32);
            // Tentakel
            const bases = attack ? [11, 18] : [5, 11, 18, 24];
            // hintere (dunkle) Tentakel zuerst, dann vordere
            [1, 0].forEach(layer => bases.forEach((bx, k) => {
                if (k % 2 !== layer) return;
                const out = bx < 16 ? -1 : 1, col = layer ? DARK[c] : c;
                for (let y = 16; y < 31; y++) {
                    const w = y < 21 ? 4 : y < 26 ? 3 : 2;
                    const x = bx + Math.round(Math.sin((y - 16) / 3.5 + ph + k) * 1.5) + (y > 26 ? out * (y - 26) : 0) - (w > 3 ? 1 : 0);
                    p.rect(x, y, w, 1, col);
                    if (y % 3 === 1 && y < 28) p.set(x + (out < 0 ? w - 1 : 0), y, LIGHT[c]);
                }
            }));
            if (attack) { // zwei Fangarme nach oben gerissen
                for (let y = 2; y < 20; y++) {
                    const o = Math.round(Math.sin(y / 3) * 1.5);
                    p.rect(3 + o + Math.floor((20 - y) / 6), y, 3, 1, c); p.rect(26 - o - Math.floor((20 - y) / 6), y, 3, 1, c);
                    if (y % 3 === 0) { p.set(4 + o + Math.floor((20 - y) / 6), y, LIGHT[c]); p.set(27 - o - Math.floor((20 - y) / 6), y, LIGHT[c]); }
                }
            }
            // Kopf
            p.ellipse(16, 10, 10, 8, c);
            for (let y = 2; y < 19; y++) for (let x = 6; x < 27; x++) if (p.get(x, y) === c && y > 14 && dither(x, y, 0.5)) p.set(x, y, DARK[c]);
            p.circle(11, 5, 1.5, LIGHT[c]).set(20, 4, LIGHT[c]).set(22, 6, LIGHT[c]).set(13, 3, LIGHT[c]);
            // Augen
            [[10, 11], [19, 11]].forEach(([ex, ey]) => {
                p.rect(ex, ey, 4, 3, 1).rect(ex + 1, ey + 1, 2, 2, eye).set(ex + 2, ey + 1, 0xf);
                p.rect(ex - 1, ey - 1, 5, 1, 0xf);
            });
            p.rect(14, 15, 4, 1, 0xf);
            return p.outline(0xf);
        };
        const walk = [frame(0, false), frame(1.6, false)];
        const attack = frame(0.8, true);
        const hurt = walk[0].clone().map(v => v && v !== 0xf ? 1 : v);
        return { walk, attack, hurt };
    }

    function boss(type, seed) {
        const r = makeRand('boss:' + type + ':' + seed);
        if (type === 'kraken') return bossKraken(r);
        if (type === 'alien') return bossAlien(r);
        if (type === 'pharaoh') return bossPharaoh(r);
        if (type === 'yeti') return bossYeti(r);
        if (type === 'wizard') return bossWizard(r);
        const eye = r.pick([2, 5, 9, 7]);
        const main = type === 'golem' ? r.pick([0xb, 0xe, 6]) : type === 'mech' ? r.pick([0xb, 8, 6]) : r.pick([0xc, 0xa, 8]);
        const horns = r.chance(0.7);
        const frame = (step, bob, attack) => {
            const p = new Pix(32, 32);
            // Beine
            p.rect(9 - step, 23, 5, 7, DARK[main]); p.rect(7 - step, 29, 8, 2, 0xc);
            p.rect(18 + step, 23, 5, 7, DARK[main]); p.rect(18 + step, 29, 8, 2, 0xc);
            // Rumpf
            p.rect(7, 11 + bob, 18, 13, main);
            p.rect(7, 11 + bob, 18, 2, LIGHT[main]);
            p.rect(7, 22 + bob, 18, 2, DARK[main]);
            if (type === 'golem') { for (let i = 0; i < 6; i++) p.set(r.int(9, 22), r.int(14, 21) + bob, DARK[main]); }
            if (type === 'knight') { p.rect(15, 13 + bob, 2, 9, 5); p.rect(11, 16 + bob, 10, 2, 5); }
            if (type === 'mech') { p.rect(11, 15 + bob, 10, 5, 0xf); p.rect(12, 16 + bob, 8, 3, eye); p.rect(14, 16 + bob, 4, 1, 1); }
            // Kopf
            p.rect(10, 3 + bob, 12, 9, type === 'golem' ? main : DARK[main]);
            p.rect(10, 3 + bob, 12, 1, LIGHT[main]);
            p.rect(12, 7 + bob, 3, 2, eye); p.rect(18, 7 + bob, 3, 2, eye);
            p.set(13, 7 + bob, 1); p.set(19, 7 + bob, 1);
            if (type !== 'mech') p.rect(13, 10 + bob, 6, 1, 0xf);
            if (horns) { p.rect(8, 1 + bob, 2, 4, 1); p.rect(7, 0 + bob, 1, 2, 1); p.rect(22, 1 + bob, 2, 4, 1); p.rect(24, 0 + bob, 1, 2, 1); }
            if (type === 'mech') { p.rect(15, 0 + bob, 2, 3, 0xc); p.set(15, 0 + bob, 2); }
            // Arme
            const ay = attack ? 6 : 13;
            p.rect(2, ay + bob, 5, 10, main); p.rect(2, ay + 9 + bob, 5, 3, DARK[main]);
            p.rect(25, ay + bob, 5, 10, main); p.rect(25, ay + 9 + bob, 5, 3, DARK[main]);
            return p.outline(0xf);
        };
        const walk = [frame(0, 0, false), frame(1, 1, false)];
        const attack = frame(0, -1, true);
        const hurt = walk[0].clone().map(c => c && c !== 0xf ? 1 : c);
        return { walk, attack, hurt };
    }

    // =====================================================================
    //  ITEMS & WAFFEN
    // =====================================================================
    function items(seed) {
        const r = makeRand('items:' + seed);
        const coin = [3, 2, 0, 2].map((rx, i) => {
            const p = new Pix(8, 8);
            if (rx === 0) p.rect(3, 1, 2, 6, 4);
            else { p.ellipse(3.5, 3.5, rx, 3, 5); if (rx >= 2) { p.rect(4, 2, 1, 4, 4); p.set(2, 2, 1); } }
            if (i === 3) return p.flipX().outline(0xf).map((c, x, y) => (x === 0 || x === 7 || y === 0 || y === 7) && c === 0xf ? 0xf : c);
            return p.outline(0xf);
        });
        const gc = r.pick([[9, 6], [3, 2], [7, 6], [0xa, 0xc]]);
        const gem = Pix.fromRows([
            '........', '..aaaa..', '.abbbbb.', 'abbbbbba', '.accccb.', '..accb..', '...cb...', '........'
        ], { a: 0xf, b: gc[0], c: gc[1] });
        gem.set(3, 2, 1).set(2, 3, 1);
        const heart = Pix.fromRows([
            '........', '.ff.ff..', 'f22f22f.', 'f2122 2f'.replace(' ', '2'), 'f22222f.', '.f222f..', '..f2f...', '...f....'
        ].map(s => s.padEnd(8, '.').slice(0, 8)));
        const shot = new Pix(8, 8);
        shot.ellipse(4.5, 3.5, 2.5, 1.5, 5).rect(4, 3, 2, 1, 1).set(1, 3, 4).set(0, 3, 4).set(2, 2, 4).set(2, 4, 4);
        const slash = new Pix(16, 16);
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
            const d = Math.sqrt((x - 2) ** 2 + (y - 8) ** 2);
            if (d > 9 && d < 13.5 && x > 3) slash.set(x, y, d > 12 ? 1 : d > 10.5 ? 9 : 6);
        }
        const fire = new Pix(8, 8);
        fire.circle(3.5, 3.5, 3, 2).circle(3.5, 3.5, 2, 4).circle(3.5, 3.5, 1, 5);
        const chest = chestFrames(r);
        return { coin, gem, heart, shot, slash, fire, chestClosed: chest[0], chestOpen: chest[1] };
    }
    function chestFrames(r) {
        const wood = r.pick([0xe, 0xe, 0xc]), band = r.pick([5, 0xb]);
        const closed = new Pix(16, 16);
        closed.rect(1, 7, 14, 8, wood).rect(1, 4, 14, 3, LIGHT[wood] === 5 ? 4 : 4).rect(1, 3, 14, 1, 4);
        closed.rect(1, 7, 14, 1, 0xc).rect(3, 3, 2, 12, band).rect(11, 3, 2, 12, band);
        closed.rect(7, 6, 2, 3, 5).set(7, 7, 0xf);
        closed.outline(0xf);
        const open = new Pix(16, 16);
        open.rect(1, 7, 14, 8, wood).rect(2, 7, 12, 2, 0xf).rect(1, 1, 14, 4, 4).rect(1, 5, 14, 1, 0xc);
        open.rect(3, 1, 2, 5, band).rect(11, 1, 2, 5, band).rect(3, 9, 2, 6, band).rect(11, 9, 2, 6, band);
        open.outline(0xf);
        open.set(6, 6, 5).set(9, 5, 1).set(7, 7, 5);
        return [closed, open];
    }

    // =====================================================================
    //  SHOOTER (Draufsicht, Spieler fliegt nach oben)
    //  Hintergründe 160x120 senkrecht UND waagrecht nahtlos: far (deckend), near (transparent)
    // =====================================================================
    const SHOOTER_STYLES = { space: 'Weltall', sea: 'Ozean', desert: 'Wüste', ice: 'Eismeer' };
    const wrapXY = (p, x, y, c) => { p.d[(((y % p.h) + p.h) % p.h) * p.w + (((x % p.w) + p.w) % p.w)] = c; };
    function blobXY(p, cx, cy, rx, ry, fn) {
        for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
            const dx = (x - cx) / rx, dy = (y - cy) / ry, d = dx * dx + dy * dy;
            if (d <= 1) { const c = fn(x, y, d); if (c) wrapXY(p, x, y, c); }
        }
    }
    function shooterBackground(style, seed) {
        const r = makeRand('sbg:' + style + ':' + seed);
        const far = new Pix(BW, BH), near = new Pix(BW, BH);
        if (style === 'space') {
            for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) far.set(x, y, 0xf);
            const nc = r.pick([[0xa, 0xc], [8, 0xc], [2, 0xe]]);
            for (let k = 0; k < 3; k++) { const cx = r.int(0, BW), cy = r.int(0, BH), rx = r.int(18, 34), ry = r.int(12, 22);
                blobXY(far, cx, cy, rx, ry, (x, y, d) => dither(x, y, (1 - d) * 0.8) ? (d < 0.3 && dither(x, y, 0.5) ? nc[0] : nc[1]) : 0); }
            for (let i = 0; i < 70; i++) wrapXY(far, r.int(0, BW), r.int(0, BH), r.pick([1, 0xd, 9, 0xb]));
            for (let i = 0; i < 18; i++) { const x = r.int(0, BW), y = r.int(0, BH); wrapXY(near, x, y, 1); if (r.chance(0.3)) { wrapXY(near, x, y + 1, 9); wrapXY(near, x, y - 1, 9); } }
            for (let k = 0; k < 2; k++) asteroid(near, r, r.int(10, 150), r.int(10, 110), r.int(4, 7), true);
        } else if (style === 'sea') {
            for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) far.set(x, y, dither(x, y, 0.25 + 0.15 * Math.sin(x / BW * Math.PI * 4) * Math.sin(y / BH * Math.PI * 2)) ? 6 : 8);
            for (let i = 0; i < 40; i++) { const x = r.int(0, BW), y = r.int(0, BH); for (let k = 0; k < r.int(2, 4); k++) wrapXY(far, x + k, y, 9); }
            const ni = r.int(2, 3);
            for (let k = 0; k < ni; k++) { const cx = r.int(0, BW), cy = Math.floor(k * BH / ni + r.int(0, 20)), rx = r.int(10, 18), ry = r.int(8, 13);
                blobXY(near, cx, cy, rx + 2, ry + 2, (x, y, d) => d > 0.8 ? 9 : d > 0.62 ? 0xd : d > 0.45 ? 4 : (dither(x, y, 0.5) ? 7 : 6));
                for (let t = 0; t < 3; t++) { const px = cx + r.int(-rx / 2, rx / 2), py = cy + r.int(-ry / 2, ry / 2); wrapXY(near, px, py, 0xe); wrapXY(near, px - 1, py - 1, 7); wrapXY(near, px + 1, py - 1, 7); wrapXY(near, px, py - 2, 7); } }
            for (let i = 0; i < 4; i++) { const x = r.int(0, BW), y = r.int(0, BH); for (let k = 0; k < 9; k++) wrapXY(near, x + k, y + (k % 3 === 1 ? 1 : 0), 1); } // Wolkenfetzen
        } else if (style === 'desert') {
            const f = periodicNoise(r, BW, 4), g2 = periodicNoise(r, BH, 3);
            for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) {
                const v = f(x + Math.sin(y / BH * Math.PI * 2) * 20) * 0.6 + g2(y) * 0.4;
                far.set(x, y, ((Math.floor((y + v * 30) / 7)) % 2) ? (dither(x, y, 0.4) ? 4 : 5) : 4);
            }
            for (let i = 0; i < 25; i++) wrapXY(far, r.int(0, BW), r.int(0, BH), 0xe);
            for (let k = 0; k < 5; k++) { const cx = r.int(0, BW), cy = r.int(0, BH), rr = r.int(3, 6);
                blobXY(near, cx, cy, rr, rr * 0.8, (x, y, d) => d > 0.6 ? 0xc : (x - cx + y - cy < 0 ? 0xd : 0xb)); }
            for (let k = 0; k < 3; k++) { const cx = r.int(0, BW), cy = r.int(0, BH); for (let i = -3; i <= 3; i++) { wrapXY(near, cx + i, cy, 7); wrapXY(near, cx, cy + i, 7); } wrapXY(near, cx, cy, 6); }
        } else { // ice: Eisschollen auf dunklem Wasser
            for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) {
                const w = Math.sin(x / BW * Math.PI * 6 + Math.sin(y / BH * Math.PI * 4) * 2) * Math.cos(y / BH * Math.PI * 2);
                far.set(x, y, dither(x, y, 0.15 + Math.max(0, w) * 0.35) ? 6 : (dither(x, y, 0.2) ? 0xc : 8));
            }
            for (let k = 0; k < 6; k++) { let x = r.int(0, BW), y = r.int(0, BH); for (let i = 0; i < 14; i++) { wrapXY(far, x, y, 9); x += r.pick([1, 1, 0]); y += r.pick([1, 0, -1]); } } // Eisrisse
            const nf = r.int(5, 7);
            for (let k = 0; k < nf; k++) { const cx = r.int(0, BW), cy = r.int(0, BH), rx = r.int(8, 16), ry = r.int(6, 12);
                blobXY(near, cx, cy, rx, ry, (x, y, d) => d > 0.8 ? 9 : (dither(x, y, 0.15) ? 9 : 1)); }
        }
        return { far, near };
    }

    // Raumschiff des Spielers, Spitze nach oben; frames[0..1] mit flackerndem Antrieb
    function shooterShip(color, seed) {
        const r = makeRand('ship:' + color + ':' + seed);
        const wingStyle = r.int(0, 2);
        const frame = (flame) => {
            const p = new Pix(16, 16);
            p.rect(7, 2, 2, 11, 0xd).rect(6, 5, 4, 7, 0xd).set(7, 1, 1).set(8, 1, 0xd);   // Rumpf
            p.rect(7, 5, 2, 3, 9).set(7, 5, 1);                                              // Cockpit
            if (wingStyle === 0) for (let i = 0; i < 5; i++) { p.rect(5 - i, 8 + Math.floor(i / 2), 1, 4, color); p.rect(10 + i, 8 + Math.floor(i / 2), 1, 4, color); }
            if (wingStyle === 1) { p.rect(1, 9, 5, 3, color).rect(10, 9, 5, 3, color).rect(1, 6, 1, 4, 0xb).rect(14, 6, 1, 4, 0xb); }
            if (wingStyle === 2) for (let i = 0; i < 6; i++) { p.rect(5 - i, 6 + i, 1, 3, color); p.rect(10 + i, 6 + i, 1, 3, color); }
            p.rect(6, 12, 4, 1, DARK[color]).set(6, 9, color).set(9, 9, color);
            p.set(7, 13, 4).set(8, 13, 4);
            if (flame) { p.set(7, 14, 5).set(8, 14, 5).set(7, 15, 4); } else { p.set(7, 14, 4).set(8, 14, 5).set(8, 15, 2); }
            return p.outline(0xf);
        };
        return [frame(true), frame(false)];
    }

    // Gegner, Spitze nach unten
    const SHOOTER_ENEMIES = { fighter: 'Jäger', zigzag: 'Untertasse', diver: 'Sturzflieger', turret: 'Geschützturm' };
    function shooterEnemy(type, seed) {
        const r = makeRand('senemy:' + type + ':' + seed);
        const c = r.pick([2, 0xa, 4, 7, 3]);
        const mk = (fn) => [0, 1].map(k => { const p = new Pix(16, 16); fn(p, k); return p.outline(0xf); });
        if (type === 'fighter') return mk((p, k) => {
            p.rect(7, 3, 2, 10, 0xb).rect(6, 4, 4, 5, 0xb).set(7, 13, 0xb).set(8, 14, 0xc);
            for (let i = 0; i < 5; i++) { p.rect(5 - i, 3 + i, 1, 3, c); p.rect(10 + i, 3 + i, 1, 3, c); }
            p.rect(7, 9, 2, 2, 2).set(7, 9, 1);
            p.set(7, 2, k ? 5 : 4).set(8, 2, k ? 4 : 5).set(7, 1, k ? 2 : 0);
        });
        if (type === 'zigzag') return mk((p, k) => {
            p.ellipse(8, 8, 7, 3, c).rect(1, 8, 15, 1, DARK[c]);
            p.ellipse(8, 6, 3, 2, 9).set(7, 5, 1);
            for (let i = 0; i < 4; i++) p.set(2 + i * 4, 9, (i + k) % 2 ? 5 : 2);
        });
        if (type === 'diver') return mk((p, k) => {
            for (let y = 1; y < 14; y++) { const w = Math.max(0, Math.floor((14 - y) / 2)); p.rect(8 - w, y, w * 2, 1, y > 10 ? DARK[c] : c); }
            p.rect(7, 6, 2, 3, 0xf).set(7, 7, 2).set(8, 7, 2);
            p.set(7, 14, 0xb).set(8, 14, 0xb).set(7, 0, k ? 5 : 4).set(8, 0, k ? 4 : 5);
        });
        // turret: am Boden stehender Geschützturm (scrollt mit dem Boden)
        return mk((p, k) => {
            p.rect(2, 2, 12, 12, 0xc).rect(3, 3, 10, 10, 0xb).rect(3, 3, 10, 1, 0xd);
            p.circle(8, 8, 3.2, c).set(7, 7, LIGHT[c]);
            p.rect(7, 10, 2, 5 + k, 0xf).rect(7, 10, 1, 4, 0xc);
        });
    }

    // Endboss: 32x32, Spitze nach unten, mit Kanonen
    function shooterBoss(seed) {
        const r = makeRand('sboss:' + seed);
        const c = r.pick([0xa, 2, 8, 0xc]), glow = r.pick([2, 5, 7, 9]);
        const frame = (k) => {
            const p = new Pix(32, 32);
            p.ellipse(16, 12, 10, 9, 0xb);
            for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (p.get(x, y) === 0xb && y > 15 && dither(x, y, 0.5)) p.set(x, y, 0xc);
            p.rect(1, 9, 30, 6, c).rect(1, 9, 30, 1, LIGHT[c]).rect(1, 14, 30, 1, DARK[c]);
            p.rect(2, 15, 4, 8, 0xc).rect(26, 15, 4, 8, 0xc).rect(3, 22, 2, 4, 0xf).rect(27, 22, 2, 4, 0xf);
            p.rect(12, 20, 8, 6, 0xc).rect(14, 25, 4, 6, 0xf).rect(15, 30, 2, 2, glow);
            p.circle(16, 9, 3, 0xf).circle(16, 9, 2, glow).set(15, 8, 1);
            p.rect(8, 4, 2, 4, 0xd).rect(22, 4, 2, 4, 0xd);
            p.set(4, 12, k ? glow : 0xf).set(27, 12, k ? 0xf : glow).set(10, 12, glow).set(21, 12, glow);
            return p.outline(0xf);
        };
        const fly = [frame(0), frame(1)];
        const hurt = fly[0].clone().map(v => v && v !== 0xf ? 1 : v);
        return { fly, hurt };
    }

    function shooterItems(seed) {
        const r = makeRand('sitems:' + seed);
        const shot = new Pix(4, 8).rect(1, 0, 2, 8, 5).rect(1, 0, 2, 2, 1).set(0, 3, 4).set(3, 3, 4);
        const enemyShot = new Pix(6, 6).circle(2.5, 2.5, 2.4, 2).circle(2.5, 2.5, 1.2, 5).set(2, 2, 1);
        const icon = (letter, c) => {
            const p = new Pix(12, 12);
            p.circle(5.5, 5.5, 5.4, c).circle(5.5, 5.5, 4.2, DARK[c]);
            const L = { P: ['111', '101', '111', '100', '100'], S: ['111', '100', '111', '001', '111'], B: ['110', '101', '110', '101', '110'], L: ['100', '100', '100', '100', '111'] }[letter];
            L.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '1') p.set(4 + x, 3 + y, 1); }));
            return p.outline(0xf);
        };
        const power = icon('P', 2), shield = icon('S', 9 === 9 ? 6 : 6), bomb = icon('B', 4), life = icon('L', 7);
        const explosion = [3, 5, 7, 7].map((rad, i) => {
            const p = new Pix(16, 16);
            for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
                const d = Math.hypot(x - 7.5, y - 7.5) + (r.next() - 0.5) * 2;
                if (d > rad) continue;
                p.set(x, y, i === 3 ? (dither(x, y, 0.4) ? 0xb : 0) : d < rad * 0.35 ? 1 : d < rad * 0.65 ? 5 : d < rad * 0.85 ? 4 : 2);
            }
            return p;
        });
        const shieldRing = new Pix(20, 20);
        for (let a = 0; a < 360; a += 8) { const x = Math.round(9.5 + Math.cos(a * Math.PI / 180) * 9), y = Math.round(9.5 + Math.sin(a * Math.PI / 180) * 9); if (a % 24) shieldRing.set(x, y, 9); }
        return { shot, enemyShot, power, shield, bomb, life, explosion, shieldRing };
    }

    // =====================================================================
    //  Export-Helfer
    // =====================================================================
    function framesToTS(name, frames, indent) {
        indent = indent || '    ';
        return `${indent}export const ${name}: Image[] = [\n` + frames.map(f => indent + '    ' + f.toMakeCode(indent + '    ')).join(',\n') + `\n${indent}]\n`;
    }
    function imageToTS(name, img, indent) {
        indent = indent || '    ';
        return `${indent}export const ${name} = ${img.toMakeCode(indent)}\n`;
    }

    // =====================================================================
    //  MakeCode-Projekt-Export (.mkcd): benannte Assets für die Block-Galerie
    //  Format wie im MakeCode-Editor: images.g.jres/.ts (Bilder, Animationen)
    //  und tilemap.g.jres/.ts (Kacheln, Tilemaps).
    // =====================================================================
    const hex2 = n => ('0' + n.toString(16)).slice(-2);
    const bytesToHex = bytes => Array.from(bytes, hex2).join('');
    function base64(str) {
        if (typeof btoa === 'function') return btoa(str);
        return Buffer.from(str, 'binary').toString('base64');
    }
    const bytesToBase64 = bytes => base64(String.fromCharCode.apply(null, Array.from(bytes)));

    // Bild im f4-Format (spaltenweise, 4 Bit pro Pixel, Spalten auf 4 Byte ausgerichtet)
    function f4Bytes(p) {
        const out = [0x87, 4, p.w & 255, p.w >> 8, p.h & 255, p.h >> 8, 0, 0];
        let ptr = 4, cur = 0, shift = 0;
        const push = n => {
            cur |= n << shift;
            if (shift === 4) { out.push(cur); ptr++; cur = 0; shift = 0; } else shift += 4;
        };
        for (let x = 0; x < p.w; x++) {
            for (let y = 0; y < p.h; y++) push(p.get(x, y));
            while (shift !== 0) push(0);
            while (ptr & 3) push(0);
        }
        return out;
    }
    // Rohes Bitmap (zeilenweise, 2 Pixel pro Byte, unteres Halbbyte zuerst) – für Animationen und Wand-Ebene
    function rawBitmap(w, h, get) {
        const out = new Uint8Array(Math.ceil(w * h / 2));
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const i = x + y * w, v = get(x, y) & 15;
            out[i >> 1] |= (i & 1) ? v << 4 : v;
        }
        return out;
    }
    const le16 = n => [n & 255, (n >> 8) & 255];
    function imageLiteral(p, indent) {
        let s = 'img`\n';
        for (let y = 0; y < p.h; y++) {
            const row = [];
            for (let x = 0; x < p.w; x++) row.push(HEX[p.get(x, y)]);
            s += indent + row.join(' ') + '\n';
        }
        return s + indent.slice(4) + '`';
    }
    function factory(kind, entries) {
        const I = '    ';
        return `\n${I}helpers._registerFactory("${kind}", function(name: string) {\n${I}${I}switch(helpers.stringTrim(name)) {\n` +
            entries.map(e => e.keys.map(k => `${I}${I}${I}case "${k}":`).join('\n') + `return ${e.expression};`).join('\n') +
            `\n${I}${I}}\n${I}${I}return null;\n${I}})\n`;
    }

    /**
     * Baut die vier Asset-Dateien eines MakeCode-Projekts.
     * spec.images:   [{name, p}]                 -> assets.image`name`
     * spec.anims:    [{name, frames, interval}]  -> assets.animation`name`
     * spec.tiles:    [{name, p}]                 -> assets.tile`name` (Kacheln für den Tilemap-Editor)
     * spec.tilemaps: [{name, w, h, grid, walls, tileNames}] -> tilemap`name`
     *   grid-Werte: 0 = leer, n = tileNames[n-1]; walls: 0/1 je Feld
     */
    function buildAssetFiles(spec) {
        const images = (spec.images || []).map((im, i) => ({ id: 'image' + (i + 1), display: im.name, p: im.p }));
        const anims = (spec.anims || []).map((a, i) => ({ id: 'anim' + (i + 1), display: a.name, frames: a.frames, interval: a.interval || 100 }));
        const imgJres = { '*': { mimeType: 'image/x-mkcd-f4', dataEncoding: 'base64', namespace: 'myImages' } };
        images.forEach(im => imgJres[im.id] = { data: bytesToBase64(f4Bytes(im.p)), mimeType: 'image/x-mkcd-f4', displayName: im.display });
        anims.forEach(a => {
            const w = a.frames[0].w, h = a.frames[0].h;
            const bytes = [...le16(a.interval), ...le16(w), ...le16(h), ...le16(a.frames.length)];
            a.frames.forEach(f => bytes.push(...rawBitmap(w, h, (x, y) => f.get(x, y))));
            imgJres[a.id] = { namespace: 'myAnimations', id: a.id, mimeType: 'application/mkcd-animation', data: base64(bytesToHex(bytes)), displayName: a.display };
        });
        const I3 = '                    ';
        const imgTs = '// Auto-generated code. Do not edit.\nnamespace myImages {\n' +
            factory('image', images.map(im => ({ keys: [im.id, im.display], expression: imageLiteral(im.p, I3) }))) +
            factory('animation', anims.map(a => ({ keys: [a.display, a.id], expression: '[' + a.frames.map(f => imageLiteral(f, I3)).join(', ') + ']' }))) +
            factory('song', []) + factory('json', []) +
            '\n}\n// Auto-generated code. Do not edit.\n';

        const tileList = [{ id: 'transparency16', display: null, p: new Pix(16, 16) }]
            .concat((spec.tiles || []).map((t, i) => ({ id: 'tile' + (i + 1), display: t.name, p: t.p })));
        const idByName = {};
        tileList.forEach(tl => { if (tl.display) idByName[tl.display] = tl.id; });
        const tmJres = { '*': { mimeType: 'image/x-mkcd-f4', dataEncoding: 'base64', namespace: 'myTiles' } };
        tileList.forEach(tl => {
            tmJres[tl.id] = { data: bytesToBase64(f4Bytes(tl.p)), mimeType: 'image/x-mkcd-f4', tilemapTile: true };
            if (tl.display) tmJres[tl.id].displayName = tl.display;
        });
        const tilemapEntries = (spec.tilemaps || []).map(tm => {
            const refs = ['myTiles.transparency16'].concat(tm.tileNames.map(n => {
                if (!idByName[n]) throw new Error('Tilemap ' + tm.name + ': unbekannte Kachel ' + n);
                return 'myTiles.' + idByName[n];
            }));
            const bytes = [16, ...le16(tm.w), ...le16(tm.h), ...tm.grid, ...rawBitmap(tm.w, tm.h, (x, y) => tm.walls[x + y * tm.w] ? 2 : 0)];
            tmJres[tm.name] = { id: tm.name, mimeType: 'application/mkcd-tilemap', data: base64(bytesToHex(bytes)), tileset: refs, displayName: tm.name };
            const wallLit = 'img`\n' + Array.from({ length: tm.h }, (_, y) => I3 + Array.from({ length: tm.w }, (_, x) => tm.walls[x + y * tm.w] ? '2' : '.').join(' ')).join('\n') + '\n                `';
            return { keys: [tm.name, tm.name], expression: `tiles.createTilemap(hex\`${bytesToHex([...le16(tm.w), ...le16(tm.h), ...tm.grid])}\`, ${wallLit}, [${refs.join(',')}], TileScale.Sixteen)` };
        });
        const tmTs = '// Auto-generated code. Do not edit.\nnamespace myTiles {\n' +
            tileList.map(tl => `    //% fixedInstance jres blockIdentity=images._tile\n    export const ${tl.id} = image.ofBuffer(hex\`\`);\n`).join('') +
            factory('tilemap', tilemapEntries) +
            factory('tile', tileList.map(tl => ({ keys: tl.display ? [tl.display, tl.id] : [tl.id], expression: tl.id }))) +
            '\n}\n// Auto-generated code. Do not edit.\n';
        return {
            'images.g.jres': JSON.stringify(imgJres, null, 4), 'images.g.ts': imgTs,
            'tilemap.g.jres': JSON.stringify(tmJres, null, 4), 'tilemap.g.ts': tmTs,
        };
    }

    // Erweiterungen, die der Export optional einbinden kann (Name -> pxt.json-Abhängigkeit)
    const EXTENSIONS = {
        pixelquest: { label: 'Pixel-Quest-Erweiterung', spec: 'github:theodorthg/pxt-pixelquest#v0.5.1' },
        pixelshooter: { label: 'Pixel-Shooter-Erweiterung', spec: 'github:theodorthg/pxt-pixelshooter#v0.1.0' },
    };

    // =====================================================================
    //  PIXEL-QUEST: Asset-Namen, Markierungs-Kacheln, Text-Level
    // =====================================================================
    const PQ_STYLES = ['grass', 'scifi', 'dungeon', 'underwater', 'space', 'desert', 'ice', 'magic'];
    const PQ_STYLE_ENUM = ['Grass', 'SciFi', 'Dungeon', 'Underwater', 'Space', 'Desert', 'Ice', 'Magic'];
    const PQ_MARKERS = ['pqStart', 'pqCoin', 'pqGem', 'pqHeart', 'pqChest', 'pqChestHeart', 'pqWalker', 'pqFlyer', 'pqBoss', 'pqGate'];
    const PQ_MARKER_CHARS = 'PcghCHefBX';   // Zeichen in Text-Leveln, gleiche Reihenfolge wie PQ_MARKERS

    // Markierungs-Kacheln: das Spielbild mit gestricheltem Farbrahmen (werden beim Laden durch Leer ersetzt)
    function markers(opts) {
        opts = opts || {};
        const it = items(opts.itemSeed || '1'), ch = character(opts.char || {});
        const [wt, ft] = BIOME_ENEMIES[opts.style || 'grass'];
        const walker = enemy(wt, opts.enemySeed || '1'), flyer = enemy(ft, opts.enemySeed || '1');
        const bo = boss(opts.bossType || 'knight', opts.bossSeed || '1');
        const center = (src) => new Pix(16, 16).blit(src, Math.floor((16 - src.w) / 2), Math.floor((16 - src.h) / 2));
        const half = (src) => { const p = new Pix(src.w >> 1, src.h >> 1); for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) p.set(x, y, src.get(x * 2, y * 2) || src.get(x * 2 + 1, y * 2 + 1)); return p; };
        const frame = (p, c) => { for (let i = 0; i < 16; i++) if (i % 4 < 2) { p.set(i, 0, c); p.set(i, 15, c); p.set(0, i, c); p.set(15, i, c); } return p; };
        const gate = new Pix(16, 16);
        for (let x = 3; x < 14; x += 3) gate.rect(x, 2, 1, 12, 0xb).rect(x + 1, 2, 1, 12, 0xc);
        gate.rect(2, 2, 12, 1, 0xc).rect(2, 13, 12, 1, 0xc);
        const chestHeart = it.chestClosed.clone().blit(it.heart, 8, 0);
        return [
            frame(center(ch.idle[0]), 7), frame(center(it.coin[0]), 5), frame(center(it.gem), 5), frame(center(it.heart), 5),
            frame(center(it.chestClosed), 4), frame(center(chestHeart), 4), frame(center(walker.walk[0]), 2),
            frame(center(flyer.walk[0]), 2), frame(center(half(bo.walk[0])), 0xa), frame(gate, 0xb),
        ];
    }

    /**
     * Alle Assets unter den Namen, nach denen die Pixel-Quest-Engine sucht.
     * opts.styles: [{style:'grass'|'scifi'|'dungeon', seed}], opts.char, opts.bossType/bossSeed, opts.itemSeed, opts.enemySeed
     */
    function pixelquestAssets(opts) {
        const images = [], anims = [], tiles = [];
        const ch = character(opts.char || {});
        anims.push({ name: 'heroIdle', frames: [ch.idle[0], ch.idle[0], ch.idle[0], ch.idle[1]], interval: 250 });
        anims.push({ name: 'heroRun', frames: ch.run, interval: 90 });
        images.push({ name: 'heroJump', p: ch.jump[0] }, { name: 'heroFall', p: ch.fall[0] });
        const bo = boss(opts.bossType || 'knight', opts.bossSeed || '1');
        anims.push({ name: 'bossWalk', frames: bo.walk, interval: 250 });
        images.push({ name: 'bossAttack', p: bo.attack }, { name: 'bossHurt', p: bo.hurt });
        const it = items(opts.itemSeed || '1');
        anims.push({ name: 'coinSpin', frames: it.coin, interval: 120 });
        ['gem', 'heart', 'shot', 'fire', 'slash', 'chestClosed', 'chestOpen'].forEach(k => images.push({ name: k, p: it[k] }));
        (opts.styles || []).forEach(({ style, seed }) => {
            const bg = background(style, seed), t = tileset(style, seed);
            ['sky', 'far', 'near'].forEach(k => images.push({ name: style + cap(k), p: bg[k] }));
            ['groundTop', 'ground', 'platform', 'spikes', 'goal', 'deco'].forEach(k => tiles.push({ name: style + cap(k), p: t[k] }));
            const [wt, ft] = BIOME_ENEMIES[style];
            const w = enemy(wt, opts.enemySeed || seed), f = enemy(ft, opts.enemySeed || seed);
            anims.push({ name: wt + 'Walk', frames: w.walk, interval: 160 }, { name: ft + 'Fly', frames: f.walk, interval: 100 });
            images.push({ name: wt + 'Dead', p: w.dead }, { name: ft + 'Dead', p: f.dead });
        });
        const firstStyle = ((opts.styles || [])[0] || {}).style || 'grass';
        markers(Object.assign({}, opts, { style: firstStyle })).forEach((p, i) => tiles.push({ name: PQ_MARKERS[i], p }));
        return { images, anims, tiles };
    }

    // Text-Level (Legende wie tools/build-levels.js) -> Tilemap-Spezifikation für buildAssetFiles
    function asciiLevel(name, rows, style) {
        const w = Math.max(...rows.map(r => r.length)), h = rows.length;
        const grid = rows.map(r => r.padEnd(w, '.'));
        const tileNames = ['groundTop', 'ground', 'platform', 'spikes', 'goal', 'deco'].map(k => style + cap(k)).concat(PQ_MARKERS);
        const cells = [], walls = [];
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const c = grid[y][x];
            let t = 0;
            if (c === '#') t = (y > 0 && grid[y - 1][x] === '#') ? 2 : 1;
            else if (c === '=') t = 3; else if (c === '^') t = 4; else if (c === 'G') t = 5; else if (c === 'd') t = 6;
            else if (PQ_MARKER_CHARS.indexOf(c) >= 0) t = 7 + PQ_MARKER_CHARS.indexOf(c);
            else if (c !== '.') throw new Error(name + ': unbekanntes Zeichen ' + c);
            cells.push(t); walls.push(c === '#' || c === '=' ? 1 : 0);
        }
        return { name, w, h, grid: cells, walls, tileNames };
    }

    // Kleine Beispielwelt für den Pixel-Quest-Export (56 x 10)
    function exampleWorldRows() {
        const W = 56, H = 10, g = Array.from({ length: H }, () => Array(W).fill('.'));
        const put = (ch, row, ...cols) => cols.forEach(c => g[row][c] = ch);
        for (let x = 0; x < W; x++) { g[8][x] = '#'; g[9][x] = '#'; }
        for (let y = 0; y < H; y++) { g[y][0] = '#'; g[y][W - 1] = '#'; }
        [14, 15, 30, 31, 32].forEach(x => { g[8][x] = '.'; g[9][x] = '.'; });
        for (let x = 8; x <= 10; x++) g[6][x] = '='; for (let x = 20; x <= 23; x++) g[5][x] = '=';
        for (let x = 26; x <= 28; x++) g[3][x] = '='; for (let x = 40; x <= 43; x++) g[6][x] = '=';
        put('c', 7, 4, 5, 6, 46, 47, 48); put('c', 5, 9, 10); put('c', 4, 21, 22); put('c', 6, 14, 15); put('c', 5, 30, 31, 32);
        put('g', 2, 27); put('C', 7, 18); put('H', 7, 36);
        put('e', 7, 12, 24, 44); put('f', 4, 34); put('^', 7, 38, 39); put('d', 7, 3, 17, 50);
        put('P', 7, 2); put('G', 7, 53);
        return g.map(r => r.join(''));
    }

    /**
     * Zufällige Welt im Text-Level-Format (Legende wie asciiLevel), Schwierigkeit steigt mit index.
     * withBoss: am Ende eine Boss-Arena mit Tor (X) und Endboss (B) statt Ziel (G).
     */
    function generateWorldRows(seed, index, total, withBoss) {
        const r = makeRand('world:' + seed + ':' + index);
        const d = total > 1 ? index / (total - 1) : 0;          // 0 = leicht … 1 = schwer
        const H = 10, arena = withBoss ? 30 : 0, W = 64 + index * 18 + arena;
        const g = Array.from({ length: H }, () => Array(W).fill('.'));
        const put = (ch, row, col) => { if (col > 0 && col < W - 1 && g[row][col] === '.') g[row][col] = ch; };
        for (let x = 0; x < W; x++) { g[8][x] = '#'; g[9][x] = '#'; }
        for (let y = 0; y < H; y++) { g[y][0] = '#'; g[y][W - 1] = '#'; }
        put('P', 7, 2); put('d', 7, 4);
        const end = W - 1 - (withBoss ? arena : 5);
        let x = 7, heart = false;
        while (x < end - 4) {
            const f = r.next();
            if (f < 0.22 + d * 0.12) {                     // Grube mit Münzen darüber
                const w = Math.min(end - x - 2, r.chance(0.3 + d * 0.5) ? 3 : 2);
                for (let i = 0; i < w; i++) { g[8][x + i] = '.'; g[9][x + i] = '.'; put('c', 5, x + i); }
                if (w === 3 && r.chance(0.5)) for (let i = 0; i < 3; i++) g[4][x + i] = '=';
                x += w + r.int(2, 3);
            } else if (f < 0.45) {                          // Plattformen mit Münzen, oben ein Edelstein
                const w = r.int(3, 4), row = r.pick([5, 6]);
                for (let i = 0; i < w; i++) { g[row][x + i] = '='; put('c', row - 1, x + i); }
                if (r.chance(0.4)) { const x2 = x + w + 1; for (let i = 0; i < 3; i++) g[row - 3][x2 + i] = '='; put('g', row - 4, x2 + 1); }
                if (r.chance(0.3 + d * 0.3)) put('e', 7, x + 1);
                x += w + r.int(3, 5);
            } else if (f < 0.62) {                          // Gegner am Boden
                put('e', 7, x); if (r.chance(d * 0.6)) put('e', 7, x + 3);
                put('c', 7, x + 1); x += r.int(4, 6);
            } else if (f < 0.72 + d * 0.08) {               // Stacheln
                const w = r.chance(0.3 + d * 0.4) ? 2 : 1;
                for (let i = 0; i < w; i++) put('^', 7, x + i);
                put('c', 5, x); x += w + r.int(3, 4);
            } else if (f < 0.84) {                          // Flieger
                put('f', r.int(3, 5), x + 1); put('c', 7, x); put('c', 7, x + 1); x += r.int(4, 6);
            } else if (f < 0.93) {                          // Truhe
                put(!heart && r.chance(0.4) ? (heart = true, 'H') : 'C', 7, x); put('d', 7, x + 2); x += r.int(4, 5);
            } else { put('c', 7, x); put('c', 7, x + 1); put('c', 7, x + 2); x += 5; }
        }
        if (withBoss) {
            const a = W - 1 - arena;
            put('H', 7, a - 2);
            put('X', 1, a + 4);                               // Tor schließt sich hinter dem Spieler
            for (let i = 0; i < 3; i++) { g[5][a + 11 + i] = '='; g[5][a + 21 + i] = '='; }
            put('B', 6, W - 9);
            put('d', 7, a + 1); put('d', 7, W - 3);
        } else put('G', 7, W - 3);
        return g.map(row => row.join(''));
    }

    /**
     * Baut ein MakeCode-Arcade-Projekt mit allen Assets eines Biom/Seed-Sets.
     * opts.pixelquest = true: Pixel-Quest-Projekt (Asset-Namen der Engine, Markierungs-Kacheln, Beispielwelt „welt1“)
     *   opts.worlds = ['grass', 'ice', …]: eine Welt je Biom (welt1, welt2, …), sonst nur welt1 im Biom opts.biome.
     *   opts.bossInLast = true: bei mehreren Welten endet die letzte mit Boss-Arena.
     * Rückgabe: { files, mkcd, name, names }
     */
    function makecodeProject(opts) {
        opts = opts || {};
        const seed = opts.seed || '1', biome = opts.biome || 'grass', B = biome;
        const name = opts.name || ('assets-' + biome + '-' + seed);
        let spec, mainTs;
        if (opts.pixelquest) {
            const worlds = opts.worlds && opts.worlds.length ? opts.worlds : null;
            const used = worlds ? worlds.filter((b, i) => worlds.indexOf(b) === i) : [biome];
            spec = pixelquestAssets({ styles: used.map(style => ({ style, seed })), char: opts.char, bossType: opts.boss || 'knight', bossSeed: seed, itemSeed: seed, enemySeed: seed });
            spec.tilemaps = worlds
                ? worlds.map((b, i) => asciiLevel('welt' + (i + 1), generateWorldRows(seed, i, worlds.length, !!opts.bossInLast && worlds.length > 1 && i === worlds.length - 1), b))
                : [asciiLevel('welt1', exampleWorldRows(), biome)];
            mainTs = (worlds || [biome]).map((b, i) =>
                `pixelquest.setWorld(${i + 1}, tilemap\`welt${i + 1}\`, pixelquest.Style.${PQ_STYLE_ENUM[PQ_STYLES.indexOf(b)]})`).concat([
                'pixelquest.setLives(3)',
                'pixelquest.startGame()',
                '',
            ]).join('\n');
        } else {
            const bg = background(biome, seed), t = tileset(biome, seed), ch = character(opts.char || {});
            const it = items(seed), bo = boss(opts.boss || 'golem', seed);
            const [walkerType, flyerType] = BIOME_ENEMIES[biome];
            const walker = enemy(walkerType, seed), flyer = enemy(flyerType, seed);
            const images = [], anims = [];
            const addImg = (n, p) => images.push({ name: n, p }), addAnim = (n, frames, interval) => anims.push({ name: n, frames, interval });
            addImg(B + 'Sky', bg.sky); addImg(B + 'Far', bg.far); addImg(B + 'Near', bg.near);
            addImg('heroStand', ch.idle[0]); addImg('heroJump', ch.jump[0]); addImg('heroFall', ch.fall[0]);
            addAnim('heroRun', ch.run, 100); addAnim('heroRunLeft', ch.run.map(f => f.flipX()), 100);
            addAnim('heroIdle', [ch.idle[0], ch.idle[0], ch.idle[0], ch.idle[1]], 250);
            addImg(walkerType, walker.walk[0]); addAnim(walkerType + 'Walk', walker.walk, 150); addImg(walkerType + 'Dead', walker.dead);
            addImg(flyerType, flyer.walk[0]); addAnim(flyerType + 'Fly', flyer.walk, 100); addImg(flyerType + 'Dead', flyer.dead);
            addImg('boss', bo.walk[0]); addAnim('bossWalk', bo.walk, 250); addImg('bossAttack', bo.attack); addImg('bossHurt', bo.hurt);
            addImg('coin', it.coin[0]); addAnim('coinSpin', it.coin, 120);
            ['gem', 'heart', 'shot', 'fire', 'slash', 'chestClosed', 'chestOpen'].forEach(k => addImg(k, it[k]));
            const tiles = ['groundTop', 'ground', 'platform', 'spikes', 'goal', 'deco'].map(k => ({ name: B + cap(k), p: t[k] }));
            const rows = [
                '................................',
                '................................',
                '.........===..........====......',
                '................................',
                '....d.........===..........d..G.',
                '######...######....####^^#######',
                '######...######....#############',
                '######...######....#############',
            ];
            const lvl = asciiLevel('demoLevel', rows, biome);
            lvl.tileNames = lvl.tileNames.slice(0, 6);
            spec = { images, anims, tiles, tilemaps: [lvl] };
            mainTs = [
                `scene.setBackgroundImage(assets.image\`${B}Sky\`)`,
                'tiles.setCurrentTilemap(tilemap`demoLevel`)',
                'let hero = sprites.create(assets.image`heroStand`, SpriteKind.Player)',
                'controller.moveSprite(hero, 80, 0)',
                'hero.ay = 400',
                'tiles.placeOnTile(hero, tiles.getTileLocation(1, 4))',
                'scene.cameraFollowSprite(hero)',
                'animation.runImageAnimation(hero, assets.animation`heroIdle`, 250, true)',
                'let coin = sprites.create(assets.image`coin`, SpriteKind.Food)',
                'tiles.placeOnTile(coin, tiles.getTileLocation(10, 1))',
                'animation.runImageAnimation(coin, assets.animation`coinSpin`, 120, true)',
                'controller.A.onEvent(ControllerButtonEvent.Pressed, function () {',
                '    if (hero.isHittingTile(CollisionDirection.Bottom)) {',
                '        hero.vy = -170',
                '    }',
                '})',
                'sprites.onOverlap(SpriteKind.Player, SpriteKind.Food, function (sprite, otherSprite) {',
                '    otherSprite.destroy(effects.confetti, 200)',
                '    info.changeScoreBy(10)',
                '})',
                '',
            ].join('\n');
        }
        const readme = `# ${name}\n\nErzeugt mit dem Arcade Asset Generator (Seed "${seed}", Biom ${biome}).\n` +
            'Alle Bilder, Animationen und Kacheln liegen im Assets-Tab und in der Bild-Galerie „Meine Assets“.\n' +
            (opts.pixelquest ? '\nPixel-Quest: Die Engine nimmt Assets mit ihren festen Namen (z. B. heroRun, grassSky) aus diesem Projekt; ' +
                'die Welt „welt1“ lässt sich im Tilemap-Editor bearbeiten, Spielobjekte werden mit den pq…-Kacheln gesetzt.\n' : '');
        const files = Object.assign({
            'pxt.json': JSON.stringify({
                name, description: 'Assets aus dem Arcade Asset Generator', dependencies: Object.assign({ device: '*' }, opts.extensions || {}),
                files: ['main.blocks', 'main.ts', 'README.md', 'assets.json', 'images.g.jres', 'images.g.ts', 'tilemap.g.jres', 'tilemap.g.ts'],
                preferredEditor: 'blocksprj',
            }, null, 4),
            'main.blocks': '',
            'main.ts': mainTs,
            'README.md': readme,
            'assets.json': '',
        }, buildAssetFiles(spec));
        const mkcd = JSON.stringify({ meta: { cloudId: 'pxt/arcade', editor: 'blocksprj', name }, source: JSON.stringify(files, null, 2) });
        return {
            files, mkcd, name,
            names: {
                images: spec.images.map(i => i.name), animations: spec.anims.map(a => a.name),
                tiles: spec.tiles.map(t => t.name), tilemaps: spec.tilemaps.map(t => t.name),
            },
        };
    }
    const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

    // =====================================================================
    //  PIXEL-SHOOTER: Assets unter den Namen der Engine und spielbares Projekt
    // =====================================================================
    const PS_STYLES = ['space', 'sea', 'desert', 'ice'];
    const PS_STYLE_ENUM = ['Space', 'Sea', 'Desert', 'Ice'];
    const PS_SHIP_COLORS = [8, 2, 7, 5];

    /** opts.stages: ['space', 'sea', …], opts.seed */
    function shooterAssets(opts) {
        const seed = opts.seed || '1', images = [], anims = [];
        PS_SHIP_COLORS.forEach((c, i) => anims.push({ name: 'shShip' + (i + 1), frames: shooterShip(c, seed), interval: 80 }));
        Object.keys(SHOOTER_ENEMIES).forEach(t => anims.push({ name: 'sh' + cap(t), frames: shooterEnemy(t, seed), interval: 120 }));
        const b = shooterBoss(seed);
        anims.push({ name: 'shBoss', frames: b.fly, interval: 150 });
        images.push({ name: 'shBossHurt', p: b.hurt });
        const it = shooterItems(seed);
        [['shShot', 'shot'], ['shEnemyShot', 'enemyShot'], ['shPower', 'power'], ['shShield', 'shield'], ['shBomb', 'bomb'], ['shLife', 'life'], ['shShieldRing', 'shieldRing']]
            .forEach(([n, k]) => images.push({ name: n, p: it[k] }));
        anims.push({ name: 'shExplosion', frames: it.explosion, interval: 70 });
        (opts.stages || ['space']).filter((v, i, a) => a.indexOf(v) === i).forEach(st => {
            const bg = shooterBackground(st, seed);
            images.push({ name: 'sh' + cap(st) + 'Far', p: bg.far }, { name: 'sh' + cap(st) + 'Near', p: bg.near });
        });
        return { images, anims, tiles: [], tilemaps: [] };
    }

    function shooterProject(opts) {
        opts = opts || {};
        const seed = opts.seed || '1', stages = opts.stages && opts.stages.length ? opts.stages : ['space', 'sea', 'desert'];
        const name = opts.name || ('pixel-shooter-' + stages.join('-') + '-' + seed);
        const spec = shooterAssets({ stages, seed });
        const mainTs = stages.map((st, i) => `pixelshooter.setStage(${i + 1}, pixelshooter.Style.${PS_STYLE_ENUM[PS_STYLES.indexOf(st)]})`)
            .concat([`pixelshooter.setStageCount(${stages.length})`, `pixelshooter.setMaxPlayers(${opts.players || 2})`, 'pixelshooter.setLives(3)', 'pixelshooter.startGame()', '']).join('\n');
        const readme = `# ${name}\n\nErzeugt mit dem Arcade Asset Generator (Seed "${seed}"). Pixel-Shooter: senkrecht scrollender Shooter für bis zu 4 Spieler.\n` +
            'Weitere Spieler steigen mit A auf ihrem Controller ein, auch online im Mehrspieler-Modus. Alle Grafiken liegen im Assets-Tab ' +
            '(Namen wie shShip1, shFighter, shBoss, shSpaceFar); was du dort änderst, übernimmt das Spiel.\n';
        const files = Object.assign({
            'pxt.json': JSON.stringify({
                name, description: 'Pixel-Shooter aus dem Arcade Asset Generator',
                dependencies: { device: '*', pixelshooter: EXTENSIONS.pixelshooter.spec },
                files: ['main.blocks', 'main.ts', 'README.md', 'assets.json', 'images.g.jres', 'images.g.ts', 'tilemap.g.jres', 'tilemap.g.ts'],
                preferredEditor: 'blocksprj',
            }, null, 4),
            'main.blocks': '', 'main.ts': mainTs, 'README.md': readme, 'assets.json': '',
        }, buildAssetFiles(spec));
        const mkcd = JSON.stringify({ meta: { cloudId: 'pxt/arcade', editor: 'blocksprj', name }, source: JSON.stringify(files, null, 2) });
        return { files, mkcd, name, names: { images: spec.images.map(i => i.name), animations: spec.anims.map(a => a.name), tiles: [], tilemaps: [] } };
    }

    return {
        shooterAssets, shooterProject, PS_STYLES, PS_STYLE_ENUM,
        makecodeProject, buildAssetFiles, pixelquestAssets, markers, asciiLevel, exampleWorldRows, generateWorldRows,
        PQ_STYLES, PQ_STYLE_ENUM, PQ_MARKERS, PQ_MARKER_CHARS, f4Bytes, EXTENSIONS,
        PALETTE, COLOR_NAMES, HEX, DARK, LIGHT, Pix, makeRand, hashSeed,
        BIOMES, ENEMY_TYPES, BIOME_ENEMIES, BOSS_TYPES, HAIR_STYLES, HATS, CHAR_DEFAULTS,
        background, tileset, character, randomCharacter, enemy, boss, items,
        SHOOTER_STYLES, SHOOTER_ENEMIES, shooterBackground, shooterShip, shooterEnemy, shooterBoss, shooterItems,
        framesToTS, imageToTS,
    };
});
