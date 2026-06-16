import path from "node:path";
import fs from "node:fs";

try {
  // Try loading from the current working directory first (e.g. if run from root)
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    (process as any).loadEnvFile?.(envPath);
  } else {
    // Then try relative to the package root
    const altEnvPath = path.resolve(process.cwd(), "artifacts/api-server/.env");
    if (fs.existsSync(altEnvPath)) {
      (process as any).loadEnvFile?.(altEnvPath);
    } else {
      // Also try resolving relative to index.ts directory
      const localEnvPath = path.resolve(import.meta.dirname, "../.env");
      if (fs.existsSync(localEnvPath)) {
        (process as any).loadEnvFile?.(localEnvPath);
      }
    }
  }
} catch (err) {
  // Ignore if process.loadEnvFile is not supported or fails
}
