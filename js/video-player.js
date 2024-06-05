const video = document.querySelector('video');
if (video) {
video.addEventListener('play', (e) => console.log('Video resume captured from watch party'));
video.addEventListener('pause', (e) => console.log('Video pause captured from watch party'));
video.addEventListener('seeked', (e) => console.log('Video seek captured from watch party'));
} else {
	console.log('Watch party: No video found');
}
