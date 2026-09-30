// Rendert eine Übersicht aller generierten Grafiken als PNG (zur Kontrolle).
// Aufruf: node sheet.js <ausgabe.png> [seed]
const fs = require('fs'), zlib = require('zlib');
const G = require('../assetgen.js');
const seed = process.argv[3] || '1';
const S = 3, W = 600, H = 1060;
const canvas = new Uint8Array(W * H * 4).fill(60);
function draw(p, ox, oy, s) {
    const im = p.toRGBA(s);
    for (let y = 0; y < im.height; y++) for (let x = 0; x < im.width; x++) {
        const o = (y * im.width + x) * 4; if (!im.data[o + 3]) continue;
        const X = ox + x, Y = oy + y; if (X >= W || Y >= H) continue;
        const d = (Y * W + X) * 4; canvas[d] = im.data[o]; canvas[d + 1] = im.data[o + 1]; canvas[d + 2] = im.data[o + 2]; canvas[d + 3] = 255;
    }
}
let y = 4;
for (const b of ['grass', 'scifi', 'dungeon']) {
    const bg = G.background(b, seed);
    const comp = bg.sky.clone().blit(bg.far, 0, 0).blit(bg.near, 0, 0);
    draw(comp, 4, y, 2);
    const t = G.tileset(b, seed);
    let x = 330;
    ['groundTop', 'ground', 'platform', 'spikes', 'goal', 'deco'].forEach((k, i) => draw(t[k], x + (i % 3) * 52, y + Math.floor(i / 3) * 52, S));
    // Mini-Level-Ausschnitt
    const lv = comp.clone();
    for (let i = 0; i < 10; i++) { lv.blit(t.groundTop, i * 16, 104); }
    lv.blit(t.platform, 48, 64).blit(t.platform, 64, 64).blit(t.spikes, 96, 88).blit(t.goal, 128, 88).blit(t.deco, 16, 88);
    draw(lv, 330, y + 106, 1);
    y += 246;
}
const ch = G.character(G.randomCharacter(seed));
let x = 4;
[...ch.idle, ...ch.run, ...ch.jump, ...ch.fall].forEach(f => { draw(f, x, y, S); x += 52; });
y += 56; x = 4;
const def = G.character({});
[...def.idle, ...def.run, ...def.jump, ...def.fall].forEach(f => { draw(f, x, y, S); x += 52; });
y += 56; x = 4;
for (const e of ['slime', 'robot', 'skeleton', 'bird', 'drone', 'bat']) {
    const en = G.enemy(e, seed);
    [...en.walk, en.dead].forEach(f => { draw(f, x, y, 2); x += 36; });
    if (x > 400) { x = 4; y += 36; } else x += 12;
}
y += 40; x = 4;
for (const bt of ['golem', 'knight', 'mech']) { const bo = G.boss(bt, seed); [...bo.walk, bo.attack, bo.hurt].forEach(f => { draw(f, x, y, 1.5 | 0 || 1); draw(f, x, y, 1); x += 36; }); x += 10; }
y += 40; x = 4;
const it = G.items(seed);
[...it.coin, it.gem, it.heart, it.shot, it.fire].forEach(f => { draw(f, x, y, 4); x += 38; });
[it.slash, it.chestClosed, it.chestOpen].forEach(f => { draw(f, x, y, 3); x += 54; });
// PNG schreiben
function crc32(b) { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let crc = -1; for (const x of b) crc = t[(crc ^ x) & 255] ^ (crc >>> 8); return (crc ^ -1) >>> 0; }
function chunk(type, data) { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); }
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let r = 0; r < H; r++) { raw[r * (W * 4 + 1)] = 0; Buffer.from(canvas.buffer, r * W * 4, W * 4).copy(raw, r * (W * 4 + 1) + 1); }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
fs.writeFileSync(process.argv[2], Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log('ok', process.argv[2]);
