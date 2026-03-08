import { readdirSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');
const textureDir = join(repoRoot, 'src', 'assets', 'ui', 'textures');

const defaults = {
  quality: 68,
  alphaQuality: 80,
  method: 6,
  force: false,
};

function parseArgs(argv) {
  const options = { ...defaults };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--force') {
      options.force = true;
      continue;
    }

    if (arg === '--quality' || arg === '-q') {
      const value = Number(argv[index + 1]);
      if (!Number.isFinite(value)) throw new Error('Expected a numeric value after --quality.');
      options.quality = value;
      index += 1;
      continue;
    }

    if (arg === '--alpha-quality') {
      const value = Number(argv[index + 1]);
      if (!Number.isFinite(value)) throw new Error('Expected a numeric value after --alpha-quality.');
      options.alphaQuality = value;
      index += 1;
      continue;
    }

    if (arg === '--method' || arg === '-m') {
      const value = Number(argv[index + 1]);
      if (!Number.isFinite(value)) throw new Error('Expected a numeric value after --method.');
      options.method = value;
      index += 1;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function printHelp() {
  console.log(`Convert texture PNGs to WebP using cwebp.

Usage:
  npm run images:textures:webp -- [options]

Options:
  -q, --quality <number>        Lossy quality for RGB data (default: ${defaults.quality})
  --alpha-quality <number>      Quality for alpha channel (default: ${defaults.alphaQuality})
  -m, --method <number>         Compression effort 0-6 (default: ${defaults.method})
  --force                       Rebuild .webp files even if they are newer than the source .png
  -h, --help                    Show this help message
`);
}

function formatKiB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function findPngTextures() {
  return readdirSync(textureDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === '.png')
    .map((entry) => join(textureDir, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

function runCwebp(inputPath, outputPath, options) {
  const args = [
    '-q',
    String(options.quality),
    '-alpha_q',
    String(options.alphaQuality),
    '-m',
    String(options.method),
    '-mt',
    inputPath,
    '-o',
    outputPath,
  ];

  return spawnSync('cwebp', args, {
    cwd: repoRoot,
    encoding: 'utf8',
  });
}

function ensureOutputDirectory(outputPath) {
  const outputDir = dirname(outputPath);
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
}

function shouldSkip(sourcePath, outputPath, force) {
  if (force || !existsSync(outputPath)) return false;
  const sourceStat = statSync(sourcePath);
  const outputStat = statSync(outputPath);
  return outputStat.mtimeMs >= sourceStat.mtimeMs;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const textures = findPngTextures();

  if (textures.length === 0) {
    console.log('No texture PNGs found.');
    return;
  }

  let failures = 0;
  let converted = 0;
  let skipped = 0;

  for (const inputPath of textures) {
    const outputPath = inputPath.replace(/\.png$/i, '.webp');

    if (shouldSkip(inputPath, outputPath, options.force)) {
      skipped += 1;
      console.log(`skip ${relative(repoRoot, outputPath)} (up to date)`);
      continue;
    }

    ensureOutputDirectory(outputPath);
    const result = runCwebp(inputPath, outputPath, options);

    if (result.error) {
      failures += 1;
      if (result.error.code === 'ENOENT') {
        console.error('cwebp was not found on PATH. Install the WebP tools and rerun this script.');
        process.exit(1);
      }
      console.error(`failed ${relative(repoRoot, inputPath)}: ${result.error.message}`);
      continue;
    }

    if (result.status !== 0) {
      failures += 1;
      console.error(`failed ${relative(repoRoot, inputPath)}:`);
      if (result.stderr) console.error(result.stderr.trim());
      continue;
    }

    converted += 1;
    const sourceSize = statSync(inputPath).size;
    const outputSize = statSync(outputPath).size;
    const savings = sourceSize > 0 ? ((1 - outputSize / sourceSize) * 100).toFixed(1) : '0.0';

    console.log(
      `done ${relative(repoRoot, inputPath)} -> ${relative(repoRoot, outputPath)} | ${formatKiB(sourceSize)} -> ${formatKiB(outputSize)} (${savings}% smaller)`,
    );
  }

  console.log(`\nConverted: ${converted}, Skipped: ${skipped}, Failed: ${failures}`);
  if (failures > 0) process.exit(1);
}

main();
