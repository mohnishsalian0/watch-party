console.log("Remote control loaded");

// chrome.runtime.onConnect.addListener(function (port) {
//   console.assert(port.name === "video");
//   setTimeout(() => {
//     port.postMessage({ pause: true });
//   }, 5000);
//   setTimeout(() => {
//     port.postMessage({ play: true });
//   }, 10000);
//   setTimeout(() => {
//     port.postMessage({ seek: true, jumpTo: 30 });
//   }, 15000);
//   setTimeout(() => {
//     port.postMessage({ playbackRate: true, rate: 1.5 });
//   }, 20000);
// });
