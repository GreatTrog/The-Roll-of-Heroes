import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');
const scanRoots = [
  join(repoRoot, 'public'),
  join(repoRoot, 'src', 'assets'),
];

const excludedSegments = [
  `${join('src', 'assets', 'ui', 'textures')}${process.platform === 'win32' ? '\\' : '/'}`,
  `${join('src', 'assets', 'ui', 'icons')}${process.platform === 'win32' ? '\\' : '/'}`,
];

const convertibleExtensions = new Set(['.png', '.jpg', '.jpeg']);

const defaults = {
  quality: 70,
  alphaQuality: 82,
  method: 6,
  minSizeKb: 150,
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

    if (arg === '--min-size-kb') {
      const value = Number(argv[index + 1]);
      if (!Number.isFinite(value)) throw new Error('Expected a numeric value after --min-size-kb.');
      options.minSizeKb = value;
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
  console.log(`Convert remaining large raster assets to WebP using cwebp.

Usage:
  npm run images:large:webp -- [options]

Scans:
  public/
  src/assets/

Skips:
  src/assets/ui/textures/
  src/assets/ui/icons/

Options:
  -q, --quality <number>        Lossy quality for RGB data (default: ${defaults.quality})
  --alpha-quality <number>      Quality for alpha channel (default: ${defaults.alphaQuality})
  -m, --method <number>         Compression effort 0-6 (default: ${defaults.method})
  --min-size-kb <number>        Only convert files at or above this size (default: ${defaults.minSizeKb})
  --force                       Rebuild .webp files even if they are newer than the source image
  -h, --help                    Show this help message
`);
}

function formatKiB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function isExcluded(pathFromRoot) {
  return excludedSegments.some((segment) => pathFromRoot.startsWith(segment));
}

function walkDir(rootDir, options, results = []) {
  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    const fullPath = join(rootDir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, options, results);
      continue;
    }

    const ext = extname(entry.name).toLowerCase();
    if (!convertibleExtensions.has(ext)) continue;

    const relPath = relative(repoRoot, fullPath);
    if (isExcluded(relPath)) continue;

    const size = statSync(fullPath).size;
    if (size < options.minSizeKb * 1024) continue;

    results.push(fullPath);
  }

  return results;
}

function findLargeImages(options) {
  return scanRoots
    .flatMap((rootDir) => walkDir(rootDir, options))
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
  const images = findLargeImages(options);

  if (images.length === 0) {
    console.log('No large raster assets matched the current filters.');
    return;
  }

  let failures = 0;
  let converted = 0;
  let skipped = 0;

  for (const inputPath of images) {
    const outputPath = inputPath.replace(/\.(png|jpg|jpeg)$/i, '.webp');

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
