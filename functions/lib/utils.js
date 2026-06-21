"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTokyoDate = getTokyoDate;
/**
 * Get Tokyo date with optional offset
 * @param {number} offsetDays Number of days to offset (default: 0)
 * @return {Date}
 */
function getTokyoDate(offsetDays = 0) {
    const now = new Date();
    const tokyoString = now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" });
    const tokyoDate = new Date(tokyoString);
    tokyoDate.setDate(tokyoDate.getDate() + offsetDays);
    return tokyoDate;
}
//# sourceMappingURL=utils.js.map