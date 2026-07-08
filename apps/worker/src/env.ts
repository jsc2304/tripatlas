export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`[tripatlas-worker] env ${name} fehlt`);
    process.exit(1);
  }
  return value;
}
