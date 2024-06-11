const video = document.querySelector("video");
var port = chrome.runtime.connect({ name: "contentscript-background" });

// port.onMessage.addListener((msg) => {
//   console.log("[Videoplayer] Message from remote: ", msg);
// });
//
// port.postMessage("Hello from video player");

if (video) {
  video.addEventListener("play", () => {
    console.log("[Watch party][Content script] Video resume captured");
    port.postMessage({ topic: "video:play" });
  });

  video.addEventListener("pause", () => {
    console.log("[Watch party][Content script] Video pause captured");
    port.postMessage({ topic: "video:pause" });
  });

  video.addEventListener("seeked", () => {
    console.log("[Watch party][Content script] Video seek captured");
    port.postMessage({
      topic: "video:seek",
      timestamp: video.currentTime,
    });
  });

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
} else {
  console.log("[Watch party][Content script] No video found");
}
