import {messagingApi} from "@line/bot-sdk";
import * as crypto from "crypto";
import {https} from "firebase-functions";
import {defineString} from "firebase-functions/params";

// 実行時に必要なパラメータを定義
const config = {
  channelSecret: defineString("CHANNEL_SECRET"),
  channelAccessToken: defineString("CHANNEL_ACCESS_TOKEN"),
};

export const webhook = https.onRequest(async (req, res) => {
  // LINE署名検証
  const signature = req.headers["x-line-signature"] as string;
  const body = JSON.stringify(req.body);
  const hash = crypto
    .createHmac("sha256", config.channelSecret.value())
    .update(body)
    .digest("base64");

  if (signature !== hash) {
    res.status(401).send("Invalid signature");
    return;
  }

  // LINE Messaging API Clientの初期化
  const client = new messagingApi.MessagingApiClient({
    channelAccessToken: config.channelAccessToken.value(),
  });

  // ユーザーがbotに送ったメッセージをそのまま返す
  const events = (req.body).events || [];

  try {
    await Promise.all(
      events.map(async (event: any) => {
        if (event.type === "message" && event.message.type === "text") {
          await client.replyMessage({
            replyToken: event.replyToken,
            messages: [{type: "text", text: event.message.text}],
          });
        }
      })
    );
    res.json({success: true});
  } catch (error) {
    console.error("Error processing webhook:", error);
    res.status(500).json({error: "Internal server error"});
  }
});
