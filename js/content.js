// =============== GLOBAL VARIABLES ===============

// FIXME:
console.log("Content script registered");

let video;
let shadowRootContainer;
let emoteTray;

let port;

let isProgrammaticChange = false;

let idleTimer = null;
let idleState = false;
let dx = 0,
  dy = 0,
  x = 0,
  y = 0,
  initialX = 0,
  initialY = 0;

// ==================== UTIL FUNCTIONS ====================

function shootEmote(emote) {
  const shadow = document.getElementById("shadow-root-container").shadowRoot;
  const floatingEmote = document.createElement("h2");
  floatingEmote.textContent = emote;
  floatingEmote.style.position = "fixed";
  floatingEmote.style.top = `${Math.random() * 61 + 10}vh`;
  floatingEmote.style.zIndex = "3000";
  floatingEmote.classList.add("emote");
  shadow.appendChild(floatingEmote);

  setTimeout(() => {
    floatingEmote.remove();
  }, 3000);
}

function closeDragElement() {
  document.onmousemove = null;
  document.onmouseup = null;
  initialX = initialY = x = y = dx = dy = 0;
}

function elementDrag(e) {
  e.preventDefault();
  dx = x - e.clientX;
  dy = y - e.clientY;
  x = e.clientX;
  y = e.clientY;

  // set the element's new position:
  if (Math.abs(x - initialX) > 10 || Math.abs(y - initialY) > 10) {
    const rightBound =
      document.documentElement.clientWidth - emoteTray.offsetWidth;
    const bottomBound =
      document.documentElement.clientHeight - emoteTray.offsetHeight;
    const top = Math.min(bottomBound, Math.max(0, emoteTray.offsetTop - dy));
    const left = Math.min(rightBound, Math.max(0, emoteTray.offsetLeft - dx));
    emoteTray.style.top = top + "px";
    emoteTray.style.left = left + "px";
  }
}

function dragMouseDown(e) {
  e.preventDefault();
  initialX = x = e.clientX;
  initialY = y = e.clientY;
  document.onmousemove = elementDrag;
  document.onmouseup = closeDragElement;
}

function makeEmoteTrayDraggable() {
  emoteTray.onmousedown = dragMouseDown;
}

function isMouseOverTray(e) {
  const { left, right, top, bottom } = emoteTray.getBoundingClientRect();
  const x = e.clientX;
  const y = e.clientY;
  return left <= x && x <= right && top <= y && y <= bottom;
}

// ==================== HANDLER FUNCTIONS ====================

function handlePlay() {
  if (isProgrammaticChange) {
    isProgrammaticChange = false;
    return;
  }
  console.log("[Watch party][Content script] Video resume captured");
  port.postMessage({
    topic: "video:play",
    payload: {},
  });
}

function handlePause() {
  if (isProgrammaticChange) {
    isProgrammaticChange = false;
    return;
  }
  console.log("[Watch party][Content script] Video pause captured");
  port.postMessage({
    topic: "video:pause",
    payload: {},
  });
}

function handleSeek() {
  if (isProgrammaticChange) {
    isProgrammaticChange = false;
    return;
  }
  console.log("[Watch party][Content script] Video seek captured");
  port.postMessage({
    topic: "video:seek",
    payload: { timestamp: video.currentTime },
  });
}

function handleEmoteClick(e) {
  const emote = e.target.textContent;
  shootEmote(emote);
  port.postMessage({
    topic: "chat:reaction",
    payload: { reaction: emote },
  });
}

function handleFullscreen() {
  if (document.fullscreenElement) {
    document.fullscreenElement.appendChild(shadowRootContainer);
  }
}

function handleMouseIdle(e) {
  clearTimeout(idleTimer);
  if (idleState) emoteTray.classList.remove("hidden");
  idleState = false;
  idleTimer = setTimeout(() => {
    if (!isMouseOverTray(e)) {
      emoteTray.classList.add("hidden");
      idleState = true;
    }
  }, 3000);
}

// ==================== MAIN FUNCTIONS ====================

async function renderOverlay() {
  // Create shadow DOM to place the emote tray
  shadowRootContainer = document.createElement("div");
  shadowRootContainer.id = "shadow-root-container";
  // shadowRootContainer.style.display = "none";
  document.body.appendChild(shadowRootContainer);
  const shadowRoot = shadowRootContainer.attachShadow({ mode: "open" });

  // Create stylesheet for the emote tray
  const linkElem = document.createElement("link");
  linkElem.setAttribute("rel", "stylesheet");
  linkElem.setAttribute("href", chrome.runtime.getURL("content.css"));

  // Fetch emote tray and attach to shadow DOM along with stylesheet
  const emoteTrayFile = chrome.runtime.getURL("pages/emote-tray.html");
  const res = await fetch(emoteTrayFile);
  const emoteTrayHtml = await res.text();
  shadowRoot.innerHTML = emoteTrayHtml;
  shadowRoot.appendChild(linkElem);
}

function getDOMElements() {
  video = document.querySelector("video");
  emoteTray = shadowRootContainer.shadowRoot.querySelector("#emote-tray");
}

function attachDOMListeners() {
  if (video) {
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("seeked", handleSeek);
  }
  emoteTray.querySelectorAll("#emote").forEach((emoteBtn) => {
    emoteBtn.addEventListener("click", handleEmoteClick);
  });
  document.addEventListener("fullscreenchange", handleFullscreen);
  makeEmoteTrayDraggable();
  document.addEventListener("mousemove", handleMouseIdle);
  document.addEventListener("mouseover", () => clearTimeout(idleTimer));
}

function setupPort() {
  port = chrome.runtime.connect({ name: "contentscript-background" });
  port.onMessage.addListener((msg) => {
    console.log("[Watch party] Received message from background: ", msg);
    isProgrammaticChange = true;
    if (msg.topic === "chat:reaction") shootEmote(msg.payload.reaction);
    else if (msg.topic === "video:pause") video.pause();
    else if (msg.topic === "video:play") video.play();
    else if (msg.topic === "video:seek") video.currentTime = msg.timestamp;
    else if (msg.topic === "video:adjustPlaybackRate")
      video.playbackRate = msg.rate;
    else if (msg.topic === "window:open")
      shadowRootContainer.style.display = "block";
    else if (msg.topic === "window:close")
      shadowRootContainer.style.display = "none";
  });
}

// =============== INITIALIZATION ===============

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    renderOverlay().then(() => {
      getDOMElements();
      setupPort();
      attachDOMListeners();
    });
  });
} else {
  renderOverlay().then(() => {
    getDOMElements();
    setupPort();
    attachDOMListeners();
  });
}
