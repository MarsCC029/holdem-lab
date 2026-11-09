import { createHash } from 'node:crypto';
import { lstat, mkdir, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = await realpath(fileURLToPath(new URL('../', import.meta.url)));
const source = path.resolve(root, 'dist');
const destination = path.resolve(root, 'docs');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const safePath = (name) => typeof name === 'string' && name.length > 0 && !name.includes('\\') && !name.includes('\0') && !path.posix.isAbsolute(name) && path.posix.normalize(name) === name && name.split('/').every((part) => part && !part.startsWith('.'));

async function collect(directory, prefix = '') {
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Build directories must be real directories, never symbolic links.');
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (!safePath(name)) throw new Error('Unsafe build path.');
    const target = path.join(directory, entry.name);
    const stat = await lstat(target);
    if (stat.isSymbolicLink()) throw new Error(`Symbolic link rejected: ${name}`);
    if (stat.isDirectory()) files.push(...await collect(target, name));
    else if (stat.isFile()) files.push({ name, bytes: await readFile(target) });
    else throw new Error(`Non-file build entry rejected: ${name}`);
  }
  return files;
}

try {
  // Read and validate the complete existing build before replacing generated docs/.
  const files = await collect(source);
  const byPath = new Map(files.map((file) => [file.name, file]));
  for (const required of ['index.html', 'sw.js', 'manifest.webmanifest', 'icons/apple-touch-icon.png']) {
    if (!byPath.has(required)) throw new Error(`Missing game build file: ${required}. Run npm run build first.`);
  }
  if (!files.some((file) => /^assets\/.*worker.*\.js$/.test(file.name))) throw new Error('Missing built calculation worker.');
  const declaration = /^const RESOURCES = (\[[^\r\n]*\]);$/m.exec(byPath.get('sw.js').bytes.toString('utf8'));
  if (!declaration) throw new Error('Missing offline resource manifest.');
  const resources = JSON.parse(declaration[1]);
  if (!Array.isArray(resources) || !resources.length) throw new Error('Invalid offline resource manifest.');
  const expected = new Set(['sw.js', '_headers']);
  for (const resource of resources) {
    if (!resource || !safePath(resource.url) || expected.has(resource.url) || !/^[a-f0-9]{64}$/.test(resource.sha256)) throw new Error('Invalid or duplicate offline resource.');
    const file = byPath.get(resource.url);
    if (!file || hash(file.bytes) !== resource.sha256) throw new Error(`Build integrity check failed: ${resource.url}`);
    expected.add(resource.url);
  }
  if (files.some((file) => !expected.has(file.name))) throw new Error('Build contains files not covered by its offline manifest.');
  if (path.dirname(destination) !== root || path.relative(root, destination) !== 'docs' || destination === source || destination === root) throw new Error('Unsafe generated docs target.');
  try {
    const existing = await lstat(destination);
    if (!existing.isDirectory() || existing.isSymbolicLink() || await realpath(destination) !== destination) throw new Error('Refusing to replace a redirected docs directory.');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  // Resolved absolute deletion target is exactly this project's generated docs/.
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  for (const file of files) {
    const target = path.resolve(destination, ...file.name.split('/'));
    const relative = path.relative(destination, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Unsafe copy destination.');
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, file.bytes);
    if (hash(await readFile(target)) !== hash(file.bytes)) throw new Error(`Copy verification failed: ${file.name}`);
  }
  await writeFile(path.join(destination, '.nojekyll'), '');
  console.log(`Prepared docs/: ${files.length} byte-verified game files and .nojekyll.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Pages preparation failed.');
  process.exitCode = 1;
}
