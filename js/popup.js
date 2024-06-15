function loadUserData() {
  chrome.storage.local.get(["userName", "userAvatar"]).then((result) => {
    document.getElementById("name-input").value = result.userName;
    document.getElementById("avatar").src = result.userAvatar;
    console.log("User data fetched: ", result);
  });
}

function generateRandomAvatar() {
  const seed = Math.floor(Math.random() * 100);
  return "https://api.dicebear.com/8.x/adventurer/svg?seed=" + seed;
}

function handleGetAvatar() {
  const userAvatar = generateRandomAvatar();
  const imgElem = document.getElementById("avatar");
  imgElem.setAttribute("src", userAvatar);
  chrome.storage.local.set({ userAvatar }).then(() => {
    console.log("Avatar url saved: " + userAvatar);
  });
}

function handleNameInput(e) {
  chrome.storage.local.set({ userName: e.target.value }).then(() => {
    console.log("Name set to: ", e.target.value);
  });
}

function handleCreateRoom(e) {
  // Disable the button and show the spinner
  const btn = e.target;
  const spinner = btn.querySelector("object");
  e.target.disabled = true;
  btn.firstChild.textContent = "";
  spinner.classList.remove("absolute");
  spinner.classList.remove("invisible");

  const room = Math.random().toString(36).substring(2, 8);

  setTimeout(() => {
    port.postMessage({ topic: "room:join", payload: { room } });
    e.target.disabled = false;
    btn.firstChild.textContent = "Start a watch party";
    spinner.classList.add("absolute");
    spinner.classList.add("invisible");
  }, 2000);
}

function handleJoinRoom(e) {
  // Disable the button and show the spinner
  const btn = e.target;
  const spinner = btn.querySelector("object");
  e.target.disabled = true;
  btn.firstChild.textContent = "";
  spinner.classList.remove("absolute");
  spinner.classList.remove("invisible");

  const urlInput = document.getElementById("url-input");

  setTimeout(() => {
    port.postMessage({ topic: "room:join", payload: { room: urlInput.value } });
    e.target.disabled = false;
    btn.firstChild.textContent = "Join room";
    spinner.classList.add("absolute");
    spinner.classList.add("invisible");
  }, 2000);
}

// =============== INITIALIZATION ===============

let port = chrome.runtime.connect({ name: "popup-background" });

port.onMessage.addListener(function (msg) {
  console.log("[Popup] Receive message from background: ", msg);
  if (msg.topic === "window:close") {
    window.close();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  loadUserData();

  document
    .getElementById("get-avatar-btn")
    .addEventListener("click", handleGetAvatar);

  document
    .getElementById("name-input")
    .addEventListener("input", handleNameInput);

  document
    .getElementById("start-party-btn")
    .addEventListener("click", handleCreateRoom);

  document
    .getElementById("join-room-btn")
    .addEventListener("click", handleJoinRoom);
});
