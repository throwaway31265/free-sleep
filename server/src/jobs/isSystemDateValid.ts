export function isSystemDateValid() {
  const currentYear = new Date().getFullYear();
  return currentYear >= 2025;
}
