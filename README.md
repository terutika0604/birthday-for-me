# Birthday Broadcast Bot

Firebase Functions project that imports birthday entries from Google Sheets, syncs birthdays to Google Calendar, and broadcasts birthday notifications through LINE.

## 概要

- Google Sheets から申請された友だちの誕生日データを Firestore に取り込み
- `calendarSyncStatus` が `pending` のレコードを Google カレンダーに同期
- 今日・明日の誕生日を LINE のブロードキャストで通知
- 毎日 00:00 JST に自動実行、手動実行の HTTP エンドポイントも用意

## 構成

- `functions/src/index.ts` - 実行フローのエントリポイント
- `functions/src/importFriendsFromSheet.ts` - Google Sheets から Firestore への取り込み
- `functions/src/syncCalendar.ts` - 友だちの誕生日を Google Calendar に同期
- `functions/src/utils.ts` - JST 日付取得など共通ユーティリティ
- `functions/src/types.ts` - Firestore ドキュメント型定義

## 前提

- Firebase プロジェクト
- Firebase CLI (`firebase-tools`)
- Cloud Functions 実行環境で Google Calendar / Google Sheets API が有効
- LINE Messaging API のチャネルアクセストークン

## 依存関係

`functions/package.json` で管理

- `@line/bot-sdk`
- `firebase-admin`
- `firebase-functions`
- `googleapis`
- `typescript`, `eslint` など開発用依存

## 設定

Cloud Functions のパラメータに以下を設定してください。

- `CHANNEL_SECRET`
- `CHANNEL_ACCESS_TOKEN`
- `GOOGLE_CALENDAR_ID`
- `GOOGLE_SHEET_ID`
- `GOOGLE_SHEET_NAME`

必要に応じてローカル開発用に以下も設定できます。

- `FIRESTORE_PROJECT_ID`
- `ADMIN_SERVICE_ACCOUNT_JSON`

`functions/src/index.ts` の `config` ブロックにコメントで設定例があります。

## 開発・デプロイ

### 依存インストール

```bash
cd functions
npm install
```

### ローカルビルド / lint

```bash
cd functions
npm run lint
npm run build
```

### デプロイ

```bash
cd functions
npm run deploy
```

`firebase.json` では `predeploy` に `lint` と `build` が設定されています。

## 実行フロー

1. `importFriendsFromSheet` - Google Sheets の未処理行を Firestore `friends` コレクションに追加
2. `syncPendingBirthdaysToGoogleCalendar` - `calendarSyncStatus !== "synced"` のレコードを Google Calendar に同期
3. `sendBirthdayBroadcast` - 本日・明日の誕生日を LINE ブロードキャスト

## 手動テスト

デプロイ後は HTTP 関数 `testBirthdayBroadcast` を叩くことで、同じ処理を手動で実行できます。

- `testBirthdayBroadcast` は `functions/src/index.ts` で定義されています

## Firestore スキーマ

`friends` ドキュメント例:

- `active`: boolean
- `name`: string
- `month`: number
- `day`: number
- `calendarSyncStatus`: string (`pending`, `synced`, `error`)
- `googleCalendarEventId`: string | null
- `calendarSyncErrorMessage`: string | null
- `calendarSyncedAt`: timestamp

## 注意点

- Cloud Functions のサービスアカウントに Google Sheets / Google Calendar へのアクセス権が必要です。
- LINE API のトークンを正しく設定しないと送信に失敗します。
- Google Sheets の読み取り範囲は `sheetName!A2:G` です。

## 追加メモ

- `functions/src/importFriendsFromSheet.ts` は Firestore インスタンスを外部から受け取る設計になっています。
- `functions/src/syncCalendar.ts` は `db` を渡して Google Calendar への同期を行います。

---

以上の説明に従って環境を構築すれば、誕生日通知バッチが動作します。