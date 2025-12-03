// ==UserScript==
// @name         Alza: Skrýt všechny ceny
// @namespace    https://github.com/Kamdar-Wolf/Skripty
// @version      1.0
// @description  Skryje / anonymizuje veškeré ceny na alza.cz
// @author       Martin
// @match        https://www.alza.cz/*
// @match        https://alza.cz/*
// @match        https://m.alza.cz/*
// @run-at       document-start
// @supportURL   https://github.com/Kamdar-Wolf/Skripty/issues
// @icon         https://ultreia.cz/wp-content/uploads/2021/01/Alza_01.png
// @icon64       https://ultreia.cz/wp-content/uploads/2021/01/Alza_01.png
// @updateURL    https://raw.githubusercontent.com/Kamdar-Wolf/Skripty/master/Alza-ceny.js
// @downloadURL  https://raw.githubusercontent.com/Kamdar-Wolf/Skripty/master/Alza-ceny.js
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // Regexp na zachycení částek jako "12 999 Kč", "199,90 Kč", "129 EUR" atd.
  const PRICE_REGEX = /(\d[\d\s]{0,8})([.,]\d{1,2})?\s?(Kč|CZK|€|EUR)/g;

  // 1) Styl, který se pokusí typické "price" prvky rovnou zneviditelnit
  function injectCss() {
    const css = `
      [class*="price" i],
      [data-testid*="price" i],
      .price-box,
      .priceDetail,
      .c-price,
      .c2.c3,
      .browsingitem .price,
      .c-price__wrap,
      .c-prices__price,
      .price__price-box-wrapper,
      .price-normal,
      .price-action,
      .price-old,
      .price-new {
        color: transparent !important;
        text-shadow: none !important;
      }

      .component.detailVariants {
        display: none !important;
      }

      .commodityHooks-alz-10 {
        display: none !important;
      }

      .price-detail__row.price-detail__row--with-installments {
        display: none !important;
      }


      /* Někdy jsou ceny v pseudo-elementech, tohle je hrubé ořezání */
      [class*="price" i]::before,
      [class*="price" i]::after {
        content: "" !important;
      }
    `;

    const style = document.createElement('style');
    style.textContent = css;
    document.documentElement.appendChild(style);
  }

  // 2) Prochází textové uzly a maskuje cokoliv, co vypadá jako cena
  function hidePricesInNode(root) {
    if (!root) return;

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
          return PRICE_REGEX.test(node.nodeValue)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        }
      }
    );

    const nodes = [];
    while (walker.nextNode()) {
      nodes.push(walker.currentNode);
    }

    nodes.forEach(node => {
      node.textContent = node.textContent.replace(PRICE_REGEX, '•••');
    });
  }

  function initialPass() {
    hidePricesInNode(document.body || document.documentElement);
  }

  function setupObserver() {
    const observer = new MutationObserver(mutations => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType === Node.TEXT_NODE) {
            hidePricesInNode(node.parentNode || document.body);
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            hidePricesInNode(node);
          }
        }
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  // Spuštění – snažíme se omezit probliknutí cen
  injectCss();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initialPass();
      setupObserver();
    });
  } else {
    initialPass();
    setupObserver();
  }
})();
