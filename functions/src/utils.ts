/**
 * Get Tokyo date with optional offset
 * @param {number} offsetDays Number of days to offset (default: 0)
 * @return {Date}
 */
export function getTokyoDate(offsetDays = 0): Date {
  const now = new Date();
  const tokyoString = now.toLocaleString("en-US", {timeZone: "Asia/Tokyo"});
  const tokyoDate = new Date(tokyoString);
  tokyoDate.setDate(tokyoDate.getDate() + offsetDays);
  return tokyoDate;
}

