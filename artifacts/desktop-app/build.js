const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '../..');
const desktopAppDir = __dirname;
const appDistDir = path.join(desktopAppDir, 'app-dist');

// Helper to copy directory recursively
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function main() {
  console.log('Cleaning app-dist...');
  fs.rmSync(appDistDir, { recursive: true, force: true });
  fs.mkdirSync(appDistDir, { recursive: true });

  console.log('Copying backend API server dist...');
  const backendSrc = path.join(rootDir, 'artifacts/api-server/dist');
  const backendDest = path.join(appDistDir, 'artifacts/api-server/dist');
  copyDir(backendSrc, backendDest);

  console.log('Copying market dashboard dist...');
  const frontendSrc = path.join(rootDir, 'artifacts/market-dashboard/dist');
  const frontendDest = path.join(appDistDir, 'artifacts/market-dashboard/dist');
  copyDir(frontendSrc, frontendDest);

  console.log('Running electron-builder...');
  const isPortable = process.argv.includes('--portable');
  const builderCmd = `npx electron-builder build --win${isPortable ? '' : ' --dir'}`;
  execSync(builderCmd, { cwd: desktopAppDir, stdio: 'inherit' });

  console.log('Desktop build complete!');
}

main().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
