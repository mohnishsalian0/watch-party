function generateRandomAvatarUrl() {
  const seed = Math.floor(Math.random() * 100);
  return "https://api.dicebear.com/8.x/adventurer/svg?seed=" + seed;
}

var port = chrome.runtime.connect({ name: "popup-background" });

document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(["avatarUrl"]).then((result) => {
    document.getElementById("avatar").src = result.avatarUrl;
    console.log("Avatar url fetched: ", result.avatarUrl);
  });

  chrome.storage.local.get(["name"]).then((result) => {
    const name = result.name || "";
    document.getElementById("name-field").value = name;
    console.log("Name fetched: " + name);
  });

  document.getElementById("get-avatar-btn").addEventListener("click", () => {
    const avatarUrl = generateRandomAvatarUrl();
    const imgElem = document.getElementById("avatar");
    imgElem.setAttribute("src", avatarUrl);
    chrome.storage.local.set({ avatarUrl }).then(() => {
      console.log("Avatar url saved: " + avatarUrl);
    });
  });

  document.getElementById("name-field").addEventListener("input", (e) => {
    chrome.storage.local.set({ name: e.target.value }).then(() => {
      console.log("Name set to: ", e.target.value);
    });
  });

  document.getElementById("start-party-btn").addEventListener("click", (e) => {
    const btn = e.target;
    e.target.disabled = true;
    const spinner = btn.querySelector("object");
    btn.firstChild.textContent = "";
    spinner.classList.remove("absolute");
    spinner.classList.remove("invisible");

    fetch("pages/session.html")
      .then((res) => res.text())
      .then((html) => {
        console.log("Loading empty session");
        setTimeout(() => {
          document.body.innerHTML = html;

          const script = document.createElement("script");
          script.src = "js/session.js";
          document.head.appendChild(script);
        }, 0);
      });
  });

  document.getElementById("message").addEventListener("click", (e) => {
    port.postMessage({ message: "Hello from popup" });
  });
});
