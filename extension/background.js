const API = "http://127.0.0.1:22333/api/logs";

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== "QUERY2CARD_LOG") return;

  console.log("[Query2Card] background received message", msg.payload);

  fetch(API, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(msg.payload)
  })
    .then(res => res.json())
    .then(data => {
      console.log("[Query2Card] backend response", data);
      sendResponse({ok: true, data});
    })
    .catch(err => {
      console.warn("[Query2Card] backend not available", err);
      sendResponse({ok: false, error: String(err)});
    });

  return true;
});
