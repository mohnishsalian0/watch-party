document.getElementById('avatar-btn').addEventListener('click', () => {
	const seed = Math.floor(Math.random() * 100);
	const avatarUrl = 'https://api.dicebear.com/8.x/adventurer/svg?seed=' + seed;
	const imgElem = document.getElementById('avatar');
	imgElem.setAttribute('src', avatarUrl);
});
