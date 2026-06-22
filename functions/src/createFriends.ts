import * as admin from "firebase-admin";
import {https} from "firebase-functions";

const db = admin.firestore();

type CreateFriendRequest = {
  name: string;
  month: number;
  day: number;
};

export const createFriend = https.onRequest(async (req, res) => {
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
    const body = req.body as CreateFriendRequest;

    const name = body.name?.trim();
    const month = Number(body.month);
    const day = Number(body.day);

    if (!name) {
      res.status(400).json({
        error: "name is required",
      });
      return;
    }

    if (
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12
    ) {
      res.status(400).json({
        error: "invalid month",
      });
      return;
    }

    if (
      !Number.isInteger(day) ||
      day < 1 ||
      day > 31
    ) {
      res.status(400).json({
        error: "invalid day",
      });
      return;
    }

    // 2/31みたいな不正日付をチェック
    const testDate = new Date(2024, month - 1, day);

    if (
      testDate.getMonth() + 1 !== month ||
      testDate.getDate() !== day
    ) {
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

    console.log(
      `Friend created id=${docRef.id} name=${name} birthday=${month}/${day}`,
    );

    res.status(201).json({
      success: true,
      friendId: docRef.id,
    });
  } catch (error) {
    console.error("createFriend error", error);

    res.status(500).json({
      error: String(error),
    });
  }
});
