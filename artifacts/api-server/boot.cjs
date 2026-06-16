// boot.cjs - The CommonJS bridge to launch the ESM server
const path = require('path');

async function start() {
  try {
    console.log('🚀 Trading Terminal is starting...');
    
    // Ensure a default PORT is set so the server doesn't throw an error
    if (!process.env.PORT) {
      process.env.PORT = '3001';
    }

    // Use dynamic import to load the bundled ESM server.
    await import('./dist/index.mjs');
    
    console.log('✅ Server successfully launched.');
  } catch (err) {
    console.error('❌ Critical startup error:');
    console.error(err);
    process.exit(1);
  }
}

start();
