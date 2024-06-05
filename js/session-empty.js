console.log('Session loaded');
const slug = Math.random().toString(36).substring(2, 12);
const sessionUrl = 'https://www.watchparty.com/' + slug;
chrome.storage.session.set({ sessionUrl }).then(() => console.log("Saved session url to session storage"))
document.getElementById('link-container').innerHTML = sessionUrl;

document.getElementById('copy-link-btn').addEventListener('click', (e) => {
	chrome.storage.session.get(["sessionUrl"]).then((result) => {
    navigator.clipboard.writeText(result.sessionUrl)
        .then(() => console.log('Text copied to clipboard: ' + result.sessionUrl))
        .catch(err => console.error('Failed to copy text to clipboard: ', err));
	})
})
