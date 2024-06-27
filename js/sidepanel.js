// ==================== GLOBAL VARIABLES ===============

let selfUserData = {};
let session = {};
let userJoinedSound;
let userLeftSound;

let emptyState;
let mainState;
let usersPanel;
let userElem;
let chatPanel;
let msgElem;
let eventElem;
let chatInput;

let port;

// ==================== UTIL FUNCTIONS ===============

function toggleRoomViewState(state) {
  if (state === "main") {
    mainState.style.display = "flex";
    emptyState.style.display = "none";
  } else if (state === "empty") {
    emptyState.style.display = "block";
    mainState.style.display = "none";
  }
}

function loadUser(userData) {
  const newUserElem = userElem.cloneNode(true);
  newUserElem.style.display = "block";
  newUserElem.id = userData.userId;

  // Set avatar
  const avatar = newUserElem.querySelector("#avatar");
  avatar.src = userData.userAvatar;

  // Set name
  const name = newUserElem.querySelector("#name");
  name.innerHTML = userData.userName;
  name.title = userData.userName;

  // Set host crown
  const hostCrown = newUserElem.querySelector("#host-crown");
  if (userData.isHost) hostCrown.style.display = "inline";

  // Set mute
  const muteIcon = newUserElem.querySelector("#mute-icon");
  if (userData.isMuted) {
    avatar.style.filter = "grayscale(100%)";
    muteIcon.style.display = "block";
  }
  usersPanel.appendChild(newUserElem);
}

function populateUsersList(existingUsers) {
  Object.entries(existingUsers).forEach(([id, u]) => {
    if (id !== selfUserData.userId) {
      loadUser(u);
    }
  });
}

function removeUser(userData) {
  const userElem = usersPanel.querySelector(`#${userData.userId}`);
  userElem?.remove();
  if (usersPanel.childElementCount === 0) toggleRoomViewState("empty");
  console.log("[Sidepanel] Removed user from room: ", userData);
}

function loadChat(msg) {
  let newChatElem;
  const { messageId, messageType, messageContent, userAvatar } = msg;

  if (messageType === "comment") newChatElem = msgElem.cloneNode(true);
  else newChatElem = eventElem.cloneNode(true);

  newChatElem.style.display = "flex";

  newChatElem.id = messageId;

  const image = newChatElem.querySelector("#image");
  if (messageType === "comment") image.src = userAvatar;
  else image.src = `${messageType}.svg`;

  newChatElem.querySelector("#message").textContent = messageContent;
  chatPanel.appendChild(newChatElem);

  if (chatPanel.childElementCount > 50) {
    chatPanel.removeChild(chatPanel.firstElementChild);
  }
}

function sendComment() {
  const messageId = Math.random().toString(36).substring(2, 12);
  const messageType = "comment";
  const messageContent = chatInput.value;

  const message = {
    messageId,
    messageType,
    messageContent,
    ...selfUserData,
  };
  loadChat(message);
  chatInput.value = "";

  port.postMessage({
    topic: "chat:message",
    payload: { messageId, messageType, messageContent },
  });
}

// ==================== HANDLER FUNCTIONS ===============

function handlePortMessage(msg) {
  console.log("[Sidepanel] Received message from background: ", msg);
  if (msg.topic === "setup:data") {
    handleSetupData(msg);
  } else if (msg.topic === "window:close") {
    window.close();
  } else if (msg.topic === "user:joined") {
    handleUserJoined(msg);
  } else if (msg.topic === "room:existingUsers") {
    handleExistingUsersList(msg);
  } else if (msg.topic == "user:left") {
    handleUserLeft(msg);
  } else if (msg.topic == "room:hostChange") {
    handleHostChange(msg);
  } else if (msg.topic === "chat:message") {
    handleIncomingMessage(msg);
  } else if (msg.topic === "chat:log") {
    handleChatLog(msg);
  }
}

function handlePortDisconnect() {
  port.onMessage.removeListener(handlePortMessage);
  port.onDisconnect.removeListener(handlePortDisconnect);
  port = undefined;
}

