const { downloadArtifact } = require('@electron/get');
const extract = require('extract-zip');
const fs = require('fs');
const path = require('path');

const targetDir = path.resolve(__dirname, '../node_modules/.pnpm/electron@34.5.8/node_modules/electron');
const version = '34.5.8';
const platform = process.platform;
const arch = process.arch;

console.log('Target directory:', targetDir);
console.log('Version:', version);
console.log('Platform:', platform);
console.log('Arch:', arch);

async function run() {
  try {
    console.log('Downloading artifact...');
    const zipPath = await downloadArtifact({
      version,
      artifactName: 'electron',
      platform,
      arch
    });
    console.log('Zip downloaded to:', zipPath);

    const distDir = path.join(targetDir, 'dist');
    console.log('Extracting to:', distDir);
    
    // Clean dist folder
    fs.rmSync(distDir, { recursive: true, force: true });
    fs.mkdirSync(distDir, { recursive: true });

    await extract(zipPath, { dir: distDir });
    console.log('Extraction complete.');

    // Write path.txt
    const platformPath = platform === 'win32' ? 'electron.exe' : 'electron';
    await fs.promises.writeFile(path.join(targetDir, 'path.txt'), platformPath);
    console.log('path.txt written successfully.');
  } catch (err) {
    console.error('Error in script:', err);
  }
}

run();
