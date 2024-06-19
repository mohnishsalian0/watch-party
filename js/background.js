importScripts("socket.io.min.js");

// ==================== GLOBAL VARIABLES ===============

let popupPort;
let contentPort;
let sidepanelPort;

let selfUserData = {};
let session = {};
let notificationCounter = 0;

let users = {};
let chatLog = [];

let socket;

// ==================== UTIL FUNCTIONS ===============

function addNotification() {
  notificationCounter++;
  chrome.action.setBadgeText({ text: notificationCounter.toString() });
}

function resetNotification() {
  notificationCounter = 0;
  chrome.action.setBadgeText({ text: "" });
}

function cacheRoomName(room) {
  // Save room name to session variable
  session.room = room;

  // Save room name to session storage for sidepanel
  chrome.storage.session
    .set({ room })
    .then(() => console.log("Room name set in session storage: ", room));
}

function cacheTabInfo(tab) {
  // Store tab id & url in session variable
  session.tabId = tab.id;
  session.tabUrl = tab.url;
  console.log(session);
}

function logChatMessage(msg) {
  chatLog.push({ ...msg });
  if (chatLog.length > 50) chatLog.shift();
}

function forwardToSocket(msg) {
  if (!socket?.connected) return;

  console.log("[Background] Sending message to server");
  socket.emit(msg.topic, msg.payload, (result) => {
    console.log("[Background] Received callback from server: ", result);
    popupPort.postMessage({ topic: msg.topic, payload: result });
  });
}

function sendUserAndRoomToSidepanel() {
  sidepanelPort?.postMessage({
    topic: "setup:data",
    payload: { ...selfUserData, ...session },
  });
}

function sendUsersAndChatToSidepanel() {
  // Send users list and chat log
  sidepanelPort.postMessage({
    topic: "room:users",
    payload: { users },
  });
  sidepanelPort.postMessage({
    topic: "chat:log",
    payload: { chatLog },
  });
}

function injectContent() {
  // chrome.scripting
  //   .executeScript({
  //     target: { tabId: session.tabId },
  //     files: ["js/content.js"],
  //   })
  //   .then(() => console.log("registration complete"))
  //   .catch((err) => console.warn("unexpected error", err));
  chrome.scripting.getRegisteredContentScripts().then((scripts) => {
    console.log("registered content scripts", scripts);
    if (scripts.length > 0) {
      chrome.scripting
        .unregisterContentScripts({ ids: ["session-script"] })
        .then(() => {
          chrome.scripting
            .registerContentScripts([
              {
                id: "session-script",
                js: ["js/content.js"],
                persistAcrossSessions: false,
                matches: ["*://*.google.co.in/*"],
                runAt: "document_start",
              },
            ])
            .then(() => console.log("registration complete"))
            .catch((err) => console.warn("unexpected error", err));
          console.log("un-registration complete");
        });
    } else {
      chrome.scripting
        .registerContentScripts([
          {
            id: "session-script",
            js: ["js/content.js"],
            persistAcrossSessions: false,
            matches: ["*://*.google.co.in/*"],
            runAt: "document_start",
            world: "MAIN",
          },
        ])
        .then(() => console.log("registration complete"))
        .catch((err) => console.warn("unexpected error", err));
    }
  });
}

function showEmoteTray() {
  contentPort?.postMessage({
    topic: "window:open",
  });
}

function hideEmoteTray() {
  contentPort?.postMessage({
    topic: "window:close",
  });
}

// ==================== HANDLER FUNCTIONS ===============

function handleSidepanelPortDisconnect() {
  sidepanelPort = undefined;
  console.log("[Background] Sidepanel port disconnected");
}

function handleContentPortMessage(msg) {
  forwardToSocket(msg);
}

function handleContentPortDisconnect() {
  contentPort = undefined;
  console.log("[Background] Content port disconnected");
}

function handlePopupPortMessage(msg) {
  console.log("[Background] Received message from popup: ", msg);
  if (msg.topic === "user:updateName") {
    handleUserUpdateName(msg);
  } else if (msg.topic === "user:updateAvatar") {
    handleUserUpdateAvatar(msg);
  } else if (msg.topic === "room:join") {
    handleJoinRoom(msg);
  } else {
    forwardToSocket(msg);
  }
}

function handlePopupPortDisconnect() {
  console.log("[Background] Popup port disconnected");
  popupPort = undefined;
}

