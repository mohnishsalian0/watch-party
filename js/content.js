// =============== GLOBAL VARIABLES ===============

let videos = [];
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

function getTabInfo(callback) {
  let queryOptions = { active: true, lastFocusedWindow: true };
  chrome.tabs.query(queryOptions, callback);
}

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

function pauseVideo(msg) {
  videos[msg.payload.videoId].pause();
}

function playVideo(msg) {
  videos[msg.payload.videoId].play();
}

function seekVideo(msg) {
  const { videoId, timestamp } = msg.payload;
  videos[videoId].currentTime = timestamp;
}

function adjustPlaybackRate(msg) {
  const { videoId, rate } = msg.payload;
  videos[videoId].playbackRate = rate;
}

// ==================== HANDLER FUNCTIONS ====================

function handlePortConnect(msg) {
  console.log("[Watch party] Received message from background: ", msg);
  isProgrammaticChange = true;
  if (msg.topic === "chat:reaction") shootEmote(msg.payload.reaction);
  else if (msg.topic === "video:pause") pauseVideo(msg);
  else if (msg.topic === "video:play") playVideo(msg);
  else if (msg.topic === "video:seek") seekVideo(msg);
  else if (msg.topic === "video:adjustPlaybackRate") adjustPlaybackRate(msg);
}

function handlePortDisconnect() {
  port = undefined;
  console.log("[Watch party] Port has disconnected");
}

function handlePlay(event) {
  if (isProgrammaticChange) {
    isProgrammaticChange = false;
    return;
  }
  console.log("[Watch party][Content script] Video resume captured");
  const videoId = event.target.dataset.videoId;
  port?.postMessage({
    topic: "video:play",
    payload: { videoId },
  });
}

function handlePause(event) {
  if (isProgrammaticChange) {
    isProgrammaticChange = false;
    return;
  }
  console.log("[Watch party][Content script] Video pause captured");
  const videoId = event.target.dataset.videoId;
  port?.postMessage({
    topic: "video:pause",
    payload: { videoId },
  });
}

function handleSeek(event) {
  if (isProgrammaticChange) {
    isProgrammaticChange = false;
    return;
  }
  console.log("[Watch party][Content script] Video seek captured");
  const videoId = event.target.dataset.videoId;
  port?.postMessage({
    topic: "video:seek",
    payload: {
      videoId,
      timestamp: videos[videoId].currentTime,
    },
  });
}

function handleEmoteTrayClick(e) {
  const emote = e.target.closest("#emote")?.textContent;
  shootEmote(emote);
  port?.postMessage({
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

function handleMouseOver() {
  clearTimeout(idleTimer);
}

// ==================== MAIN FUNCTIONS ====================

async function renderDom() {
  // Create shadow DOM to place the emote tray
  shadowRootContainer = document.createElement("div");
  shadowRootContainer.id = "shadow-root-container";
  document.body.appendChild(shadowRootContainer);
  const shadowRoot = shadowRootContainer.attachShadow({ mode: "open" });

  // Create stylesheet for the emote tray
  const linkElem = document.createElement("link");
  linkElem.setAttribute("rel", "stylesheet");
  linkElem.setAttribute("href", chrome.runtime.getURL("content.css"));

  // Fetch emote tray and attach to shadow DOM along with stylesheet
  const emoteTrayURL = chrome.runtime.getURL("pages/emote-tray.html");
  const emoteTrayFile = await fetch(emoteTrayURL);
  const emoteTrayHTML = await emoteTrayFile.text();
  shadowRoot.innerHTML = emoteTrayHTML;
  shadowRoot.appendChild(linkElem);
}

function getDOMElements() {
  Array.from(document.querySelectorAll("video")).forEach((video) => {
    video.dataset.videoId = videos.length;
    videos.push(video);
  });
  emoteTray = shadowRootContainer.shadowRoot.querySelector("#emote-tray");
}

function attachVideoListeners(video) {
  video.addEventListener("play", handlePlay);
  video.addEventListener("pause", handlePause);
  video.addEventListener("seeked", handleSeek);
}

function attachDOMListeners() {
  // FIXME:
  videos.forEach((video) => {
    attachVideoListeners(video);
  });
  emoteTray.addEventListener("click", handleEmoteTrayClick);
  document.addEventListener("fullscreenchange", handleFullscreen);
  // makeEmoteTrayDraggable();
  document.addEventListener("mousemove", handleMouseIdle);
  document.addEventListener("mouseover", handleMouseOver);
}

function setupPort() {
  port = chrome.runtime.connect({ name: "contentscript-background" });
  port.onMessage.addListener(handlePortConnect);
  port.onDisconnect.addListener(handlePortDisconnect);
}

function main() {
  renderDom().then(() => {
    getDOMElements();
    setupPort();
    attachDOMListeners();
  });
}

function runCleanup() {
  videos.forEach((video) => {
    video.removeEventListener("play", handlePlay);
    video.removeEventListener("pause", handlePause);
    video.removeEventListener("seeked", handleSeek);
  });
  videos = [];

  document.removeEventListener("fullscreenchange", handleFullscreen);
  document.removeEventListener("mousemove", handleMouseIdle);
  document.removeEventListener("mouseover", handleMouseOver);

  shadowRootContainer.remove();
  shadowRootContainer = undefined;

  port.disconnect();
  port = undefined;
}

function init() {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.tagName === "VIDEO") {
          console.log("video", node);
          node.dataset.videoId = videos.length;
          videos.push(node);
          attachVideoListeners(node);
        } else if (node.querySelectorAll) {
          node.querySelectorAll("video").forEach((video) => {
            console.log("query video", video);
            video.dataset.videoId = videos.length;
            videos.push(video);
            attachVideoListeners(video);
          });
        }
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });

  if (document.readyState !== "complete") {
    document.addEventListener("readystatechange", () => {
      if (document.readyState === "complete") {
        main();
      }
    });
  } else {
    main();
  }
}

// =============== INITIALIZATION ===============

chrome.runtime.onMessage.addListener((msg) => {
  console.log("[Content] Received message from background: ", msg);

  if (msg.socketConnected) {
    console.log("[Content] Socket has connected. Initializing setup...");
    init();
  } else if (msg.socketDisconnected) {
    console.log("[Content] Socket has disconnected. Running cleanup...");
    runCleanup();
  }
});

chrome.runtime.sendMessage({ contentReady: true });
