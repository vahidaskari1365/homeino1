// Quick probe: does z-ai-web-dev-sdk createVision REALLY see the room photo?
import { readFileSync } from "node:fs";
import ZAI from "z-ai-web-dev-sdk";

const room = readFileSync("/home/z/my-project/homeino-live/public/images/samples/room-1.jpg").toString("base64");
const dataUrl = `data:image/jpeg;base64,${room}`;

const zai = await ZAI.create();
const res = await zai.chat.completions.createVision({
  messages: [{
    role: "user",
    content: [
      { type: "text", text: 'Locate the sofa, curtains and ottoman/coffee table in this room photo. Reply ONLY JSON: {"objects":[{"type":"...","box":{"x":0..1,"y":0..1,"w":0..1,"h":0..1}}]}' },
      { type: "image_url", image_url: { url: dataUrl } },
    ],
  }],
  thinking: { type: "disabled" },
});
console.log(res.choices?.[0]?.message?.content?.slice(0, 500));
