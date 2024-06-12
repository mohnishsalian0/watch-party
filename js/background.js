importScripts("socket.io.min.js");

async function initStorage(storageCache) {
  try {
    const items = await chrome.storage.local.get();
    Object.assign(storageCache, items);
    console.log("[Background] Fetched user data from local storage: ", items);
  } catch (e) {
    console.error("[Background] Failed to fetch data from local storage: ", e);
  }
}

function setupSocket(socket, storageCache) {
  // Setup socket connection with backend if both ports are online
  const { userId, userName, userAvatar } = storageCache;
  socket = io("http://localhost:3000", {
    auth: {
      userId,
      userName,
      userAvatar,
    },
    transports: ["websocket"],
  });

  socket.on("connect", () => {
    setupRoomRelay(socket);
    setupVideoRelay(socket);
    setupChatRelay(socket);

    console.log("[Background] Socket connection established");
  });

  socket.on("connect_error", (err) => {
    console.log("[Background] Socket connection error:", err);
  });
}

function setupPorts(popupPort, contentscriptPort) {
  chrome.runtime.onConnect.addListener(function (port) {
    if (port.name === "popup-background") {
      popupPort = port;

      // Pass popup message to socket
      popupPort.onMessage.addListener(function (msg) {
        console.log("[Background] Received message from popup: ", msg);
        if (!socket || !socket.connected) return;
        socket.emit(msg.topic, msg.payload, (result) => {
          console.log("[Background] Received callback from server: ", result);
          popupPort.postMessage({ topic: msg.topic, payload: result });
        });
      });

      popupPort.onDisconnect.addListener(() => {
        popupPort = undefined;
      });

      console.log("[Background] Connected to popup port");
    } else if (port.name === "contentscript-background") {
      contentscriptPort = port;

      // Pass content script message to socket
      contentscriptPort.onMessage.addListener((msg) => {
        console.log("[Background] Message received from content script: ", msg);
        if (!socket || !socket.connected) return;
        socket.emit(msg.topic, msg.payload, (result) => {
          console.log("[Background] Received callback from server: ", result);
          contentscriptPort.postMessage({ topic: msg.topic, payload: result });
        });
      });

      contentscriptPort.onDisconnect.addListener(() => {
        contentscriptPort = undefined;
      });

      console.log("[Background] Connected to content script port");
    }
  });
}

function setupRoomRelay(socket) {
  socket.on("room:join", (payload) => {
    console.log("[Background] Received message from server: ", payload);
    if (!popupPort) return;
    popupPort.postMessage({ topic: "room:join", payload });
  });

  socket.on("room:leave", (payload) => {
    console.log("[Background] Received message from server: ", payload);
    if (!popupPort) return;
    popupPort.postMessage({ topic: "room:leave", payload });
  });

  socket.on("room:hostChange", (payload) => {
    console.log("[Background] Received message from server: ", payload);
    if (!popupPort) return;
    popupPort.postMessage({ topic: "room:hostChange", payload });
  });
}

function setupVideoRelay(socket) {
  socket.on("video:play", (payload) => {
    console.log("[Background] Received message from server:", payload);
    if (!popupPort || !contentscriptPort) return;
    contentscriptPort.postMessage({ topic: "video:play" });
    popupPort.postMessage({ topic: "video:play", payload });
  });

  socket.on("video:pause", (payload) => {
    console.log("[Background] Received message from server:", payload);
    if (!popupPort || !contentscriptPort) return;
    contentscriptPort.postMessage({ topic: "video:pause" });
    popupPort.postMessage({ topic: "video:pause", payload });
  });

  socket.on("video:seek", (payload) => {
    console.log("[Background] Received message from server:", payload);
    if (!popupPort || !contentscriptPort) return;
    contentscriptPort.postMessage({
      topic: "video:seek",
      timestamp: payload.timestamp,
    });
    popupPort.postMessage({ topic: "video:seek", payload });
  });

  socket.on("video:adjustPlaybackRate", (payload) => {
    console.log("[Background] Received message from server:", payload);
    if (!popupPort || !contentscriptPort) return;
    contentscriptPort.postMessage({
      topic: "video:adjustPlaybackRate",
      rate: payload.rate,
    });
    popupPort.postMessage({ topic: "video:adjustPlaybackRate", payload });
  });
}

function setupChatRelay(socket) {
  console.log("setting up chat reaction relay");
  socket.on("chat:message", (payload) => {
    console.log("[Background] Received message from server: ", payload);
    if (!popupPort) return;
    popupPort.postMessage({ topic: "chat:message", payload });
  });

  socket.on("chat:reaction", (payload) => {
    console.log("[Background] Received message from server: ", payload);
    if (!contentscriptPort) return;
    contentscriptPort.postMessage({ topic: "chat:reaction", payload });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed");
  const userId = Math.random().toString(36).substring(2, 12);
  const seed = Math.floor(Math.random() * 100);
  const userAvatar = "https://api.dicebear.com/8.x/adventurer/svg?seed=" + seed;
  chrome.storage.local
    .set({ userId, userAvatar })
    .then(() => console.log("Avatar url saved:", userAvatar));
});

// Messaging ports to popup-background & contentscript-background
let popupPort;
let contentscriptPort;
setupPorts(popupPort, contentscriptPort);

const storageCache = {};

let socket;

initStorage(storageCache).then(() => {
  setupSocket(socket, storageCache);
});