function handleSidpanelPortMessage(msg) {
  console.log("[Background] Received message from sidepanel: ", msg);
  if (msg.topic === "room:leave") {
    handleLeaveRoom(msg);
  } else {
    if (msg.topic === "chat:message") {
      const { userId, userName, userAvatar } = selfUserData;
      logChatMessage({ ...msg.payload, userId, userName, userAvatar });
    }
    forwardToSocket(msg);
  }
}

function handleUserJoined(payload) {
  console.log("[Background] Received message from server: ", payload);
  const { userId } = payload;
  users[userId] = { ...payload };
  sidepanelPort?.postMessage({ topic: "user:joined", payload });
}

function handleUserLeft(payload) {
  console.log("[Background] Received message from server: ", payload);
  delete users[payload.userId];
  sidepanelPort?.postMessage({ topic: "user:left", payload });
}

function handleHostChange(payload) {
  console.log("[Background] Received message from server: ", payload);
  if (users.hasOwnProperty(payload.hostId)) users[payload.hostId].isHost = true;
  sidepanelPort?.postMessage({ topic: "room:hostChange", payload });
}

function handleRoomUsers(payload) {
  console.log("[Background] Received message from server: ", payload);
  Object.entries(payload.users).forEach(([id, u]) => {
    if (id !== selfUserData.userId) {
      users[id] = { ...u };
    }
  });
}

function handleVideoPlay(payload) {
  console.log("[Background] Received message from server:", payload);
  contentPort?.postMessage({ topic: "video:play" });
  sidepanelPort?.postMessage({ topic: "video:play", payload });
}

function handleVideoPause(payload) {
  console.log("[Background] Received message from server:", payload);
  contentPort?.postMessage({ topic: "video:pause" });
  sidepanelPort?.postMessage({ topic: "video:pause", payload });
}

function handleVideoSeek(payload) {
  console.log("[Background] Received message from server:", payload);
  contentPort?.postMessage({
    topic: "video:seek",
    timestamp: payload.timestamp,
  });
  sidepanelPort?.postMessage({ topic: "video:seek", payload });
}

function handleVideoPlaybackRateChange(payload) {
  console.log("[Background] Received message from server:", payload);
  contentPort?.postMessage({
    topic: "video:adjustPlaybackRate",
    rate: payload.rate,
  });
  sidepanelPort?.postMessage({ topic: "video:adjustPlaybackRate", payload });
}

function handleChatMessage(payload) {
  console.log("[Background] Received message from server: ", payload);
  logChatMessage(payload);
  if (!sidepanelPort) {
    addNotification();
  } else {
    sidepanelPort?.postMessage({ topic: "chat:message", payload });
  }
}

function handleChatReaction(payload) {
  console.log("[Background] Received message from server: ", payload);
  contentPort?.postMessage({ topic: "chat:reaction", payload });
}

function handleSocketConnect() {
  console.log("[Background] Socket connection established");

  socket.on("user:joined", handleUserJoined);
  socket.on("user:left", handleUserLeft);
  socket.on("room:users", handleRoomUsers);
  socket.on("room:hostChange", handleHostChange);

  socket.on("video:play", handleVideoPlay);
  socket.on("video:pause", handleVideoPause);
  socket.on("video:seek", handleVideoSeek);
  socket.on("video:adjustPlaybackRate", handleVideoPlaybackRateChange);

  socket.on("chat:message", handleChatMessage);
  socket.on("chat:reaction", handleChatReaction);

  popupPort?.postMessage({
    topic: "room:joined",
    payload: { tabId: session.tabId },
  });

  // Open side panel on action button click in toolbar
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

  chrome.tabs.onUpdated.addListener(handleTabUpdate);
  chrome.tabs.onRemoved.addListener(handleTabClose);

  // injectContent();
}

function handleSocketConnectError(err) {
  console.log("[Background] Socket connection error:", err);
}

function handleSocketDisconnect() {
  console.log("[Background] Socket connection closed");

  socket = undefined;

  sidepanelPort?.postMessage({ topic: "window:close" });

  // Do not open side panel on action button click in toolbar
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: false })
    .catch((error) => console.error(error));

  contentPort?.postMessage({ topic: "window:close" });

  chrome.tabs.onUpdated.removeListener(handleTabUpdate);
  chrome.tabs.onRemoved.removeListener(handleTabClose);

  hideEmoteTray();

  users = {};
  chatLog = [];
}

