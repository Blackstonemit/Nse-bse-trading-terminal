export function getSystemInfo() {
  return {
    node: process.version,
    arch: process.arch,
    platform: process.platform,
  };
}

if (process.argv[1]?.endsWith("index.ts")) {
  const info = getSystemInfo();
  console.log(`[NSE/BSE Trading Workstation] Environment: Node ${info.node} (${info.arch} / ${info.platform})`);
}
