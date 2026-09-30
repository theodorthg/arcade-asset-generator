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

    function background(biome, seed) {
        const r = makeRand('bg:' + biome + ':' + seed);
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

    function tileset(biome, seed) {
        const r = makeRand('tiles:' + biome + ':' + seed);
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
    };
    const BIOME_ENEMIES = { grass: ['slime', 'bird'], scifi: ['robot', 'drone'], dungeon: ['skeleton', 'bat'] };

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

    function enemy(type, seed) {
        const r = makeRand('enemy:' + type + ':' + seed);
        const fn = { slime: enemySlime, robot: enemyRobot, skeleton: enemySkeleton, bird: enemyBird, drone: enemyDrone, bat: enemyBat }[type];
        return fn(r);
    }

    // =====================================================================
    //  BOSS (32x32): walk[2], hurt, attack
    // =====================================================================
    const BOSS_TYPES = { golem: 'Stein-Golem', knight: 'Dunkler Ritter', mech: 'Kampf-Mech' };

    function boss(type, seed) {
        const r = makeRand('boss:' + type + ':' + seed);
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
     * Baut ein MakeCode-Arcade-Projekt mit allen Assets eines Biom/Seed-Sets.
     * Rückgabe: { files: {Dateiname: Inhalt}, mkcd: String (JSON, direkt importierbar), names: {...} }
     */
    // Erweiterungen, die der Export optional einbinden kann (Name -> pxt.json-Abhängigkeit)
    const EXTENSIONS = {
        pixelquest: { label: 'Pixel-Quest-Erweiterung', spec: 'github:theodorthg/pxt-pixelquest#v0.1.1' },
    };

    function makecodeProject(opts) {
        opts = opts || {};
        const seed = opts.seed || '1', biome = opts.biome || 'grass', B = biome;
        const name = opts.name || ('assets-' + biome + '-' + seed);
        const bg = background(biome, seed), t = tileset(biome, seed), ch = character(opts.char || {});
        const it = items(seed), bo = boss(opts.boss || 'golem', seed);
        const [walkerType, flyerType] = BIOME_ENEMIES[biome];
        const walker = enemy(walkerType, seed), flyer = enemy(flyerType, seed);

        // ---------- Bilder & Animationen
        const images = [], anims = [];
        const addImg = (display, p) => images.push({ id: 'image' + (images.length + 1), display, p });
        const addAnim = (display, frames, interval) => anims.push({ id: 'anim' + (anims.length + 1), display, frames, interval });
        addImg(B + 'Sky', bg.sky); addImg(B + 'Far', bg.far); addImg(B + 'Near', bg.near);
        addImg('heroStand', ch.idle[0]); addImg('heroJump', ch.jump[0]); addImg('heroFall', ch.fall[0]);
        addAnim('heroRun', ch.run, 100); addAnim('heroRunLeft', ch.run.map(f => f.flipX()), 100);
        addAnim('heroIdle', [ch.idle[0], ch.idle[0], ch.idle[0], ch.idle[1]], 250);
        addImg(walkerType, walker.walk[0]); addAnim(walkerType + 'Walk', walker.walk, 150); addImg(walkerType + 'Dead', walker.dead);
        addImg(flyerType, flyer.walk[0]); addAnim(flyerType + 'Fly', flyer.walk, 100); addImg(flyerType + 'Dead', flyer.dead);
        addImg('boss', bo.walk[0]); addAnim('bossWalk', bo.walk, 250); addImg('bossAttack', bo.attack); addImg('bossHurt', bo.hurt);
        addImg('coin', it.coin[0]); addAnim('coinSpin', it.coin, 120);
        ['gem', 'heart', 'shot', 'fire', 'slash', 'chestClosed', 'chestOpen'].forEach(k => addImg(k, it[k]));

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

        // ---------- Kacheln & Demo-Tilemap
        const tileNames = ['groundTop', 'ground', 'platform', 'spikes', 'goal', 'deco'];
        const tileList = [{ id: 'transparency16', display: null, p: new Pix(16, 16) }]
            .concat(tileNames.map((k, i) => ({ id: 'tile' + (i + 1), display: B + cap(k), p: t[k] })));
        const tmJres = { '*': { mimeType: 'image/x-mkcd-f4', dataEncoding: 'base64', namespace: 'myTiles' } };
        tileList.forEach(tl => {
            tmJres[tl.id] = { data: bytesToBase64(f4Bytes(tl.p)), mimeType: 'image/x-mkcd-f4', tilemapTile: true };
            if (tl.display) tmJres[tl.id].displayName = tl.display;
        });
        // kleines Demo-Level: 32x8, Index = Position in tileList
        const LW = 32, LH = 8, grid = [], walls = [];
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
        for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) {
            const c = (rows[y][x] || '.');
            let ti = 0;
            if (c === '#') ti = (y > 0 && rows[y - 1][x] === '#') ? 2 : 1;
            if (c === '=') ti = 3; if (c === '^') ti = 4; if (c === 'G') ti = 5; if (c === 'd') ti = 6;
            grid.push(ti); walls.push(c === '#' || c === '=' ? 2 : 0);
        }
        const tmBytes = [16, ...le16(LW), ...le16(LH), ...grid, ...rawBitmap(LW, LH, (x, y) => walls[x + y * LW])];
        const tileRefs = tileList.map(tl => 'myTiles.' + tl.id);
        tmJres.demoLevel = { id: 'demoLevel', mimeType: 'application/mkcd-tilemap', data: base64(bytesToHex(tmBytes)), tileset: tileRefs, displayName: 'demoLevel' };
        const wallLit = 'img`\n' + Array.from({ length: LH }, (_, y) => I3 + Array.from({ length: LW }, (_, x) => walls[x + y * LW] ? '2' : '.').join(' ')).join('\n') + '\n                `';
        const tmTs = '// Auto-generated code. Do not edit.\nnamespace myTiles {\n' +
            tileList.map(tl => `    //% fixedInstance jres blockIdentity=images._tile\n    export const ${tl.id} = image.ofBuffer(hex\`\`);\n`).join('') +
            factory('tilemap', [{ keys: ['demoLevel', 'demoLevel'], expression: `tiles.createTilemap(hex\`${bytesToHex([...le16(LW), ...le16(LH), ...grid])}\`, ${wallLit}, [${tileRefs.join(',')}], TileScale.Sixteen)` }]) +
            factory('tile', tileList.map(tl => ({ keys: tl.display ? [tl.display, tl.id] : [tl.id], expression: tl.id }))) +
            '\n}\n// Auto-generated code. Do not edit.\n';

        // ---------- Startprogramm (wird in MakeCode als Blöcke angezeigt)
        const mainTs = [
            `scene.setBackgroundImage(assets.image\`${B}Sky\`)`,
            'tiles.setCurrentTilemap(tilemap`demoLevel`)',
            'let hero = sprites.create(assets.image`heroStand`, SpriteKind.Player)',
            'controller.moveSprite(hero, 80, 0)',
            'hero.ay = 400',
            'tiles.placeOnTile(hero, tiles.getTileLocation(1, 4))',
            'scene.cameraFollowSprite(hero)',
            'animation.runImageAnimation(hero, assets.animation`heroIdle`, 250, true)',
            `let coin = sprites.create(assets.image\`coin\`, SpriteKind.Food)`,
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
        const readme = `# ${name}\n\nErzeugt mit dem Arcade Asset Generator (Seed "${seed}", Biom ${biome}).\n` +
            'Alle Bilder, Animationen und Kacheln liegen im Assets-Tab und in der Bild-Galerie „Meine Assets“.\n';
        const files = {
            'pxt.json': JSON.stringify({
                name, description: 'Assets aus dem Arcade Asset Generator', dependencies: Object.assign({ device: '*' }, opts.extensions || {}),
                files: ['main.blocks', 'main.ts', 'README.md', 'assets.json', 'images.g.jres', 'images.g.ts', 'tilemap.g.jres', 'tilemap.g.ts'],
                preferredEditor: 'blocksprj',
            }, null, 4),
            'main.blocks': '',
            'main.ts': mainTs,
            'README.md': readme,
            'assets.json': '',
            'images.g.jres': JSON.stringify(imgJres, null, 4),
            'images.g.ts': imgTs,
            'tilemap.g.jres': JSON.stringify(tmJres, null, 4),
            'tilemap.g.ts': tmTs,
        };
        const mkcd = JSON.stringify({
            meta: { cloudId: 'pxt/arcade', editor: 'blocksprj', name },
            source: JSON.stringify(files, null, 2),
        });
        return {
            files, mkcd, name,
            names: { images: images.map(i => i.display), animations: anims.map(a => a.display), tiles: tileList.filter(t => t.display).map(t => t.display), tilemaps: ['demoLevel'] },
        };
    }
    const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

    return {
        makecodeProject, f4Bytes, EXTENSIONS,
        PALETTE, COLOR_NAMES, HEX, DARK, LIGHT, Pix, makeRand, hashSeed,
        BIOMES, ENEMY_TYPES, BIOME_ENEMIES, BOSS_TYPES, HAIR_STYLES, HATS, CHAR_DEFAULTS,
        background, tileset, character, randomCharacter, enemy, boss, items,
        framesToTS, imageToTS,
    };
});
