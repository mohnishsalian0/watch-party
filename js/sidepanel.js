const users = [
  {
    userId: 1,
    userName: "Angad",
    userAvatar: "https://api.dicebear.com/8.x/adventurer/svg?seed=15",
    isMuted: true,
  },
  {
    userId: 2,
    userName: "Jarvan",
    userAvatar: "https://api.dicebear.com/8.x/adventurer/svg?seed=20",
    isMuted: false,
  },
  {
    userId: 3,
    userName: "Alice",
    userAvatar: "https://api.dicebear.com/8.x/adventurer/svg?seed=13",
    isMuted: true,
  },
  {
    userId: 3,
    userName: "Edward",
    userAvatar: "https://api.dicebear.com/8.x/adventurer/svg?seed=22",
    isMuted: false,
  },
  {
    userId: 4,
    userName: "Trisha",
    userAvatar: "https://api.dicebear.com/8.x/adventurer/svg?seed=12",
    isMuted: true,
  },
  {
    userId: 5,
    userName: "Eragon",
    userAvatar: "https://api.dicebear.com/8.x/adventurer/svg?seed=14",
    isMuted: false,
  },
];

const chatActivities = [
  {
    id: 1,
    type: "chat-message",
    userId: 2,
    userName: "Jarvan",
    userAvatar: "https://api.dicebear.com/8.x/adventurer/svg?seed=20",
    eventIcon: "icons/pause.svg",
    message: "This better work! Im not doing this again otherwise",
  },
  {
    id: 2,
    type: "chat-event",
    userId: 1,
    userName: "Angad",
    userAvatar: "https://api.dicebear.com/8.x/adventurer/svg?seed=15",
    eventIcon: "icons/pause.svg",
    message:
      "<strong class='font-medium font-white'>Angad</strong> has paused the video",
  },
  {
    id: 3,
    type: "chat-event",
    userId: 3,
    userName: "Alice",
    userAvatar: "https://api.dicebear.com/8.x/adventurer/svg?seed=13",
    eventIcon: "icons/seek-forward.svg",
    message:
      "<strong class='font-medium font-white'>Alice</strong> has seeked forward",
  },
  {
    id: 4,
    type: "chat-message",
    userId: 4,
    userName: "Trisha",
    userAvatar: "https://api.dicebear.com/8.x/adventurer/svg?seed=12",
    eventIcon: "",
    message:
      "Finally, the time has come. I don’t regret calling in sick for this 😜. Can’t wait to see the fate of YOU-KNOW-WHO. Btw how do i get the audio working?",
  },
];

async function loadRoomData() {
  const room = await chrome.storage.session.get(["room"]);
  document.getElementById("link-container").textContent = room.room;
}

function handleUrlCopy(e) {
  const room = document.getElementById("link-container").textContent;
  navigator.clipboard
    .writeText(room)
    .then(() => {
      e.target.firstChild.src = "icons/check.svg";
      setTimeout(() => {
        e.target.firstChild.src = "icons/link.svg";
      }, 2000);
      console.log("Text copied to clipboard: " + room);
    })
    .catch((err) => {
      e.target.firstChild.src = "icons/cross.svg";
      setTimeout(() => {
        e.target.firstChild.src = "icons/link.svg";
      }, 2000);
      console.error("Failed to copy text to clipboard: ", err);
    });
}

function handleLeaveRoom(e) {
  // Disable the button and show the spinner
  const btn = e.target;
  const spinner = btn.querySelector("object");
  e.target.disabled = true;
  const svg = btn.firstChild;
  svg.remove();
  spinner.classList.remove("absolute");
  spinner.classList.remove("invisible");

  setTimeout(() => {
    port.postMessage({ topic: "room:leave" });
    e.target.disabled = false;
    spinner.classList.add("absolute");
    spinner.classList.add("invisible");
    btn.appendChild(svg);
  }, 2000);
}

function handleUserJoined(msg) {
  console.log("jlsajdfljsldfjlsadjflaj");
  emptyState.classList.add("hidden");
  mainState.classList.remove("hidden");
  mainState.classList.add("flex");
}

function loadUser(userData, userElem, usersPanel) {
  const newUserElem = userElem.cloneNode(true);
  newUserElem.style.display = "block";
  newUserElem.id = userData.userId;
  const avatar = newUserElem.querySelector("#avatar");
  avatar.src = userData.userAvatar;
  const name = newUserElem.querySelector("#name");
  name.innerHTML = userData.userName;
  name.title = userData.userName;
  const muteIcon = newUserElem.querySelector("#mute-icon");
  if (userData.isMuted) {
    avatar.style.filter = "grayscale(100%)";
    muteIcon.style.display = "block";
  }
  usersPanel.appendChild(newUserElem);
}

function loadChat(chatData, msgElem, eventElem, chatPanel) {
  let newChatElem;
  if (chatData.type === "chat-message") newChatElem = msgElem.cloneNode(true);
  else if (chatData.type === "chat-event")
    newChatElem = eventElem.cloneNode(true);
  newChatElem.style.display = "flex";
  newChatElem.id = chatData.id;
  const image = newChatElem.querySelector("#image");
  if (chatData.type === "chat-message") image.src = chatData.userAvatar;
  if (chatData.type === "chat-event") image.src = chatData.eventIcon;
  newChatElem.querySelector("#message").innerHTML = chatData.message;
  chatPanel.appendChild(newChatElem);
}

// =============== INITIALIZATION ===============

let emptyState;
let mainState;

let usersPanel;
let userElem;

let chatPanel;
let msgElem;
let eventElem;

let port = chrome.runtime.connect({ name: "sidepanel-background" });

port.onMessage.addListener(function (msg) {
  console.log("[Sidepanel] Receive message from background: ", msg);
  if (msg.topic === "window:close") {
    window.close();
  } else if (msg.topic === "user:joined") {
    handleUserJoined(msg);
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  emptyState = document.getElementById("empty-state");

  await loadRoomData();

  document
    .getElementById("copy-link-btn")
    .addEventListener("click", handleUrlCopy);

  const leaveBtns = document.querySelectorAll("#leave-btn");
  leaveBtns.forEach((b) => {
    b.addEventListener("click", handleLeaveRoom);
  });

  mainState = document.getElementById("main-state");

  usersPanel = document.getElementById("users-panel");
  userElem = document.getElementById("user");

  users.map((user) => loadUser(user, userElem, usersPanel));

  chatPanel = document.getElementById("chat-panel");
  msgElem = chatPanel.querySelector("#chat-message");
  eventElem = chatPanel.querySelector("#chat-event");
  msgElem.remove();
  eventElem.remove();

  const chatInput = document.querySelector("#chat-input");

  chatActivities.map((activity) =>
    loadChat(activity, msgElem, eventElem, chatPanel),
  );

  chatInput.addEventListener("keyup", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      chatData = {
        id: 5,
        type: "chat-message",
        userId: 123,
        userName: "Mohnish",
        userAvatar: "https://api.dicebear.com/8.x/adventurer/svg?seed=22",
        eventIcon: "",
        message: e.target.value,
      };
      loadChat(chatData, msgElem, eventElem, chatPanel);
      e.target.value = "";

      chatActivities.push(chatData);
      if (chatActivities.length > 4) {
        chatPanel.removeChild(chatPanel.firstElementChild);
        chatActivities.shift();
      }
    }
  });

  // const micBtn = document.getElementById("mic-btn");
  //
  // const speakerBtn = document.getElementById("speaker-btn");
  //
  // const settingsBtn = document.getElementById("settings-btn");
  //
  // const leaveBtn = document.getElementById("leave-btn");
});
