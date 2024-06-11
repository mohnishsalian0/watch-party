chrome.runtime.onConnect.addListener(function (port) {
  if (port.name === "contentscript-background") {
    port.postMessage("Hello from remote control");
    port.onMessage.addListener((msg) => {
      console.log("[Remote] Message received from video player: ", msg);
    });
    // setTimeout(() => {
    //   port.postMessage({ pause: true });
    // }, 5000);
    // setTimeout(() => {
    //   port.postMessage({ play: true });
    // }, 10000);
    // setTimeout(() => {
    //   port.postMessage({ seek: true, jumpTo: 30 });
    // }, 15000);
    // setTimeout(() => {
    //   port.postMessage({ playbackRate: true, rate: 1.5 });
    // }, 20000);
  }
});
