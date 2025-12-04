// ==UserScript==
// @name         SubscribeStar: Řazení příspěvků (nejnovější / nejstarší)
// @namespace    https://github.com/Kamdar-Wolf
// @version      1.3.2
// @description  Přidá přepínač řazení (nejnovější ↔ nejstarší) na feed a stránky tvůrců na SubscribeStar.adult a umí na požádání natáhnout všechny stránky.
// @author       Martin
// @updateURL    https://github.com/Kamdar-Wolf/Skripty/raw/refs/heads/SubscribeStar/Zpusob_serazeni.user.js
// @downloadURL  https://github.com/Kamdar-Wolf/Skripty/raw/refs/heads/SubscribeStar/Zpusob_serazeni.user.js
// @match        https://subscribestar.adult/feed*
// @match        https://subscribestar.adult/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    let currentOrder = loadOrder();  // 'desc' (nejnovější) nebo 'asc' (nejstarší)
    let postsObserver = null;
    let autoLoading = false;
    let cancelLoading = false;

    function loadOrder() {
        try {
            const v = localStorage.getItem('ssPostSortOrder');
            return (v === 'asc' || v === 'desc') ? v : 'desc';
        } catch (e) {
            return 'desc';
        }
    }

    function saveOrder(order) {
        currentOrder = order;
        try {
            localStorage.setItem('ssPostSortOrder', order);
        } catch (e) {
            // ignoruj chybu storage
        }
    }

    function injectStyles() {
        if (document.getElementById('ss-sort-controls-style')) return;

        const style = document.createElement('style');
        style.id = 'ss-sort-controls-style';
        style.textContent = `
            #ss-sort-controls {
                margin: 0 0 8px 0;
                display: flex;
                justify-content: flex-end;
                gap: 4px;
                font-size: 13px;
                align-items: center;
                flex-wrap: wrap;
            }
            #ss-sort-controls .ss-sort-label {
                opacity: 0.8;
            }
            #ss-sort-controls .ss-sort-btn {
                padding: 2px 6px;
                border-radius: 3px;
                border: 1px solid rgba(255,255,255,0.25);
                background: rgba(0,0,0,0.35);
                color: inherit;
                cursor: pointer;
                font-size: 12px;
            }
            html:not(.dark) #ss-sort-controls .ss-sort-btn {
                background: #f5f5f5;
                border-color: #ccc;
            }
            #ss-sort-controls .ss-sort-btn.is-active {
                font-weight: 600;
                box-shadow: 0 0 0 1px #f48;
            }
            #ss-sort-controls .ss-sort-status {
                margin-left: 8px;
                font-size: 11px;
                opacity: 0.7;
            }
        `;
        document.head.appendChild(style);
    }

    function findPostsContainer() {
        // Hlavní feed container s infinite scroll
        return document.querySelector('.posts[data-view="app#infinite_scroll"]');
    }

    function createSortControls(container) {
        if (!container) return;
        if (document.getElementById('ss-sort-controls')) return;

        const controls = document.createElement('div');
        controls.id = 'ss-sort-controls';
        controls.innerHTML = `
            <span class="ss-sort-label">Řazení:</span>
            <button type="button" class="ss-sort-btn" data-order="desc">
                Nejnovější → Nejstarší
            </button>
            <button type="button" class="ss-sort-btn" data-order="asc">
                Nejstarší → Nejnovější
            </button>
            <button type="button" class="ss-sort-btn" data-action="load-all">
                Načíst vše
            </button>
            <span id="ss-sort-status" class="ss-sort-status"></span>
        `;

        const parent = container.parentNode;
        if (parent) {
            parent.insertBefore(controls, container);
        }

        controls.addEventListener('click', function (e) {
            const btn = e.target.closest('.ss-sort-btn');
            if (!btn) return;

            const action = btn.dataset.action;
            if (action === 'load-all') {
                // Start/stop načítání všech stránek
                if (!autoLoading) {
                    cancelLoading = false;
                    loadAllPages(container);
                } else {
                    cancelLoading = true;
                }
                return;
            }

            const order = btn.dataset.order;
            if (order !== 'asc' && order !== 'desc') return;

            saveOrder(order);
            updateButtonsUI(order);
            sortPosts(container, order);
        });

        updateButtonsUI(currentOrder);
    }

    function updateButtonsUI(order) {
        const buttons = document.querySelectorAll('#ss-sort-controls .ss-sort-btn[data-order]');
        buttons.forEach(btn => {
            if (btn.dataset.order === order) {
                btn.classList.add('is-active');
            } else {
                btn.classList.remove('is-active');
            }
        });
    }

    function updateLoadAllButton(isRunning) {
        const btn = document.querySelector('#ss-sort-controls .ss-sort-btn[data-action="load-all"]');
        if (!btn) return;
        if (isRunning) {
            btn.textContent = 'Zastavit načítání';
            btn.classList.add('is-active');
        } else {
            btn.textContent = 'Načíst vše';
            btn.classList.remove('is-active');
        }
    }

    function setStatus(text) {
        const statusEl = document.getElementById('ss-sort-status');
        if (!statusEl) return;
        statusEl.textContent = text || '';
    }

    function sortPosts(container, order) {
        if (!container) return;

        const posts = Array.from(container.querySelectorAll('.post[data-id]'));
        if (posts.length < 2) return;

        posts.sort((a, b) => {
            const idA = parseInt(a.dataset.id || '0', 10);
            const idB = parseInt(b.dataset.id || '0', 10);
            if (isNaN(idA) || isNaN(idB)) return 0;

            return order === 'asc'
                ? idA - idB   // nejstarší → nejnovější
                : idB - idA;  // nejnovější → nejstarší
        });

        const more = container.querySelector('[data-role="infinite_scroll-next_page"]');
        const refNode = more || null;

        posts.forEach(post => {
            container.insertBefore(post, refNode);
        });
    }

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    async function loadAllPages(container) {
        if (!container) return;
        if (autoLoading) return;

        autoLoading = true;
        updateLoadAllButton(true);
        try {
            setStatus('Načítám všechny příspěvky...');

            let lastCount = container.querySelectorAll('.post[data-id]').length;
            let stagnant = 0;
            let iterations = 0;
            const maxIterations = 200; // bezpečný strop, aby se to nezacyklilo

            while (!cancelLoading && iterations < maxIterations) {
                const more = container.querySelector('.posts-more[data-role="infinite_scroll-next_page"]');
                if (!more) break; // žádný "další" už není → jsme na konci

                // Simulace kliknutí na "Zobrazit další příspěvky"
                more.click();

                // Počkáme, než se nové posty načtou a vloží do DOMu
                await sleep(1500);

                const newCount = container.querySelectorAll('.post[data-id]').length;
                if (newCount <= lastCount) {
                    stagnant++;
                    if (stagnant >= 3) {
                        // 3 cykly po sobě bez nárůstu → asi fakt konec
                        break;
                    }
                } else {
                    stagnant = 0;
                    lastCount = newCount;
                }

                iterations++;
            }
        } finally {
            if (cancelLoading) {
                setStatus('Načítání přerušeno.');
                await sleep(1000);
            }
            setStatus('');
            autoLoading = false;
            cancelLoading = false;
            updateLoadAllButton(false);
        }
    }

    function attachPostsObserver(container) {
        if (!container) return;

        if (postsObserver) {
            postsObserver.disconnect();
        }

        postsObserver = new MutationObserver(mutations => {
            let addedPost = false;
            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (node.nodeType === 1 && node.classList.contains('post')) {
                        addedPost = true;
                        break;
                    }
                }
                if (addedPost) break;
            }

            if (addedPost) {
                // Odpoj observer, přerovnej, znovu připoj – zabráníme smyčkám
                postsObserver.disconnect();
                sortPosts(container, currentOrder);
                postsObserver.observe(container, { childList: true });
            }
        });

        postsObserver.observe(container, { childList: true });
    }

    function setup(container) {
        injectStyles();
        createSortControls(container);
        attachPostsObserver(container);
        // ŽÁDNÉ automatické loadAllPages při načtení stránky.
        // Kompletní natažení všech příspěvků proběhne jen po ručním stisku "Načíst vše".
    }

    function init() {
        const container = findPostsContainer();
        if (container) {
            setup(container);
            return;
        }

        const docObserver = new MutationObserver((mutations, obs) => {
            const c = findPostsContainer();
            if (c) {
                obs.disconnect();
                setup(c);
            }
        });

        docObserver.observe(document.documentElement || document.body, {
            childList: true,
            subtree: true
        });
    }

    init();
})();
