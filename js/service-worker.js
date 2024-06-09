importScripts("remote-control.js");

function generateRandomAvatarUrl() {
  const seed = Math.floor(Math.random() * 100);
  return "https://api.dicebear.com/8.x/adventurer/svg?seed=" + seed;
}

chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed");
  const avatarUrl = generateRandomAvatarUrl();
  chrome.storage.local
    .set({ avatarUrl })
    .then(() => console.log("Avatar url saved:", avatarUrl));
});
