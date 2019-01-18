const {
  bind, mount, render, listeners, attributes, classes,
} = somedom;

const $ = bind(render,
  attributes({
    class: classes,
  }),
  listeners());

const mainEl = document.querySelector('#main');
const toggleEl = document.querySelector('#toggle');

async function main() {
  const req = await fetch('/templates.json');
  const data = await req.json();

  let lastLink;
  let lastOption;

  function untoggle(e, node) {
    if (node) {
      node.classList.remove('active');
    }

    if (e) {
      e.target.classList.add('active');

      return e.target;
    }
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

  // FIXME: how to render mustache?
  function renderDocument(url) {
    mainEl.src = `/${location.hash.split('#')[1]}.html`;
  }

  mount('#list', ['ul', data.map(x => ['li', [
    ['a', { href: `#${x}`, onclick: e => showMe(e, x) }, x]
  ]])], $);

  mount('#opts', ['ul.flex', [
    ['li', [['a.active', { href: '#', onclick: showPreview, oncreate: pickMe }, 'Preview']]],
    ['li', [['a', { href: '#', onclick: showData }, 'Data']]],
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
