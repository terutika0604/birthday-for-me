import {google} from "googleapis";

export type ImportFriendsFromSheetOptions = {
  spreadsheetId: string;
  sheetName: string;
};

type SheetRow = {
  rowNumber: number; // スプレッドシート上の実際の行番号（2始まり）
  timestamp: string;
  name: string;
  monthRaw: string;
  dayRaw: string;
  processedRaw: string;
  friendIdRaw: string;
  errorRaw: string;
};

/**
 * Google Sheets の未処理行を Firestore friends に取り込む
 *
 * シート列前提:
 * A: タイムスタンプ
 * B: 名前
 * C: 月
 * D: 日
 * E: processed
 * F: friendId
 * G: error
 *
 * @param {FirebaseFirestore.Firestore} db - Firestore インスタンス
 * @param {ImportFriendsFromSheetOptions} options - スプレッドシート情報
 * @return {{imported: number, skipped: number, errored: number}} 処理結果カウント
 */
export async function importFriendsFromSheet(
  db: FirebaseFirestore.Firestore,
  options: ImportFriendsFromSheetOptions,
): Promise<{
  imported: number;
  skipped: number;
  errored: number;
}> {
  const {spreadsheetId, sheetName} = options;

  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({
    version: "v4",
    auth,
  });

  // A2:G を全部読む
  const range = `${sheetName}!A2:G`;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const rows = response.data.values ?? [];

  if (rows.length === 0) {
    console.log("No form rows found in sheet.");
    return {
      imported: 0,
      skipped: 0,
      errored: 0,
    };
  }

  const parsedRows: SheetRow[] = rows.map((row, index) => ({
    rowNumber: index + 2,
    timestamp: row[0] ?? "",
    name: row[1] ?? "",
    monthRaw: row[2] ?? "",
    dayRaw: row[3] ?? "",
    processedRaw: row[4] ?? "",
    friendIdRaw: row[5] ?? "",
    errorRaw: row[6] ?? "",
  }));

  let imported = 0;
  let skipped = 0;
  let errored = 0;

  for (const row of parsedRows) {
    const processed = String(row.processedRaw).trim().toUpperCase() === "TRUE";

    // すでに処理済みならスキップ
    if (processed) {
      skipped += 1;
      continue;
    }

    const name = row.name.trim();
    const month = Number(row.monthRaw);
    const day = Number(row.dayRaw);

    try {
      // バリデーション
      if (!name) {
        throw new Error("name is required");
      }

      if (!Number.isInteger(month) || month < 1 || month > 12) {
        throw new Error("invalid month");
      }

      if (!Number.isInteger(day) || day < 1 || day > 31) {
        throw new Error("invalid day");
      }

      // 実在日チェック
      const testDate = new Date(2024, month - 1, day);
      if (
        testDate.getMonth() + 1 !== month ||
        testDate.getDate() !== day
      ) {
        throw new Error("invalid date");
      }

      // 重複チェック
      const existing = await db
        .collection("friends")
        .where("active", "==", true)
        .where("name", "==", name)
        .where("month", "==", month)
        .where("day", "==", day)
        .limit(1)
        .get();

      if (!existing.empty) {
        const existingFriendId = existing.docs[0].id;

        // 重複は「処理済み」としてシートに残す
        await updateSheetRowResult({
          sheets,
          spreadsheetId,
          sheetName,
          rowNumber: row.rowNumber,
          processed: true,
          friendId: existingFriendId,
          error: "already exists",
        });

        console.log(
          "Skipped duplicate form row=%d friendId=%s name=%s",
          row.rowNumber,
          existingFriendId,
          name,
        );

        skipped += 1;
        continue;
      }

      // Firestore追加
      const docRef = await db.collection("friends").add({
        active: true,
        name,
        month,
        day,
        calendarSyncStatus: "pending",
      });

      // シート更新
      await updateSheetRowResult({
        sheets,
        spreadsheetId,
        sheetName,
        rowNumber: row.rowNumber,
        processed: true,
        friendId: docRef.id,
        error: "",
      });

      console.log(
        "Imported friend from sheet=%d friendId=%s name=%s birthday=%d/%d",
        row.rowNumber,
        docRef.id,
        name,
        month,
        day,
      );

      imported += 1;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      console.error(
        `Failed to import form row=${row.rowNumber} name=${name}:`,
        error,
      );

      // エラー内容をシートへ書き戻す
      await updateSheetRowResult({
        sheets,
        spreadsheetId,
        sheetName,
        rowNumber: row.rowNumber,
        processed: false,
        friendId: "",
        error: errorMessage,
      });

      errored += 1;
    }
  }

  console.log(
    "importFriendsFromSheet finished. imported=%d, skipped=%d, errored=%d",
    imported,
    skipped,
    errored,
  );

  return {
    imported,
    skipped,
    errored,
  };
}

/**
 * シートの E列〜G列へ処理結果を書き戻す
 *
 * @param {Object} params 処理結果パラメータ
 * @return {Promise<void>}
 */
async function updateSheetRowResult(params: {
  sheets: ReturnType<typeof google.sheets>;
  spreadsheetId: string;
  sheetName: string;
  rowNumber: number;
  processed: boolean;
  friendId: string;
  error: string;
}): Promise<void> {
  const {
    sheets,
    spreadsheetId,
    sheetName,
    rowNumber,
    processed,
    friendId,
    error,
  } = params;

  // E列(processed)〜G列(error)を書き換える
  const range = `${sheetName}!E${rowNumber}:G${rowNumber}`;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "RAW",
    requestBody: {
      values: [[processed ? "TRUE" : "FALSE", friendId, error]],
    },
  });
}
