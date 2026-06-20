"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhook = void 0;
const firebase_functions_1 = require("firebase-functions");
exports.webhook = firebase_functions_1.https.onRequest((req, res) => {
    res.send("HTTP POST request sent to the webhook URL!");
});
//# sourceMappingURL=index.js.map