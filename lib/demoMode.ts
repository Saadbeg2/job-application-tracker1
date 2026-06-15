export function isDemoMode() {
  return process.env.DEMO_MODE?.trim().toLowerCase() === "true";
}

export function requireDemoMode() {
  if (!isDemoMode()) {
    throw new Error("DEMO_MODE_REQUIRED");
  }
}

export function demoModeMessage() {
  return "Demo Mode — sample data only";
}