function handleCopyRoomName(e) {
  const room = session.room;
  navigator.clipboard
    .writeText(room)
    .then(() => {
      e.target.firstChild.src = "icons/check.svg";
      setTimeout(() => {
        e.target.firstChild.src = "icons/link.svg";
      }, 1500);
      console.log("Text copied to clipboard: " + room);
    })
    .catch((err) => {
      e.target.firstChild.src = "icons/cross.svg";
      setTimeout(() => {
        e.target.firstChild.src = "icons/link.svg";
      }, 1500);
      console.error("Failed to copy text to clipboard: ", err);
    });
}

function handleChatLog(msg) {
  msg.payload.chatLog.forEach((cl) => {
    loadChat(cl);
  });
}

function handleSend() {
  if (chatInput.value) sendComment();
}

function handleIncomingMessage(msg) {
  loadChat(msg.payload);
}

function handleLeaveRoom(e) {
  // Disable the button and show the spinner
  const btn = e.target;
  const spinner = btn.querySelector("#spinner");
  e.target.disabled = true;
  const exitIcon = btn.querySelector("#exit-icon");
  exitIcon.remove();
  spinner.classList.remove("absolute");
  spinner.classList.remove("invisible");

  setTimeout(() => {
    port.postMessage({ topic: "room:leave" });
    e.target.disabled = false;
    spinner.classList.add("absolute");
    spinner.classList.add("invisible");
    btn.appendChild(exitIcon);
  }, 2000);
}

function handleUserLeft(msg) {
  removeUser(msg.payload);
  userLeftSound.play();
}

function handleHostChange(msg) {
  const userElem = usersPanel.querySelector(`#${msg.payload.hostId}`);
  if (!userElem) return;
  const hostCrown = userElem.querySelector("#host-crown");
  hostCrown.style.display = "inline";
}

function handleEnterPress(e) {
  if (e.key === "Enter" && e.target.value) {
    e.preventDefault();
    sendComment();
  }
}

function handleSetupData(msg) {
  const { userId, userName, userAvatar, room } = msg.payload;
  Object.assign(selfUserData, { userId, userName, userAvatar });
  session.room = room;
  setDOMElements();
  userJoinedSound = new Audio("sounds/user-joined.mp3");
  userLeftSound = new Audio("sounds/user-left.mp3");
}

function handleUserJoined(msg) {
  loadUser(msg.payload);
  toggleRoomViewState("main");
  userJoinedSound.play();
}

function handleExistingUsersList(msg) {
  populateUsersList(msg.payload.users);
  if (usersPanel.childElementCount > 0) {
    toggleRoomViewState("main");
  }
}

// ==================== MAIN FUNCTIONS ===============

function setDOMElements() {
  document.getElementById("room-name").textContent = session.room;
  document.getElementById("link-container").textContent = session.room;

  document.getElementById("self-user-avatar").src = selfUserData.userAvatar;
  document.getElementById("self-user-name").textContent = selfUserData.userName;
}

function getDOMElements() {
  emptyState = document.getElementById("empty-state");

  mainState = document.getElementById("main-state");

  usersPanel = document.getElementById("users-panel");
  userElem = document.getElementById("user");
  userElem.remove();

  chatPanel = document.getElementById("chat-panel");
  msgElem = chatPanel.querySelector("#chat-message");
  eventElem = chatPanel.querySelector("#chat-event");
  msgElem.remove();
  eventElem.remove();

  chatInput = document.getElementById("chat-input");
}

function attachDOMListeners() {
  document.querySelectorAll("#copy-room-name-btn").forEach((b) => {
    b.addEventListener("click", handleCopyRoomName);
  });
  document
    .getElementById("leave-btn")
    .addEventListener("click", handleLeaveRoom);
  document
    .getElementById("chat-input")
    .addEventListener("keyup", handleEnterPress);
  document.getElementById("send-btn").addEventListener("click", handleSend);
}

function setupPort() {
  port = chrome.runtime.connect({ name: "sidepanel-background" });
  port.onMessage.addListener(handlePortMessage);
  port.onDisconnect.addListener(handlePortDisconnect);
}

function main() {
  getDOMElements();
  setupPort();
  attachDOMListeners();
}

// ==================== INITIALIZATION ===============

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", main);
} else {
  main();
}