function handleUserUpdateAvatar(msg) {
  selfUserData.userAvatar = msg.payload.userAvatar;
  chrome.storage.local.set({ userAvatar: msg.payload.userAvatar }).then(() => {
    console.log("Avatar saved to local storage: " + msg.payload.userAvatar);
  });
}

function handleUserUpdateName(msg) {
  selfUserData.userName = msg.payload.userName;
  chrome.storage.local.set({ userName: msg.payload.userName }).then(() => {
    console.log("Name saved to local storage: ", msg.payload.userName);
  });
}

function handleJoinRoom(msg) {
  cacheRoomName(msg.payload.room);
  cacheTabInfo(msg.payload.tab);
  initSocket();
}

function handleLeaveRoom() {
  socket.disconnect();
}

function handleTabUpdate(tabId, changeInfo) {
  if (tabId === session.tabId) {
    console.log("Session tab has changed: ", changeInfo);
    injectContent();
  }
}

function handleTabClose(tabId) {
  if (tabId === session.tabId) {
    console.log("Session tab has closed");
    socket.disconnect();
  }
}

// ==================== MAIN FUNCTIONS ===============

function onInstall() {
  // By default side panel will not open
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: false })
    .catch((error) => console.error(error));

  // Set badge color to red
  chrome.action.setBadgeBackgroundColor({ color: "#991B1B" });
}

async function initStorage() {
  try {
    const items = await chrome.storage.local.get();
    Object.assign(selfUserData, items);
    console.log("[Background] Fetched from local storage: ", items);
  } catch (e) {
    console.error("[Background] Failed to fetch data from local storage: ", e);
  }

  const missingUserData = {};
  if (selfUserData.userId === undefined) {
    const userId = "u" + Math.random().toString(36).substring(2, 12);
    selfUserData.userId = userId;
    missingUserData.userId = userId;
  }
  if (selfUserData.userName === undefined) {
    const userName = "";
    selfUserData.userName = userName;
    missingUserData.userName = userName;
  }
  if (selfUserData.userAvatar === undefined) {
    const seed = Math.floor(Math.random() * 100);
    const userAvatar =
      "https://api.dicebear.com/8.x/adventurer/svg?seed=" + seed;
    selfUserData.userAvatar = userAvatar;
    missingUserData.userAvatar = userAvatar;
  }
  if (Object.keys(missingUserData).length > 0) {
    chrome.storage.local
      .set(missingUserData)
      .then(() =>
        console.log(
          "[Background] Loaded missing user data into local storage: ",
          missingUserData,
        ),
      );
  }

  chrome.storage.onChanged.addListener((changes, namespace) => {
    console.log("[Background] Local storage data has changed: ", changes);
    for (let [key, { _, newValue }] of Object.entries(changes)) {
      if (namespace === "local") selfUserData[key] = newValue;
    }
  });
}

function initSocket() {
  const { userId, userName, userAvatar } = selfUserData;

  socket = io("http://localhost:3000", {
    transports: ["websocket"],
    auth: {
      userId,
      userName,
      userAvatar,
      room: session.room,
    },
    reconnection: false,
  });

  socket.on("connect", handleSocketConnect);
  socket.on("connect_error", handleSocketConnectError);
  socket.on("disconnect", handleSocketDisconnect);
}

function setupPorts() {
  chrome.runtime.onConnect.addListener(function (port) {
    if (port.name === "popup-background") {
      console.log("[Background] Popup port connected");

      // FIXME: Remove this code after testing
      injectContent();

      popupPort = port;
      popupPort.postMessage({
        topic: "user:info",
        payload: { ...selfUserData },
      });
      popupPort.onMessage.addListener(handlePopupPortMessage);
      popupPort.onDisconnect.addListener(handlePopupPortDisconnect);
    } else if (port.name === "sidepanel-background") {
      console.log("[Background] Sidepanel port connected");
      sidepanelPort = port;
      resetNotification();
      sendUserAndRoomToSidepanel();
      sendUsersAndChatToSidepanel();
      sidepanelPort.onMessage.addListener(handleSidpanelPortMessage);
      sidepanelPort.onDisconnect.addListener(handleSidepanelPortDisconnect);
    } else if (port.name === "contentscript-background") {
      console.log("[Background] Content port connected");
      contentPort = port;
      if (socket?.connected) showEmoteTray();
      contentPort.onMessage.addListener(handleContentPortMessage);
      contentPort.onDisconnect.addListener(handleContentPortDisconnect);
    }
  });
}

// =============== INITIALIZATION ===============

onInstall();

initStorage().then(() => {
  setupPorts();
});
