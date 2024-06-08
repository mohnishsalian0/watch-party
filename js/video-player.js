const video = document.querySelector('video');
if (video) {
video.addEventListener('play', (e) => console.log('Video resume captured from watch party'));
video.addEventListener('pause', (e) => console.log('Video pause captured from watch party'));
video.addEventListener('seeked', (e) => console.log('Video seek captured from watch party'));
} else {
	console.log('Watch party: No video found');
}

// var port = chrome.runtime.connect({name: "video"});
// port.onMessage.addListener((msg) => {
// 	console.log('Video player received: ', msg);
// 	if (msg.pause === true) video.pause();
// 	else if (msg.play === true) video.play();
// 	else if (msg.seek === true) video.currentTime = msg.jumpTo;
// 	else if (msg.playbackRate === true) video.playbackRate = msg.rate;
// });
