function generateRandomAvatarUrl() {
	const seed = Math.floor(Math.random() * 100);
	return 'https://api.dicebear.com/8.x/adventurer/svg?seed=' + seed;
}

chrome.runtime.onInstalled.addListener(() => {
	console.log('Extension installed');
	const avatarUrl = generateRandomAvatarUrl();
	chrome.storage.local.set({ avatarUrl }).then(() => console.log('Avatar url saved:', avatarUrl));
})

document.addEventListener('DOMContentLoaded', () => {
	chrome.storage.local.get(['avatarUrl']).then((result) => {
		document.getElementById('avatar').src = result.avatarUrl;
		console.log("Avatar url fetched: ", result.avatarUrl);
	})

	chrome.storage.local.get(["name"]).then((result) => {
		document.getElementById('name-field').value = result.name;
		console.log("Name fetched: " + result.name);
	})

	document.getElementById('get-avatar-btn').addEventListener('click', () => {
		const avatarUrl = generateRandomAvatarUrl();
		const imgElem = document.getElementById('avatar');
		imgElem.setAttribute('src', avatarUrl);
		chrome.storage.local.set({ avatarUrl }).then(() => {
			console.log("Avatar url saved: " + avatarUrl);
		})
	});

	document.getElementById('name-field').addEventListener('input', (e) => {
		chrome.storage.local.set({ name: e.target.value }).then(() => {
			console.log("Name set to: ", e.target.value);
		});
	})

	document.getElementById('start-watch-party-btn').addEventListener('click', () => {
		fetch('pages/session-empty.html').then((res) => res.text()).then((html) => {
			console.log('Loading empty session');
			document.body.innerHTML = html;

			const script = document.createElement('script');
			script.src = 'js/session-empty.js';
			document.head.appendChild(script);
		})
	})
})
