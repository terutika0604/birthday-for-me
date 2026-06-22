import {messagingApi} from "@line/bot-sdk";
import * as admin from "firebase-admin";
import {https} from "firebase-functions";
import {defineString} from "firebase-functions/params";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {importFriendsFromSheet} from "./importFriendsFromSheet";
import {syncPendingBirthdaysToGoogleCalendar} from "./syncCalendar";
import {FriendDocument} from "./types";
import {getTokyoDate} from "./utils";

// 実行時に必要なパラメータを定義
const config = {
  channelSecret: defineString("CHANNEL_SECRET"),
  channelAccessToken: defineString("CHANNEL_ACCESS_TOKEN"),
  googleCalendarId: defineString("GOOGLE_CALENDAR_ID"),
  googleSheetId: defineString("GOOGLE_SHEET_ID"),
  googleSheetName: defineString("GOOGLE_SHEET_NAME"),
  // Firestore の接続情報を明示的に指定する場合は以下を使います。
  // たとえばローカル実行時に projectId を渡す場合:
  // firestoreProjectId: defineString("FIRESTORE_PROJECT_ID"),
  // adminServiceAccount: defineString("ADMIN_SERVICE_ACCOUNT_JSON"),
};

// Firestore と Firebase 管理 SDK の初期化
// Cloud Functions 環境では自動的に認証情報が設定されます。
// ローカル実行や別プロジェクトに接続する場合は、コメントを外して projectId を指定してください。
// admin.initializeApp({ projectId: config.firestoreProjectId?.value() });
admin.initializeApp();
const db = admin.firestore();

/**
 * Friend document type in Firestore
 */
// FriendDocument and getTokyoDate imported from modules

/**
 * Build birthday notification messages
 * @param {Array} todayList Friends with birthday today
 * @param {Array} tomorrowList Friends with birthday tomorrow
 * @return {Array} Array of message objects
 */
function buildBirthdayMessage(
  todayList: (FriendDocument & { id: string })[],
  tomorrowList: (FriendDocument & { id: string })[],
): Array<{ type: "text"; text: string }> {
  const messages: Array<{ type: "text"; text: string }> = [];

  if (todayList.length > 0) {
    const names = todayList.map((doc) => doc.name).join("、");
    messages.push({type: "text", text: `🎉 今日が誕生日の友だち: ${names}`});
  }

  if (tomorrowList.length > 0) {
    const names = tomorrowList.map((doc) => doc.name).join("、");
    messages.push({type: "text", text: `📅 明日が誕生日の友だち: ${names}`});
  }

  if (messages.length === 0) {
    messages.push({type: "text", text: "今日・明日の誕生日の友だちはいません。"});
  }

  return messages;
}

/**
 * Send birthday broadcast to LINE
 * @return {Promise} Object with today and tomorrow birthday counts
 */
async function sendBirthdayBroadcast(): Promise<{
  today: number;
  tomorrow: number;
}> {
  const today = getTokyoDate();
  const tomorrow = getTokyoDate(1);

  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();
  const tomorrowMonth = tomorrow.getMonth() + 1;
  const tomorrowDay = tomorrow.getDate();

  // Firestore のコレクション名とドキュメント構造を
  // 必要に応じて変更してください。
  const snapshot = await db.collection("friends").get();
  const friends = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      active: data.active,
      name: data.name,
      month: data.month,
      day: data.day,
      calendarSyncStatus: data.calendarSyncStatus,
    } as FriendDocument & { id: string };
  });

  // 非アクティブな友だちは除外する
  const activeFriends = friends.filter((f) => f.active);

  const todayBirthday = activeFriends.filter(
    (friend) =>
      friend.month === todayMonth && friend.day === todayDay,
  );
  const tomorrowBirthday = activeFriends.filter(
    (friend) =>
      friend.month === tomorrowMonth && friend.day === tomorrowDay,
  );

  const messages = buildBirthdayMessage(todayBirthday, tomorrowBirthday);

  const client = new messagingApi.MessagingApiClient({
    channelAccessToken: config.channelAccessToken.value(),
  });

  await client.broadcast({messages});

  const logMessage =
    `birthdayBroadcast sent. today=${todayBirthday.length}, ` +
    `tomorrow=${tomorrowBirthday.length}`;
  console.log(logMessage);

  return {
    today: todayBirthday.length,
    tomorrow: tomorrowBirthday.length,
  };
}

// スケジュール実行（毎日0:00）
/**
 * Scheduled function to send birthday broadcast every day at 00:00 JST
 */
export const birthdayBroadcast = onSchedule(
  {
    schedule: "0 0 * * *",
    timeZone: "Asia/Tokyo",
  },
  async () => {
    // 1. Google Form回答をシートから取り込む
    await importFriendsFromSheet(
      db,
      {
        spreadsheetId: config.googleSheetId.value(),
        sheetName: config.googleSheetName.value(),
      },
    );

    // 2. pending の友人を Google Calendar に同期
    await syncPendingBirthdaysToGoogleCalendar(
      db,
      config.googleCalendarId.value(),
    );

    // 3. 誕生日通知を送る
    await sendBirthdayBroadcast();
  },
);

// テスト用：webhook で実行可能
/**
 * HTTP endpoint to test birthday broadcast manually
 */
export const testBirthdayBroadcast = https.onRequest(async (req, res) => {
  try {
    // 1. Google Form回答をシートから取り込む
    await importFriendsFromSheet(
      db,
      {
        spreadsheetId: config.googleSheetId.value(),
        sheetName: config.googleSheetName.value(),
      },
    );

    // 2. pending の友人を Google Calendar に同期
    await syncPendingBirthdaysToGoogleCalendar(
      db,
      config.googleCalendarId.value(),
    );

    // 3. 誕生日通知を送る
    const result = await sendBirthdayBroadcast();
    res.json({
      success: true,
      todayCount: result.today,
      tomorrowCount: result.tomorrow,
    });
  } catch (error) {
    console.error("Error in testBirthdayBroadcast:", error);
    res.status(500).json({error: String(error)});
  }
});
