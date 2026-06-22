"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.importFriendsFromSheet = importFriendsFromSheet;
const googleapis_1 = require("googleapis");
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
async function importFriendsFromSheet(db, options) {
    var _a;
    const { spreadsheetId, sheetName } = options;
    const auth = new googleapis_1.google.auth.GoogleAuth({
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = googleapis_1.google.sheets({
        version: "v4",
        auth,
    });
    // A2:G を全部読む
    const range = `${sheetName}!A2:G`;
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
    });
    const rows = (_a = response.data.values) !== null && _a !== void 0 ? _a : [];
    if (rows.length === 0) {
        console.log("No form rows found in sheet.");
        return {
            imported: 0,
            skipped: 0,
            errored: 0,
        };
    }
    const parsedRows = rows.map((row, index) => {
        var _a, _b, _c, _d, _e, _f, _g;
        return ({
            rowNumber: index + 2,
            timestamp: (_a = row[0]) !== null && _a !== void 0 ? _a : "",
            name: (_b = row[1]) !== null && _b !== void 0 ? _b : "",
            monthRaw: (_c = row[2]) !== null && _c !== void 0 ? _c : "",
            dayRaw: (_d = row[3]) !== null && _d !== void 0 ? _d : "",
            processedRaw: (_e = row[4]) !== null && _e !== void 0 ? _e : "",
            friendIdRaw: (_f = row[5]) !== null && _f !== void 0 ? _f : "",
            errorRaw: (_g = row[6]) !== null && _g !== void 0 ? _g : "",
        });
    });
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
            if (testDate.getMonth() + 1 !== month ||
                testDate.getDate() !== day) {
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
                console.log("Skipped duplicate form row=%d friendId=%s name=%s", row.rowNumber, existingFriendId, name);
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
            console.log("Imported friend from sheet=%d friendId=%s name=%s birthday=%d/%d", row.rowNumber, docRef.id, name, month, day);
            imported += 1;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`Failed to import form row=${row.rowNumber} name=${name}:`, error);
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
    console.log("importFriendsFromSheet finished. imported=%d, skipped=%d, errored=%d", imported, skipped, errored);
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
async function updateSheetRowResult(params) {
    const { sheets, spreadsheetId, sheetName, rowNumber, processed, friendId, error, } = params;
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
//# sourceMappingURL=importFriendsFromSheet.js.map