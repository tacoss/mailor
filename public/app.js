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

    e.target.classList.add('active');

    return e.target;
  }

  function pickMe(node) {
    lastOption = node;
  }

  function showMe(e) {
    e.preventDefault();
    lastLink = untoggle(e, lastLink);
    mainEl.src = e.target.href;
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

  mount('#list', ['ul', data.map(x => ['li', [
    ['a', { href: `/${x}.html`, onclick: showMe }, x]
  ]])], $);

  mount('#opts', ['ul.flex', [
    ['li', [['a.active', { href: '#', onclick: showPreview, oncreate: pickMe }, 'Preview']]],
    ['li', [['a', { href: '#', onclick: showData }, 'Data']]],
  ]], $);
}

main();
