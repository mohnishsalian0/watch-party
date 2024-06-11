importScripts("socket.io.min.js");
importScripts("remote-control.js");

function setupRoomRelay() {
  socket.on("room:create", (payload) => {
    console.log("[Background] Received message from server: ", payload);
    popupPort.postMessage({ topic: "room:create", payload });
  });

  socket.on("room:join", (payload) => {
    console.log("[Background] Received message from server: ", payload);
    popupPort.postMessage({ topic: "room:join", payload });
  });

  socket.on("room:leave", (payload) => {
    console.log("[Background] Received message from server: ", payload);
    popupPort.postMessage({ topic: "room:leave", payload });
  });

  socket.on("room:hostChange", (payload) => {
    console.log("[Background] Received message from server: ", payload);
    popupPort.postMessage({ topic: "room:hostChange", payload });
  });
}

function setupVideoRelay() {
  // contentscriptPort.postMessage("Hello from remote control");
  // contentscriptPort.onMessage.addListener((msg) => {
  //   console.log("[Remote] Message received from content script: ", msg);
  // });

  socket.on("video:play", (payload) => {
    console.log("[Background] Received message from content script:", payload);
    contentscriptPort.postMessage({ topic: "video:play" });
    popupPort.postMessage({ topic: "video:play", payload });
  });

  socket.on("video:pause", (payload) => {
    console.log("[Background] Received message from content script:", payload);
    contentscriptPort.postMessage({ topic: "video:pause" });
    popupPort.postMessage({ topic: "video:pause", payload });
  });

  socket.on("video:seek", (payload) => {
    console.log("[Background] Received message from content script:", payload);
    contentscriptPort.postMessage({
      topic: "video:seek",
      timestamp: payload.timestamp,
    });
    popupPort.postMessage({ topic: "video:seek", payload });
  });

  socket.on("video:adjustPlaybackRate", (payload) => {
    console.log("[Background] Received message from content script:", payload);
    contentscriptPort.postMessage({
      topic: "video:adjustPlaybackRate",
      rate: payload.rate,
    });
    popupPort.postMessage({ topic: "video:adjustPlaybackRate", payload });
  });
}

function setupChatRelay() {
  socket.on("chat:message", (payload) => {
    console.log("[Background] Received message from server: ", payload);
    popupPort.postMessage({ topic: "chat:message", payload });
  });

  socket.on("chat:reaction", (payload) => {
    console.log("[Background] Received message from server: ", payload);
    contentscriptPort.postMessage({ topic: "chat:reaction", payload });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed");
  const seed = Math.floor(Math.random() * 100);
  const avatarUrl = "https://api.dicebear.com/8.x/adventurer/svg?seed=" + seed;
  chrome.storage.local
    .set({ avatarUrl })
    .then(() => console.log("Avatar url saved:", avatarUrl));
});

const socket = io("http://localhost:3000", {
  auth: {
    userId: 123,
    userName: "Mohnish",
    userAvatar: "www.dicebear.com",
  },
  transports: ["websocket"],
});

socket.on("connect_error", (err) => {
  console.log("[Background] Socket connection error:", err);
});

// Communication ports between popup-background & contentscript-background
let popupPort;
let contentscriptPort;

chrome.runtime.onConnect.addListener(function (port) {
  if (port.name === "popup-background") {
    popupPort = port;
  } else if (contentscriptPort.name === "contentscript-background") {
    contentscriptPort = port;
  }

  if (popupPort && contentscriptPort) {
    socket.on("connect", () => {
      console.log("[Background] Socket connection established");

      // Pass content script message to socket
      contentscriptPort.onMessage.addListener((msg) => {
        console.log("[Background] Message received from content script: ", msg);
        socket.emit(msg.topic, msg.payload);
      });

      // Pass popup message to socket
      popupPort.onMessage.addListener(function (msg) {
        console.log("[Background] Received message from popup: ", msg);
        socket.emit(msg.topic, msg.payload);
      });

      setupRoomRelay();
      setupVideoRelay();
    });
  }
});
