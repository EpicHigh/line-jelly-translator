import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as request from "request-promise";
import * as crypto from "crypto";
import * as dotenv from "dotenv"

dotenv.config();
admin.initializeApp(functions.config().firebase);

const REGION = "asia-northeast1";
const GROUP_ID = process.env.LINE_GROUP_ID;
const LINE_MESSAGING_API = "https://api.line.me/v2/bot/message";
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;

const runtimeOpts = { timeoutSeconds: 4, memory: "2GB" };
const LINE_HEADER = {
  "Content-Type": "application/json",
  Authorization:
    `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
};

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
// export const helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });

exports.LineWebhook = functions
  .region(REGION)
  // @ts-ignore
  .runWith(runtimeOpts)
  .https.onRequest(
    async (
      req: { headers: any; body: { events: any[] }; method: any },
      res: {
        status: (
          arg0: number
        ) => {
          (): any;
          new (): any;
          send: { (arg0: string): any; new (): any };
        };
      }
    ) => {
      const text = JSON.stringify(req.body);
      const signature = crypto
      // @ts-ignore
        .createHmac("SHA256", LINE_CHANNEL_SECRET)
        .update(text)
        .digest("base64")
        .toString();
      if (signature !== req.headers["x-line-signature"]) {
        return res.status(401).send("Unauthorized");
      }

      const event = req.body.events[0];
      if (event.message.type === "text") {
        const input = event.message.text;
        await admin
          .firestore()
          .collection("translations")
          .doc("inputText")
          .set({
            input
          })
          .then(function() {
            console.log("Document successfully written!");
          })
          .catch(function(error) {
            console.error("Error writing document: ", error);
          });
      }
      return res.status(200).send(req.method);
    }
  );

exports.LineBotPush = functions
  .region(REGION)
  // @ts-ignore
  .runWith(runtimeOpts)
  .firestore.document("translations/inputText")
  .onWrite(async (change: { after: { data: () => any } }, context: any) => {
    const latest = change.after.data();
    const input = latest.input;
    const containsEnglish = input.match(/\w+/g);
    const containsThai = input.match(/[\u0E00-\u0E7F]+/g);
    if (containsThai) {
      push(GROUP_ID, latest.translated.en);
    } else if (containsEnglish) {
      push(GROUP_ID, latest.translated.th);
    }
  });

const push = (userId: any, msg: string) => {
  return request.post({
    headers: LINE_HEADER,
    uri: `${LINE_MESSAGING_API}/push`,
    body: JSON.stringify({
      to: userId,
      messages: [{ type: "text", text: msg }]
    })
  });
};
