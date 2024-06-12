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

function handleEmoteClick(shadowRoot, port) {
  // Shoot emote and forward it to background via port
  const emotes = shadowRoot.querySelectorAll("#emote");
  emotes.forEach((e) => {
    e.addEventListener("click", (e) => {
      const emote = e.target.innerHTML;
      shootEmote(emote);
      port.postMessage({
        topic: "chat:reaction",
        payload: { room: "room1", reaction: emote },
      });
    });
  });
}

function dragElement(elem) {
  var pos1 = 0,
    pos2 = 0,
    pos3 = 0,
    pos4 = 0;
  elem.onmousedown = dragMouseDown;

  function dragMouseDown(e) {
    e = e;
    e.preventDefault();
    // get the mouse cursor position at startup:
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    // call a function whenever the cursor moves:
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e = e;
    e.preventDefault();
    // calculate the new cursor position:
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    // set the element's new position:
    const rightBound = document.documentElement.clientWidth - elem.offsetWidth;
    const bottomBound =
      document.documentElement.clientHeight - elem.offsetHeight;
    const top = Math.min(bottomBound, Math.max(0, elem.offsetTop - pos2));
    const left = Math.min(rightBound, Math.max(0, elem.offsetLeft - pos1));
    elem.style.top = top + "px";
    elem.style.left = left + "px";
  }

  function closeDragElement() {
    // stop moving when mouse button is released:
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

async function renderEmoteTray() {
  // Create shadow DOM to place the emote tray
  const shadowRootContainer = document.createElement("div");
  shadowRootContainer.id = "shadow-root-container";
  document.body.appendChild(shadowRootContainer);
  const shadowRoot = shadowRootContainer.attachShadow({ mode: "open" });

  // Create stylesheet for the emote tray
  const linkElem = document.createElement("link");
  linkElem.setAttribute("rel", "stylesheet");
  linkElem.setAttribute("href", chrome.runtime.getURL("styles.css"));

  // Fetch emote tray and attach to shadow DOM along with stylesheet
  let emoteTray = chrome.runtime.getURL("pages/emote-tray.html");
  const res = await fetch(emoteTray);
  const html = await res.text();
  shadowRoot.innerHTML = html;
  shadowRoot.appendChild(linkElem);

  // Make emote tray draggable
  const emoteTrayElem = shadowRoot.getElementById("emote-tray");
  dragElement(emoteTrayElem);

  return shadowRoot;
}

function handleFullscreen() {
  if (document.fullscreenElement) {
    const shadowRootContainer = document.getElementById(
      "shadow-root-container",
    );
    document.fullscreenElement.appendChild(shadowRootContainer);
  }
}

function receiveEmoteReaction(port) {
  port.onMessage.addListener((msg) => {
    console.log(
      "[Watch party][Content script] Received message from background: ",
      msg,
    );
    if (msg.topic === "chat:reaction") shootEmote(msg.payload.reaction);
  });
}

function getVideoPlayer() {
  const video = document.querySelector("video");
  if (video) console.log("[Watch party][Content script] Video player found!");
  else console.log("[Watch party][Content script] No video found");
  return video;
}

function forwardVideoEvent(event, port, message, consoleMessage) {
  video.addEventListener(event, () => {
    console.log("[Watch party][Content script]" + consoleMessage);
    if (roomUrl) {
      port.postMessage(message);
    } else {
      console.error(
        "[Watch party][Content script] Room url not found in session storage",
      );
    }
  });
}

function forwardVideoEvents(video, port) {
  forwardVideoEvent(
    "play",
    port,
    {
      topic: "video:play",
      payload: {
        room: "room1",
      },
    },
    "Video resume captured",
  );

  forwardVideoEvent(
    "pause",
    port,
    {
      topic: "video:pause",
      payload: {
        room: "room1",
      },
    },
    "Video pause captured",
  );

  forwardVideoEvent(
    "seeked",
    port,
    {
      topic: "video:seek",
      payload: {
        room: "room1",
        timestamp: video.currentTime,
      },
    },
    "Video seek captured",
  );
}

function receiveVideoEvents(video, port) {
  port.onMessage.addListener((msg) => {
    console.log(
      "[Watch party][Content script] Received message from background: ",
      msg,
    );
    if (msg.topic === "video:pause") video.pause();
    else if (msg.topic === "video:play") video.play();
    else if (msg.topic === "video:seek") video.currentTime = msg.timestamp;
    else if (msg.topic === "video:adjustPlaybackRate")
      video.playbackRate = msg.rate;
  });
}

var port = chrome.runtime.connect({ name: "contentscript-background" });

var roomUrl;
chrome.storage.sync.get(["roomUrl"]).then((result) => {
  console.log(
    "[Watch party][Content script] Fetched room url from session storage: ",
    result,
  );
  roomUrl = result.roomUrl;
});

const video = getVideoPlayer();
if (video) {
  forwardVideoEvents(video, port);
  receiveVideoEvents(video, port);
}

renderEmoteTray().then((shadowRoot) => {
  handleEmoteClick(shadowRoot, port);
  document.addEventListener("fullscreenchange", handleFullscreen);
  receiveEmoteReaction(port);
});
