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

function handleEmoteClick(event) {
  const emote = event.target.innerHTML;
  shootEmote(emote);
}

function handleFullscreen(_) {
  if (document.fullscreenElement) {
    const shadowRootContainer = document.getElementById(
      "shadow-root-container",
    );
    document.fullscreenElement.appendChild(shadowRootContainer);
  }
}

(async () => {
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
})().then((_) => {
  // Make emote tray draggable
  const shadowRoot = document.getElementById(
    "shadow-root-container",
  ).shadowRoot;
  const emoteTray = shadowRoot.getElementById("emote-tray");
  dragElement(emoteTray);

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
      const rightBound =
        document.documentElement.clientWidth - elem.offsetWidth;
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

  // Add click listeners to each emote
  const emotes = shadowRoot.querySelectorAll("#emote");
  emotes.forEach((e) => {
    e.addEventListener("click", handleEmoteClick);
  });
});

document.addEventListener("fullscreenchange", handleFullscreen);
