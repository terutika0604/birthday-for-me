"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncPendingBirthdaysToGoogleCalendar = syncPendingBirthdaysToGoogleCalendar;
const admin = __importStar(require("firebase-admin"));
const googleapis_1 = require("googleapis");
const utils_1 = require("./utils");
/**
 * Build YYYY-MM-DD string in JST for birthday all-day event.
 * Google Calendar all-day event uses end.date as exclusive end date,
 * so the caller should pass the next day for end.date.
 * @param {number} month
 * @param {number} day
 * @param {number} year
 * @return {string}
 */
function buildBirthdayDateString(month, day, year) {
    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    return `${year}-${mm}-${dd}`;
}
/**
 * Get next day date string (YYYY-MM-DD) from a given JST date string.
 * @param {string} dateString
 * @return {string}
 */
function getNextDateString(dateString) {
    const date = new Date(`${dateString}T00:00:00+09:00`);
    date.setDate(date.getDate() + 1);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}
/**
 * Create RRULE for yearly recurring birthday.
 * Feb 29 birthdays need special handling.
 * @param {number} month
 * @param {number} day
 * @return {string[]}
 */
function buildBirthdayRecurrence(month, day) {
    if (month === 2 && day === 29) {
        // Google Calendar birthday recurrence for leap day
        return ["RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1"];
    }
    return ["RRULE:FREQ=YEARLY"];
}
/**
 * Sync unsynced friend birthdays to Google Calendar as yearly recurring
 * all-day events.
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} calendarId
 * @return {Promise<Object>} Summary of sync results
 */
async function syncPendingBirthdaysToGoogleCalendar(db, calendarId) {
    var _a;
    const snapshot = await db
        .collection("friends")
        .where("active", "==", true)
        .get();
    const friends = snapshot.docs.map((doc) => {
        var _a;
        const data = doc.data();
        return {
            id: doc.id,
            ref: doc.ref,
            active: data.active,
            name: data.name,
            month: data.month,
            day: data.day,
            calendarSyncStatus: (_a = data.calendarSyncStatus) !== null && _a !== void 0 ? _a : "pending",
            googleCalendarEventId: data.googleCalendarEventId,
            calendarSyncErrorMessage: data.calendarSyncErrorMessage,
            calendarSyncedAt: data.calendarSyncedAt,
        };
    });
    const pendingFriends = friends.filter((friend) => friend.calendarSyncStatus !== "synced");
    if (pendingFriends.length === 0) {
        console.log("No pending birthday calendar sync.");
        return {
            scanned: friends.length,
            pending: 0,
            synced: 0,
            failed: 0,
        };
    }
    const auth = new googleapis_1.google.auth.GoogleAuth({
        scopes: ["https://www.googleapis.com/auth/calendar"],
    });
    const calendar = googleapis_1.google.calendar({
        version: "v3",
        auth,
    });
    const currentYear = (0, utils_1.getTokyoDate)().getFullYear();
    let syncedCount = 0;
    let failedCount = 0;
    for (const friend of pendingFriends) {
        try {
            const startDate = buildBirthdayDateString(friend.month, friend.day, currentYear);
            const endDate = getNextDateString(startDate);
            const event = {
                summary: `${friend.name}の誕生日`,
                description: `Birthday for ${friend.name}`,
                start: {
                    date: startDate,
                    timeZone: "Asia/Tokyo",
                },
                end: {
                    date: endDate,
                    timeZone: "Asia/Tokyo",
                },
                recurrence: buildBirthdayRecurrence(friend.month, friend.day),
                reminders: {
                    useDefault: true,
                },
            };
            const res = await calendar.events.insert({
                calendarId,
                requestBody: event,
            });
            await friend.ref.update({
                calendarSyncStatus: "synced",
                googleCalendarEventId: (_a = res.data.id) !== null && _a !== void 0 ? _a : null,
                calendarSyncErrorMessage: admin.firestore.FieldValue.delete(),
                calendarSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            syncedCount += 1;
            console.log(`Birthday synced for friend=${friend.id}, ` +
                `eventId=${res.data.id}`);
        }
        catch (error) {
            failedCount += 1;
            console.error(`Failed to sync birthday for friend=${friend.id}`, error);
            await friend.ref.update({
                calendarSyncStatus: "error",
                calendarSyncErrorMessage: String(error),
            });
        }
    }
    console.log(`Birthday calendar sync finished. scanned=${friends.length}, ` +
        `pending=${pendingFriends.length}, synced=${syncedCount}, ` +
        `failed=${failedCount}`);
    return {
        scanned: friends.length,
        pending: pendingFriends.length,
        synced: syncedCount,
        failed: failedCount,
    };
}
//# sourceMappingURL=syncCalendar.js.map