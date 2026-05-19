/**
 * Exhaustiveness helper for discriminated-union switches. Use in the
 * `default` branch so TypeScript fails the build if a new union case is
 * added without a corresponding `case` — instead of silently falling
 * through to whatever the default returns.
 */
export function assertNever(x: never): never {
  throw new Error(`Unhandled discriminated-union case: ${JSON.stringify(x)}`);
}
