// ==UserScript==
// @name         Nandgame.com Override
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Makes nandgame.com scroll properly in the custom components window.
// @author       speedydelete
// @match        https://nandgame.com/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// ==/UserScript==

(function() {
    const navButtons = document.querySelectorAll('button.nav-link');
    let ccButton;
    for (let i = 0; i < navButtons.length; i++) {
        if (navButtons[i].textContent.includes("Custom Components")) {
            ccButton = navButtons[i];
            break;
        }
    }
    ccButton.addEventListener('click', function(_event) {
        setInterval(function() {
            let elt = document.querySelector('div.card.components-panel.mx-2');
            if (elt != null) {
                elt.style.overflowY = 'scroll';
                elt.style.maxHeight = '150vh';
            } else {
                console.log('script failed, element is null');
            };
        }, 100);
    });
})();
