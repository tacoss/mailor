const {
  bind, mount, render, listeners, attributes, classes,
} = somedom;

const $ = bind(render,
  attributes({
    class: classes,
  }),
  listeners());

const modes = [600, 480, 320];
const title = document.title;
const mainEl = document.querySelector('#preview');
const toggleEl = document.querySelector('#toggle');

async function main() {
  const req = await fetch('/templates.json');
  const data = await req.json();

  let lastLink;
  let lastOption;
  let currentMode;

  function untoggle(e, node) {
    if (node) {
      node.classList.remove('active');
    }

    if (e) {
      e.target.classList.add('active');

      return e.target;
    }
  }

  function resize() {
    mainEl.style.width = `${modes[currentMode || 0]}px`;
  }

  function pickMe(node) {
    lastOption = node;
  }

  function showMe(e, name) {
    lastLink = untoggle(e, lastLink);
  }

  function showData(e) {
    e.preventDefault();
    lastOption = untoggle(e, lastOption);
    toggleEl.checked = true;
  }

  function showPreview(e) {
    e.preventDefault();
    lastOption = untoggle(e, lastOption);
    toggleEl.checked = false;
  }

  function setMode(e) {
    currentMode = modes.findIndex(x => x === parseInt(e.target.value, 10));
    resize();
  }

  // FIXME: how to render mustache?
  function renderDocument(url) {
    mainEl.onload = () => {
      document.title = `${title} (${mainEl.contentDocument.title})`;
    };

    mainEl.src = `/${location.hash.split('#')[1]}.html`;

    resize();
  }

  mount('#list', ['.pad', [
    ['h3', 'Available templates:'],
    ['ul', data.map(x => ['li', [
      ['a', { href: `#${x}`, onclick: e => showMe(e, x) }, x]
    ]])],
  ]], $);

  mount('#opts', ['ul.pad.flex', [
    ['li', [['a.active', { href: '#', onclick: showPreview, oncreate: pickMe }, 'Preview']]],
    ['li', [['a', { href: '#', onclick: showData }, 'Data']]],
    ['li', [
      ['select', { onchange: setMode }, modes.map(x => ['option', `${x}px`])],
    ]],
  ]], $);

  if (location.hash) {
    renderDocument();
    lastLink = untoggle({
      target: document.querySelector(`a[href*="#${location.hash.split('#')[1]}"]`),
    }, lastLink);
  }

  window.addEventListener('hashchange', e => {
    if (location.hash) {
      renderDocument();
    } else {
      lastLink = untoggle(null, lastLink);
      mainEl.src = 'about:blank';
    }
  }, false);
}

main();
