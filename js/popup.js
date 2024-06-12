function generateRandomAvatar() {
  const seed = Math.floor(Math.random() * 100);
  return "https://api.dicebear.com/8.x/adventurer/svg?seed=" + seed;
}

function handleUrlCopy() {
  document.getElementById("copy-link-btn").addEventListener("click", (e) => {
    chrome.storage.sync.get(["roomUrl"]).then((result) => {
      navigator.clipboard
        .writeText(result.roomUrl)
        .then(() => {
          e.target.firstChild.src = "icons/check.svg";
          setTimeout(() => {
            e.target.firstChild.src = "icons/link.svg";
          }, 2000);
          console.log("Text copied to clipboard: " + result.roomUrl);
        })
        .catch((err) => {
          e.target.firstChild.src = "icons/cross.svg";
          setTimeout(() => {
            e.target.firstChild.src = "icons/link.svg";
          }, 2000);
          console.error("Failed to copy text to clipboard: ", err);
        });
    });
  });
}

var port = chrome.runtime.connect({ name: "popup-background" });

port.onMessage.addListener(function (msg) {
  console.log("[Popup] Receive message from background: ", msg);
  if (msg.topic === "room:create") {
    const statusCode = msg.payload.statusCode;
    if (statusCode === 201) {
      console.log("[Popup] Successfully created a room: ", msg.payload.message);
      const { room, roomUrl, hostId, hostName, hostAvatar } = msg.payload;
      chrome.storage.sync
        .set({ room, roomUrl, hostId, hostName, hostAvatar })
        .then(() => {
          console.log("[Popup] Saved room information to session storage");

          fetch("pages/session-empty.html")
            .then((res) => res.text())
            .then((html) => {
              console.log("Loading empty session...");
              document.body.innerHTML = html;
              document.getElementById("link-container").innerHTML = roomUrl;
              handleUrlCopy();
            });
        });
    } else if (statusCode === 400) {
      console.error("[Popup] Failed to create a room: ", msg.payload.message);
    }
  }
});

document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(["userAvatar"]).then((result) => {
    document.getElementById("avatar").src = result.userAvatar;
    console.log("Avatar url fetched: ", result.userAvatar);
  });

  chrome.storage.local.get(["userName"]).then((result) => {
    const name = result.userName || "";
    document.getElementById("name-field").value = name;
    console.log("Name fetched: " + name);
  });

  document.getElementById("get-avatar-btn").addEventListener("click", () => {
    const userAvatar = generateRandomAvatar();
    const imgElem = document.getElementById("avatar");
    imgElem.setAttribute("src", userAvatar);
    chrome.storage.local.set({ userAvatar }).then(() => {
      console.log("Avatar url saved: " + userAvatar);
    });
  });

  document.getElementById("name-field").addEventListener("input", (e) => {
    chrome.storage.local.set({ userName: e.target.value }).then(() => {
      console.log("Name set to: ", e.target.value);
    });
  });

  document.getElementById("start-party-btn").addEventListener("click", (e) => {
    // Disable the button and show the spinner
    const btn = e.target;
    e.target.disabled = true;
    const spinner = btn.querySelector("object");
    btn.firstChild.textContent = "";
    spinner.classList.remove("absolute");
    spinner.classList.remove("invisible");

    // Generate the room url
    const slug = Math.random().toString(36).substring(2, 8);

    // Send the room name to background. The background will send it over to the server to create a room
    port.postMessage({ topic: "room:create", payload: { room: slug } });
    console.log("room create message same");
  });
});
