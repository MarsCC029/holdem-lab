import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import { workerSource } from '../src/offline/workerSource.js';

// Original code-drawn icon artwork. PNG encoding uses only Node's standard library.
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function chunk(type, data) {
  const name = Buffer.from(type);
  const body = Buffer.concat([name, data]);
  let crc = 0xffffffff;
  for (const value of body) crc = crcTable[(crc ^ value) & 255] ^ (crc >>> 8);
  const header = Buffer.alloc(4); header.writeUInt32BE(data.length);
  const footer = Buffer.alloc(4); footer.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([header, body, footer]);
}
function insideTriangle(x, y, a, b, c) {
  const cross = (p, q) => (x - q[0]) * (p[1] - q[1]) - (p[0] - q[0]) * (y - q[1]);
  const values = [cross(a, b), cross(b, c), cross(c, a)];
  return !(Math.min(...values) < 0 && Math.max(...values) > 0);
}
function iconColor(x, y, maskable) {
  if (maskable) { x = (x - 256) / 0.78 + 256; y = (y - 256) / 0.78 + 256; }
  let color = [16, 27, 39];
  const theta = 8 * Math.PI / 180;
  const xx = (x - 256) * Math.cos(theta) - (y - 256) * Math.sin(theta);
  const yy = (x - 256) * Math.sin(theta) + (y - 256) * Math.cos(theta);
  const qx = Math.abs(xx) - 104, qy = Math.abs(yy) - 126;
  if (Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) <= 30) color = [248, 244, 232];
  if (insideTriangle(x, y, [256, 165], [194, 246], [318, 246]) || (x - 223) ** 2 + (y - 263) ** 2 < 39 ** 2 || (x - 289) ** 2 + (y - 263) ** 2 < 39 ** 2 || insideTriangle(x, y, [256, 273], [226, 345], [286, 345])) color = [21, 126, 112];
  const distance = Math.hypot(x - 359, y - 374);
  if (distance <= 67) color = [16, 27, 39];
  if (distance <= 61) color = [226, 182, 102];
  if (distance > 35 && distance < 40) color = [255, 242, 203];
  return color;
}
async function makeIcons(directory) {
  await mkdir(directory, { recursive: true });
  for (const [size, name, maskable] of [[192, 'icon-192.png', false], [512, 'icon-512.png', false], [180, 'apple-touch-icon.png', false], [512, 'maskable-512.png', true]]) {
    const pixels = Buffer.alloc((size * 3 + 1) * size);
    let index = 0;
    for (let y = 0; y < size; y++) {
      pixels[index++] = 0;
      for (let x = 0; x < size; x++) {
        const samples = [[.25, .25], [.75, .25], [.25, .75], [.75, .75]].map(([dx, dy]) => iconColor((x + dx) * 512 / size, (y + dy) * 512 / size, maskable));
        for (let channel = 0; channel < 3; channel++) pixels[index++] = Math.floor(samples.reduce((sum, sample) => sum + sample[channel], 0) / 4);
      }
    }
    const header = Buffer.alloc(13); header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 2;
    await writeFile(path.join(directory, name), Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
  }
}
if (process.argv.includes('--icons')) {
  await makeIcons(path.resolve('public/icons'));
  console.log('Generated four local application icons.');
  process.exit(0);
}

const root = path.resolve('dist');
await makeIcons(path.join(root, 'icons'));
async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory() ? files(path.join(directory, entry.name)) : path.join(directory, entry.name)));
  return nested.flat();
}
const resources = [];
for (const file of (await files(root)).sort()) {
  const url = path.relative(root, file).split(path.sep).join('/');
  if (url === 'sw.js' || url === '_headers') continue;
  resources.push({ url, sha256: createHash('sha256').update(await readFile(file)).digest('hex') });
}
for (const required of ['index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png']) {
  if (!resources.some((item) => item.url === required)) throw new Error(`Offline build missing ${required}`);
}
if (!resources.some((item) => /assets\/.*\.js$/.test(item.url))) throw new Error('Offline build has no application JavaScript');
// Worker behavior changes need a fresh cache even when emitted app files are unchanged.
const version = createHash('sha256').update(JSON.stringify(resources)).update(workerSource.toString()).digest('hex').slice(0, 20);
const source = workerSource(resources, version);
await writeFile(path.join(root, 'sw.js'), source, 'utf8');
console.log(`Offline cache ${version}: ${resources.length} verified resources (including workers).`);
