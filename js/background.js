importScripts("socket.io.min.js");

// ==================== GLOBAL VARIABLES ===============

let popupPort;
let sidepanelPort;
let contentPort;
let voicePort;

let selfUserData = {};
let session = {};
let notificationCounter = 0;
let isProgrammaticChange = false;

let users = {};
let peerConnectionUnsentMesages = [];
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
}

function logChatMessage(msg) {
  chatLog.push({ ...msg });
  if (chatLog.length > 50) chatLog.shift();
}

function forwardToSocket(msg) {
  if (!socket?.connected) return;

  console.log("[Background] Sending message to server: ", msg);
  socket.emit(msg.topic, msg.payload, (result) => {
    console.log("[Background] Received callback from server: ", result);
    popupPort?.postMessage({ topic: msg.topic, payload: result });
  });
}

function sendUserToPopup() {
  popupPort?.postMessage({
    topic: "user:info",
    payload: { ...selfUserData },
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
    topic: "room:existingUsers",
    payload: { users },
  });
  sidepanelPort.postMessage({
    topic: "chat:log",
    payload: { chatLog },
  });
}

function sendUnsentMessagesToVoice() {
  while (peerConnectionUnsentMesages.length > 0) {
    const msg = peerConnectionUnsentMesages.shift();
    voicePort.postMessage(msg);
  }
}

// ==================== HANDLER FUNCTIONS ===============

function handlePortOnConnect(port) {
  if (port.name === "popup-background") {
    console.log("[Background] Popup port connected");
    popupPort = port;
    sendUserToPopup();
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
    contentPort.onMessage.addListener(handleContentPortMessage);
    contentPort.onDisconnect.addListener(handleContentPortDisconnect);
  } else if (port.name === "voice-background") {
    console.log("[Background] Voice port connected");
    voicePort = port;
    sendUnsentMessagesToVoice();
    voicePort.onMessage.addListener(handleVoicePortMessage);
    voicePort.onDisconnect.addListener(handleVoicePortDisconnect);
  }
}

function handlePopupPortMessage(msg) {
  console.log("[Background] Received message from popup: ", msg);
  if (msg.topic === "user:updateName") {
    handleUserUpdateName(msg);
  } else if (msg.topic === "user:updateAvatar") {
    handleUserUpdateAvatar(msg);
  } else if (msg.topic === "room:join") {
    handleJoinRoom(msg);
  }
}

function handlePopupPortDisconnect() {
  console.log("[Background] Popup port disconnected");
  popupPort.onMessage.removeListener(handlePopupPortMessage);
  popupPort.onDisconnect.removeListener(handlePopupPortDisconnect);
  popupPort = undefined;
}

function handleSidpanelPortMessage(msg) {
  console.log("[Background] Received message from sidepanel: ", msg);
  if (msg.topic === "room:leave") {
    handleLeaveRoom(msg);
  } else {
    if (msg.topic === "chat:message") {
      logChatMessage({ ...msg.payload, ...selfUserData });
    }
    forwardToSocket(msg);
  }
}

function handleSidepanelPortDisconnect() {
  console.log("[Background] Sidepanel port disconnected");
  sidepanelPort.onMessage.removeListener(handleSidpanelPortMessage);
  sidepanelPort.onDisconnect.removeListener(handleSidepanelPortDisconnect);
  sidepanelPort = undefined;
}

function handleContentPortMessage(msg) {
  forwardToSocket(msg);
}

function handleContentPortDisconnect() {
  console.log("[Background] Content port disconnected");
  contentPort?.onMessage.removeListener(handleContentPortMessage);
  contentPort?.onDisconnect.removeListener(handleContentPortDisconnect);
  contentPort = undefined;
}

function handleVoicePortMessage(msg) {
  forwardToSocket(msg);
}

function handleVoicePortDisconnect() {
  console.log("[Background] Voice port disconnected");
  voicePort?.onMessage.removeListener(handleVoicePortMessage);
  voicePort?.onDisconnect.removeListener(handleVoicePortDisconnect);
  voicePort = undefined;
}

function handleUserJoined(payload) {
  console.log("[Background] Received message from server: ", payload);
  const { userId } = payload;
  users[userId] = { ...payload };
  sidepanelPort?.postMessage({ topic: "user:joined", payload });
  voicePort?.postMessage({ topic: "user:joined", payload });
}

function handleUserLeft(payload) {
  console.log("[Background] Received message from server: ", payload);
  delete users[payload.userId];
  sidepanelPort?.postMessage({ topic: "user:left", payload });
  voicePort?.postMessage({ topic: "user:left", payload });
}

function handleHostChange(payload) {
  console.log("[Background] Received message from server: ", payload);
  if (users.hasOwnProperty(payload.hostId)) users[payload.hostId].isHost = true;
  sidepanelPort?.postMessage({ topic: "room:hostChange", payload });
}

function handleExistingRoomUsers(payload) {
  console.log("[Background] Received message from server: ", payload);
  Object.entries(payload.users).forEach(([id, u]) => {
    if (id !== selfUserData.userId) {
      users[id] = { ...u };
    }
  });
}

function handleVideoPlay(payload) {
  console.log("[Background] Received message from server:", payload);
  contentPort?.postMessage({ topic: "video:play", payload });
  sidepanelPort?.postMessage({ topic: "video:play", payload });
}

