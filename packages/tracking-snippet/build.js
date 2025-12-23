import * as esbuild from 'esbuild';
import { gzipSync } from 'zlib';
import * as fs from 'fs';

const isWatch = process.argv.includes('--watch');

async function build() {
  const result = await esbuild.build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    minify: true,
    sourcemap: false,
    target: ['es2015'],
    format: 'iife',
    globalName: 'PalaciosTracker',
    outfile: 'dist/palacios.min.js',
    metafile: true,
  });

  // Berechne Größen
  const output = fs.readFileSync('dist/palacios.min.js');
  const gzipped = gzipSync(output);

  console.log(`✅ Build complete:`);
  console.log(`   - Minified: ${(output.length / 1024).toFixed(2)} KB`);
  console.log(`   - Gzipped:  ${(gzipped.length / 1024).toFixed(2)} KB`);

  if (gzipped.length > 5 * 1024) {
    console.warn(`⚠️  Warning: Gzipped size exceeds 5KB target!`);
  }
}

if (isWatch) {
  const ctx = await esbuild.context({
    entryPoints: ['src/index.ts'],
    bundle: true,
    minify: false,
    sourcemap: true,
    target: ['es2015'],
    format: 'iife',
    globalName: 'PalaciosTracker',
    outfile: 'dist/palacios.min.js',
  });

  await ctx.watch();
  console.log('👀 Watching for changes...');
} else {
  await build();
}
