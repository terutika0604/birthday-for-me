import * as admin from "firebase-admin";

/**
 * Friend document type in Firestore
 */
export type FriendDocument = {
  active: boolean;
  name: string;
  month: number;
  day: number;
  calendarSyncStatus: "pending" | "synced" | "error";
  googleCalendarEventId?: string;
  calendarSyncErrorMessage?: string;
  calendarSyncedAt?: admin.firestore.Timestamp;
};
