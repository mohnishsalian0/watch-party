// =============== GLOBAL VARIABLES ===============

let avatarInput;
let nameInput;
let nameHelpText;
let roomInput;
let roomHelpText;

let port;

// ==================== UTIL FUNCTIONS ====================

function generateRandomAvatar() {
  const seed = Math.floor(Math.random() * 100);
  return "https://api.dicebear.com/8.x/adventurer/svg?seed=" + seed;
}

function generateRandomRoomName() {
  const room = "r" + Math.random().toString(36).substring(2, 9);
  roomInput.value = room;
}

function validateForm() {
  // Validate user name
  const namePattern = /.+/;
  const isNameValid = namePattern.test(nameInput.value);
  if (!isNameValid) {
    nameHelpText.classList.remove("hidden");
    setTimeout(() => nameHelpText.classList.add("hidden"), 5000);
  }

  // Validate room name
  const roomNamePattern = /^[A-Za-z0-9 ]{8,}$/;
  const isRoomNameValid = roomNamePattern.test(roomInput.value);
  if (!isRoomNameValid) {
    roomHelpText.classList.remove("hidden");
    setTimeout(() => roomHelpText.classList.add("hidden"), 5000);
  }

  if (!isNameValid || !isRoomNameValid) return false;

  return true;
}

function getTabInfo(callback) {
  let queryOptions = { active: true, lastFocusedWindow: true };
  chrome.tabs.query(queryOptions, callback);
}

// ==================== HANDLER FUNCTIONS ====================

function handleGetAvatar() {
  const userAvatar = generateRandomAvatar();
  const imgElem = document.getElementById("avatar");
  imgElem.setAttribute("src", userAvatar);
  port.postMessage({ topic: "user:updateAvatar", payload: { userAvatar } });
}

function handleNameInput(e) {
  port.postMessage({
    topic: "user:updateName",
    payload: { userName: e.target.value },
  });
}

function handleJoinRoomClick(e) {
  const isFormValid = validateForm();
  if (!isFormValid) return;

  // Disable the button and show the spinner
  const btn = e.target;
  const spinner = btn.querySelector("#spinner");
  e.target.disabled = true;
  btn.firstChild.textContent = "";
  spinner.classList.remove("absolute");
  spinner.classList.remove("invisible");

  setTimeout(() => {
    getTabInfo(([tab]) => {
      if (chrome.runtime.lastError)
        console.error(
          "[Background] Chrome tab query error: ",
          chrome.runtime.lastError,
        );
      if (tab) {
        port.postMessage({
          topic: "room:join",
          payload: { room: roomInput.value, tab },
        });
      }
    });

    // Reset button state if action failed
    e.target.disabled = false;
    btn.firstChild.textContent = "Join room";
    spinner.classList.add("absolute");
    spinner.classList.add("invisible");
  }, 1500);
}

// ==================== MAIN FUNCTIONS ====================

function getDOMElements() {
  avatarInput = document.getElementById("avatar");
  nameInput = document.getElementById("name-input");
  nameHelpText = document.getElementById("name-help-text");
  roomInput = document.getElementById("room-input");
  roomHelpText = document.getElementById("room-help-text");
}

function setDOMElements(userInfo) {
  const { userName, userAvatar } = userInfo;
  nameInput.value = userName;
  avatarInput.src = userAvatar;
}

function attachDOMListeners() {
  document
    .getElementById("get-avatar-btn")
    .addEventListener("click", handleGetAvatar);
  nameInput.addEventListener("input", handleNameInput);
  document
    .getElementById("get-room-name-btn")
    .addEventListener("click", generateRandomRoomName);
  document
    .getElementById("join-room-btn")
    .addEventListener("click", handleJoinRoomClick);
}

function setupPort() {
  port = chrome.runtime.connect({ name: "popup-background" });

  port.onMessage.addListener(function (msg) {
    console.log("[Popup] Receive message from background: ", msg);
    if (msg.topic === "user:info") {
      setDOMElements(msg.payload);
    } else if (msg.topic === "room:joined") {
      chrome.sidePanel.open({ tabId: msg.payload.tabId });
      window.close();
    }
  });

  port.onDisconnect.addListener(() => {
    setupPort();
  });
}

// ==================== INITIALIZATION ====================

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    getDOMElements();
    setupPort();
    attachDOMListeners();
  });
} else {
  getDOMElements();
  setupPort();
  attachDOMListeners();
}
