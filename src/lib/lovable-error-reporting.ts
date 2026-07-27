export function reportLovableError(error: unknown) {
  console.error("Reported error:", error);
}

export function reportLoveableError(error: unknown) {
  reportLovableError(error);
}
