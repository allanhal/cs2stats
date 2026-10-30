export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`falta a variável de ambiente ${name}`);
  }
  return value;
}
