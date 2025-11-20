// ==UserScript==
// @name         Riscon: rizika
// @namespace    https://github.com/Kamdar-Wolf/Skripty/blob/main/Riscon%3A%20rizika.js
// @version      2.0
// @description  Sjednocený skript: úprava popisků přepínačů + barevné zvýraznění rizik podle hodnot.
// @author       Martin
// @match        https://www.riscon.cz/*
// @icon         https://www.riscon.cz//i/favicon.ico
// @grant        none
// ==/UserScript==

(function() {
'use strict';

// ========== 1) ÚPRAVA POPISKŮ PŘEPÍNAČŮ (čištění angličtiny) ==============

    // Bezpečné escapování textu pro regex
    function escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // Normalizace textu
    function normalizeText(t) {
        return t
            .replace(/\u00A0/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/\s*–\s*/g, ' - ')
            .trim();
    }

    // Slovník náhrad
    const replacements = {
        " - very rare": " (méně než 1 x za rok)",
        " - unusual": " (přibližně 1 x za rok)",
        " - occasional": " (přibližně 1 x ročně)",
        " - frequent": " (týdně)",
        " - very frequent": " (denně)",
        " - continuously": " (několikrát denně)",

        "practically impossible": "nemyslitelné",
        "almost unthinkable": "nepředstavitelné",
        " - possible but far from probable": "",
        "combination of unusual circumstances": "nepravděpodobné, ale z dlouhodobého hlediska možné",
        "low probability": "neobvyklé",
        "very possible": "dá se očekávat",
        "expected": "očekávané",

        "- no temporary disability": "",
        ", up to 3 lost days": "",
        ", serious - more than 3 lost days reversible injury": "",
        ", very serious - accident with irreversible consequences": "",
        " - disaster (fatal accident)": "",
        " - catastrophe (death of more than one person)": ""
    };

    function applyReplacementsToText(text) {
        let t = normalizeText(text);

        for (const [pattern, replacement] of Object.entries(replacements)) {
            const rx = new RegExp(escapeRegex(pattern), 'gi');
            t = t.replace(rx, replacement);
        }

        return t
            .replace(/\s+\)/g, ')')
            .replace(/\(\s+/g, '(')
            .replace(/\s+,/g, ',')
            .replace(/\s{2,}/g, ' ')
            .trim();
    }

    function replaceLabels() {
        const labels = document.querySelectorAll('label');

        labels.forEach(label => {
            if (label.childElementCount === 0) {
                const newText = applyReplacementsToText(label.textContent || '');
                if (newText !== label.textContent) {
                    label.textContent = newText;
                }
            } else {
                label.childNodes.forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE) {
                        const newText = applyReplacementsToText(node.textContent || '');
                        if (newText !== node.textContent) {
                            node.textContent = newText;
                        }
                    }
                });
            }
        });
    }

// ========== 2) BAREVNÉ ZVÝRAZNĚNÍ RIZIK V TABULCE ==========================

    // Pravidla barev
    function getColor(value) {
        if (value <= 70) return "#33B03D";   // 0–70
        if (value <= 200) return "#EBA100";  // 71–200
        return "#D40C0C";                    // 200+
    }

    // Parsování hodnoty z textu
    function parseValue(text) {
        const cleaned = text
            .replace(/\s+/g, ' ')
            .replace(',', '.')
            .replace(/[^\d.\-]/g, '')
            .trim();
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
    }

    // Aplikace barev
    function colorize() {
        const selector = 'td[headers="BALANCED_RISK_LEVEL"], td[headers="RISK_LEVEL"]';
        const cells = document.querySelectorAll(selector);

        cells.forEach(cell => {
            const val = parseValue(cell.innerText || cell.textContent || '');
            if (val === null) return;

            const color = getColor(val);
            cell.style.backgroundColor = color;
            cell.style.color = "#fff";
        });
    }

// =============================== SPOUŠTĚNÍ ================================

    window.addEventListener('load', () => {
        replaceLabels();
        colorize();
    });
    const observer = new MutationObserver(() => {
        replaceLabels();
        colorize();
    });
    observer.observe(document.body, { childList: true, subtree: true });
})();
