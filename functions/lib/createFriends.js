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
exports.createFriend = void 0;
const admin = __importStar(require("firebase-admin"));
const firebase_functions_1 = require("firebase-functions");
const db = admin.firestore();
exports.createFriend = firebase_functions_1.https.onRequest(async (req, res) => {
    var _a;
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }
    if (req.method !== "POST") {
        res.status(405).json({
            error: "Method not allowed",
        });
        return;
    }
    try {
        const body = req.body;
        const name = (_a = body.name) === null || _a === void 0 ? void 0 : _a.trim();
        const month = Number(body.month);
        const day = Number(body.day);
        if (!name) {
            res.status(400).json({
                error: "name is required",
            });
            return;
        }
        if (!Number.isInteger(month) ||
            month < 1 ||
            month > 12) {
            res.status(400).json({
                error: "invalid month",
            });
            return;
        }
        if (!Number.isInteger(day) ||
            day < 1 ||
            day > 31) {
            res.status(400).json({
                error: "invalid day",
            });
            return;
        }
        // 2/31みたいな不正日付をチェック
        const testDate = new Date(2024, month - 1, day);
        if (testDate.getMonth() + 1 !== month ||
            testDate.getDate() !== day) {
            res.status(400).json({
                error: "invalid date",
            });
            return;
        }
        const docRef = await db.collection("friends").add({
            active: true,
            name,
            month,
            day,
            calendarSyncStatus: "pending",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`Friend created id=${docRef.id} name=${name} birthday=${month}/${day}`);
        res.status(201).json({
            success: true,
            friendId: docRef.id,
        });
    }
    catch (error) {
        console.error("createFriend error", error);
        res.status(500).json({
            error: String(error),
        });
    }
});
//# sourceMappingURL=createFriends.js.map