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
exports.webhook = void 0;
const bot_sdk_1 = require("@line/bot-sdk");
const crypto = __importStar(require("crypto"));
const firebase_functions_1 = require("firebase-functions");
const params_1 = require("firebase-functions/params");
// 実行時に必要なパラメータを定義
const config = {
    channelSecret: (0, params_1.defineString)("CHANNEL_SECRET"),
    channelAccessToken: (0, params_1.defineString)("CHANNEL_ACCESS_TOKEN"),
};
exports.webhook = firebase_functions_1.https.onRequest(async (req, res) => {
    // LINE署名検証
    const signature = req.headers["x-line-signature"];
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
    const client = new bot_sdk_1.messagingApi.MessagingApiClient({
        channelAccessToken: config.channelAccessToken.value(),
    });
    // ユーザーがbotに送ったメッセージをそのまま返す
    const events = (req.body).events || [];
    try {
        await Promise.all(events.map(async (event) => {
            if (event.type === "message" && event.message.type === "text") {
                await client.replyMessage({
                    replyToken: event.replyToken,
                    messages: [{ type: "text", text: event.message.text }],
                });
            }
        }));
        res.json({ success: true });
    }
    catch (error) {
        console.error("Error processing webhook:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
//# sourceMappingURL=index.js.map