importScripts("socket.io.min.js");

// Messaging ports to popup & contentscript
let popupPort;
let contentPort;
let sidepanelPort;

let storageCache = {};

let session = {};

let socket;

function handleJoinRoom(msg) {
  // Save room name to session variable
  session.room = msg.payload.room;

  // Save room name to session storage for sidepanel
  chrome.storage.session
    .set({ room: msg.payload.room })
    .then(() =>
      console.log("Room name set in session storage: ", msg.payload.room),
    );

  // Set room in socket auth and initiate connection
  socket.auth.room = msg.payload.room;
  socket.connect();

  // Save tab id & url to session variable and open sidepanel
  let queryOptions = { active: true, lastFocusedWindow: true };
  return chrome.tabs.query(queryOptions, ([tab]) => {
    if (chrome.runtime.lastError)
      console.error(
        "[Background] Chrome tab query error: ",
        chrome.runtime.lastError,
      );
    if (tab) {
      // Store tab id & url in session variable
      session.tabId = tab.id;
      session.tabUrl = tab.url;

      // Open sidepanel
      chrome.sidePanel.open({ tabId: session.tabId });

      // Load emote tray on main page
      chrome.scripting
        .executeScript({
          target: { tabId: tab.id },
          files: ["js/content.js"],
        })
        .then(() => console.log("[Background] Content script injected"));
    }
  });

  // Load emote tray on DOM
}

function handleLeaveRoom() {
  socket.disconnect();
}

function handleIncomingMessage(msg) {
  if (!socket || !socket.connected) return;

  console.log("[Background] Sending message to server");
  socket.emit(msg.topic, msg.payload, (result) => {
    console.log("[Background] Received callback from server: ", result);
    popupPort.postMessage({ topic: msg.topic, payload: result });
  });
}

async function initStorage() {
  try {
    const items = await chrome.storage.local.get();
    Object.assign(storageCache, items);
    console.log("[Background] Fetched from local storage: ", items);
  } catch (e) {
    console.error("[Background] Failed to fetch data from local storage: ", e);
  }

  chrome.storage.onChanged.addListener((changes, namespace) => {
    for (let [key, { _, newValue }] of Object.entries(changes)) {
      if (namespace === "local") storageCache[key] = newValue;
    }
  });
}

function setupRoomRelay() {
  socket.on("user:joined", (payload) => {
    console.log("[Background] Received message from server: ", payload);
    if (!sidepanelPort) return;
    sidepanelPort.postMessage({ topic: "user:joined", payload });
  });

  socket.on("room:users", (payload) => {
    console.log("[Background] Received message from server: ", payload);
    if (!sidepanelPort) return;
    sidepanelPort.postMessage({ topic: "user:joined", payload });
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
    if (!popupPort || !contentPort) return;
    contentPort.postMessage({ topic: "video:play" });
    popupPort.postMessage({ topic: "video:play", payload });
  });

  socket.on("video:pause", (payload) => {
    console.log("[Background] Received message from server:", payload);
    if (!popupPort || !contentPort) return;
    contentPort.postMessage({ topic: "video:pause" });
    popupPort.postMessage({ topic: "video:pause", payload });
  });

  socket.on("video:seek", (payload) => {
    console.log("[Background] Received message from server:", payload);
    if (!popupPort || !contentPort) return;
    contentPort.postMessage({
      topic: "video:seek",
      timestamp: payload.timestamp,
    });
    popupPort.postMessage({ topic: "video:seek", payload });
  });

  socket.on("video:adjustPlaybackRate", (payload) => {
    console.log("[Background] Received message from server:", payload);
    if (!popupPort || !contentPort) return;
    contentPort.postMessage({
      topic: "video:adjustPlaybackRate",
      rate: payload.rate,
    });
    popupPort.postMessage({ topic: "video:adjustPlaybackRate", payload });
  });
}

function setupChatRelay(socket) {
  socket.on("chat:message", (payload) => {
    console.log("[Background] Received message from server: ", payload);
    if (!popupPort) return;
    popupPort.postMessage({ topic: "chat:message", payload });
  });

  socket.on("chat:reaction", (payload) => {
    console.log("[Background] Received message from server: ", payload);
    if (!contentPort) return;
    contentPort.postMessage({ topic: "chat:reaction", payload });
  });
}

function setupSocket() {
  const { userId, userName, userAvatar } = storageCache;
  socket = io("http://localhost:3000", {
    auth: {
      userId,
      userName,
      userAvatar,
    },
    transports: ["websocket"],
    autoConnect: false,
    reconnection: false,
  });

  socket.on("connect", () => {
    console.log("[Background] Socket connection established");

    if (popupPort) popupPort.postMessage({ topic: "window:close" });

    // Open side panel on action button click in toolbar
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error(error));

    setupRoomRelay(socket);
    setupVideoRelay(socket);
    setupChatRelay(socket);
  });

  socket.on("connect_error", (err) => {
    console.log("[Background] Socket connection error:", err);
  });

  socket.on("disconnect", () => {
    console.log("[Background] Socket connection closed");

    if (sidepanelPort) sidepanelPort.postMessage({ topic: "window:close" });

    // Do not open side panel on action button click in toolbar
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: false })
      .catch((error) => console.error(error));
  });
}

function setupPorts() {
  chrome.runtime.onConnect.addListener(function (port) {
    if (port.name === "popup-background") {
      popupPort = port;

      // Pass popup message to socket
      popupPort.onMessage.addListener(function (msg) {
        console.log("[Background] Received message from popup: ", msg);

        if (msg.topic === "room:join") {
          handleJoinRoom(msg);
        } else {
          handleIncomingMessage(msg);
        }
      });

      popupPort.onDisconnect.addListener(() => {
        popupPort = undefined;
      });

      console.log("[Background] Connected to popup port");
    } else if (port.name === "sidepanel-background") {
      sidepanelPort = port;

      // Pass popup message to socket
      sidepanelPort.onMessage.addListener(function (msg) {
        console.log("[Background] Received message from popup: ", msg);

        if (msg.topic === "room:leave") {
          handleLeaveRoom(msg);
        } else {
          handleIncomingMessage(msg);
        }
      });

      sidepanelPort.onDisconnect.addListener(() => {
        sidepanelPort = undefined;
      });

      console.log("[Background] Connected to sidepanel port");
    } else if (port.name === "contentscript-background") {
      contentPort = port;

      // Pass content script message to socket
      contentPort.onMessage.addListener((msg) => {
        handleIncomingMessage(msg);
      });

      contentPort.onDisconnect.addListener(() => {
        contentPort = undefined;
      });

      console.log("[Background] Connected to content script port");
    }
  });
}

// =============== INITIALIZATION ===============

chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed");
  const userId = Math.random().toString(36).substring(2, 12);
  const userName = "Salian";
  const seed = Math.floor(Math.random() * 100);
  const userAvatar = "https://api.dicebear.com/8.x/adventurer/svg?seed=" + seed;
  chrome.storage.local.set({ userId, userName, userAvatar }).then(() =>
    console.log("[Background] User data saved: ", {
      userId,
      userName,
      userAvatar,
    }),
  );
});

// By default side panel will not open
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: false })
  .catch((error) => console.error(error));

chrome.action.setBadgeBackgroundColor({ color: "#991B1B" });
chrome.action.setBadgeText({ text: "1" });

setupPorts();

initStorage().then(() => {
  setupSocket();
});
