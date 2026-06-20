import {https} from "firebase-functions";

export const webhook = https.onRequest((req, res) => {
  res.send("HTTP POST request sent to the webhook URL!");
});