function handleVideoPause(payload) {
  console.log("[Background] Received message from server:", payload);
  contentPort?.postMessage({ topic: "video:pause", payload });
  sidepanelPort?.postMessage({ topic: "video:pause", payload });
}

function handleVideoSeek(payload) {
  console.log("[Background] Received message from server:", payload);
  contentPort?.postMessage({
    topic: "video:seek",
    payload,
  });
  sidepanelPort?.postMessage({ topic: "video:seek", payload });
}

function handleVideoPlaybackRateChange(payload) {
  console.log("[Background] Received message from server:", payload);
  contentPort?.postMessage({
    topic: "video:adjustPlaybackRate",
    payload,
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

function handleTabRedirect(payload) {
  console.log("[Background] Received message from server: ", payload);
  isProgrammaticChange = true;
  chrome.tabs.update(session.tabId, { url: payload.url });
}

function handleCallOffer(payload) {
  console.log("[Background] Received message from server: ", payload);
  if (voicePort) voicePort.postMessage({ topic: "call:offer", payload });
  else peerConnectionUnsentMesages.push({ topic: "call:offer", payload });
}

function handleCallAnswer(payload) {
  console.log("[Background] Received message from server: ", payload);
  if (voicePort) voicePort.postMessage({ topic: "call:answer", payload });
  else peerConnectionUnsentMesages.push({ topic: "call:answer", payload });
}

function handleCallCandidate(payload) {
  console.log("[Background] Received message from server: ", payload);
  if (voicePort) voicePort.postMessage({ topic: "call:candidate", payload });
  else peerConnectionUnsentMesages.push({ topic: "call:candidate", payload });
}

function handleSocketConnect() {
  console.log("[Background] Socket connection established");

  socket.on("user:joined", handleUserJoined);
  socket.on("user:left", handleUserLeft);
  socket.on("room:existingUsers", handleExistingRoomUsers);
  socket.on("room:hostChange", handleHostChange);

  socket.on("video:play", handleVideoPlay);
  socket.on("video:pause", handleVideoPause);
  socket.on("video:seek", handleVideoSeek);
  socket.on("video:adjustPlaybackRate", handleVideoPlaybackRateChange);

  socket.on("chat:message", handleChatMessage);
  socket.on("chat:reaction", handleChatReaction);

  socket.on("tab:redirect", handleTabRedirect);

  popupPort?.postMessage({
    topic: "room:joined",
    payload: { tabId: session.tabId },
  });

  // Open side panel on action button click in toolbar
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

  chrome.webNavigation.onCommitted.addListener(handleWebNavigation);
  chrome.tabs.onRemoved.addListener(handleTabClose);

  forwardToSocket({
    topic: "tab:url",
    payload: { url: session.tabUrl },
  });

  socketConnectedSignalToContent();
}

function handleSocketConnectError(err) {
  console.log("[Background] Socket connection error:", err);
}

function handleSocketDisconnect() {
  console.log("[Background] Socket connection closed");
  runCleanup();
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

function handleWebNavigation(details) {
  const { frameId, tabId, url } = details;
  if (!isProgrammaticChange && frameId === 0 && tabId === session.tabId) {
    console.log("[Background] Web navigation triggered");
    forwardToSocket({
      topic: "tab:redirect",
      payload: { url },
    });
  }
  isProgrammaticChange = false;
}

function handleTabClose(tabId) {
  if (tabId === session.tabId) {
    console.log("Session tab has closed");
    runCleanup();
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
  chrome.runtime.onConnect.addListener(handlePortOnConnect);
}

function portReadySignalToPopup() {
  chrome.runtime.sendMessage({ backgroundPortReady: true });
}

function socketConnectedSignalToContent() {
  try {
    chrome.tabs.sendMessage(session.tabId, { socketConnected: true });
  } catch (err) {
    // FIXME:
    throw new Error(`[Background] Error pinging content: ${err}`);
  }
}

function socketDisconnectedSignalToContent() {
  chrome.tabs.sendMessage(session.tabId, { socketDisconnected: true });
}

function runCleanup() {
  console.log("Running cleanup...");
  if (socket?.connected) socket.disconnect();
  socket = undefined;

  sidepanelPort?.postMessage({ topic: "window:close" });

  // Do not open side panel on action button click in toolbar
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: false })
    .catch((error) => console.error(error));

  chrome.webNavigation.onCommitted.removeListener(handleWebNavigation);
  chrome.tabs.onRemoved.removeListener(handleTabClose);

  socketDisconnectedSignalToContent();

  users = {};
  chatLog = [];
  resetNotification();
}

function handleOneTimeMessage(request, sender) {
  if (request.popupOpen) {
    console.log("[Background] Popup has loaded");
    initStorage().then(() => {
      setupPorts();
      portReadySignalToPopup();
    });
  } else if (request.contentReady && sender.tab.id === session.tabId) {
    console.log("[Background] Content is ready");
    if (socket?.connected) {
      socketConnectedSignalToContent();
    }
  }
}

// =============== INITIALIZATION ===============

onInstall();

chrome.runtime.onMessage.addListener(handleOneTimeMessage);
