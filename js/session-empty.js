console.log('Session loaded');
const slug = Math.random().toString(36).substring(2, 8);
const sessionUrl = 'https://www.watchparty.com/' + slug;
chrome.storage.session.set({ sessionUrl }).then(() => console.log("Saved session url to session storage"))
document.getElementById('link-container').innerHTML = sessionUrl;

document.getElementById('copy-link-btn').addEventListener('click', (e) => {
    chrome.storage.session.get(["sessionUrl"]).then((result) => {
        navigator.clipboard.writeText(result.sessionUrl)
            .then(() => {
                e.target.firstChild.src = 'icons/check.svg';
                setTimeout(() => {
                    e.target.firstChild.src = 'icons/link.svg';
                }, 2000);
                console.log('Text copied to clipboard: ' + result.sessionUrl)
            })
            .catch((err) => {
                e.target.firstChild.src = 'icons/cross.svg';
                setTimeout(() => {
                    e.target.firstChild.src = 'icons/link.svg';
                }, 2000);
                console.error('Failed to copy text to clipboard: ', err)
            });
    })
})
