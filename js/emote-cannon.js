function shootEmote(emote) {
	const shadow = document.getElementById('shadow-root-container').shadowRoot;
	const floatingEmote = document.createElement('h2');
	floatingEmote.textContent = emote;
	floatingEmote.style.position = 'fixed';
	floatingEmote.style.top = `${Math.random() * 61 + 10}vh`;
	floatingEmote.style.zIndex = '3000';
	floatingEmote.classList.add('anim');
	shadow.appendChild(floatingEmote);

	setTimeout(() => {
		floatingEmote.remove();
		}, 3000);
}

function handleEmoteClick(event) {
	const emote = event.target.innerHTML;
	shootEmote(emote);
}

function handleFullscreen(event) {
	if (document.fullscreenElement) {
		const emoteTray = document.getElementById('shadow-root-container');
		document.fullscreenElement.appendChild(emoteTray);
	}
}

(async () => {
	const shadowRootContainer = document.createElement('div');
	shadowRootContainer.id = 'shadow-root-container';
	document.body.appendChild(shadowRootContainer);
	const shadowRoot = shadowRootContainer.attachShadow({mode: 'open'});

	const linkElem = document.createElement('link');
	linkElem.setAttribute('rel', 'stylesheet');
	linkElem.setAttribute('href', chrome.runtime.getURL('styles.css'));

	let emoteTray = chrome.runtime.getURL("pages/emote-tray.html");
	const res = await fetch(emoteTray);
	const html = await res.text();
	shadowRoot.innerHTML = html;
	shadowRoot.appendChild(linkElem);
})().then(res => {
		const shadowRoot = document.getElementById('shadow-root-container').shadowRoot;
		const emotes = shadowRoot.querySelectorAll('#emote');
		emotes.forEach(e => {
			e.addEventListener('click', handleEmoteClick);
		})
	});

document.addEventListener('fullscreenchange', handleFullscreen);
