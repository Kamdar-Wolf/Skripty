// ==UserScript==
// @name         RISCON – JSON (Installer)
// @namespace    installer.riscon
// @version      1
// @description  Loader pro skutečný skript Riscon_JSON.js
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function () {
    const url = "https://raw.githubusercontent.com/Kamdar-Wolf/Skripty/master/Riscon_JSON.js";

    fetch(url)
        .then(r => r.text())
        .then(code => {
            // vytvořit nový <script> element a vložit originální kód
            const s = document.createElement("script");
            s.textContent = code;
            document.body.appendChild(s);
        })
        .catch(err => alert("Chyba načtení: " + err));
})();
