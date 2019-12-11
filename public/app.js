/* global somedom */
const {
  bind, view, mount, render, listeners, attributes, classes,
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

function titleCase(text) {
  return text[0].toUpperCase() + text.substr(1).replace(/-([a-z])/g, (_, k) => ` ${k.toUpperCase()}`);
}

async function get(url) {
  const resp = await fetch(url);
  const data = await resp.json();

  return data;
}

async function main() {
  const data = await get('/templates.json');
  const vars = await get('/variables.json');

  let curVars;
  let lastLink;
  let lastOption;
  let currentMode;

  function resize() {
    mainEl.style.width = `${modes[currentMode || 0]}px`;
  }

  function renderDocument() {
    const id = location.hash.split('#')[1];

    mainEl.onload = () => {
      document.title = `${title} (${titleCase(id)} - ${mainEl.contentDocument.title})`;
    };

    const locals = curVars.reduce((prev, cur) => {
      prev[cur.key] = cur.value || `[${cur.key.replace(/[a-z](?=[A-Z])/g, '$&_').toUpperCase()}]`;
      return prev;
    }, {});

    const q = encodeURIComponent(JSON.stringify(locals));

    mainEl.src = `/generated_templates/${id}.html?${q}`;

    resize();
  }

  function setValue(key, value) {
    curVars.forEach(sub => {
      if (sub.key === key) {
        sub.value = value;
        renderDocument();
      }
    });
  }

  const $actions = {
    update: value => () => ({
      items: value.slice(),
    }),
  };

  const $state = {
    items: [],
  };

  const $view = state => ['div', [
    ['ul', state.items.map(item => ['li', [
      ['label', [
        ['span', item.key],
        ['textarea', {
          name: item.key,
          rows: 2,
          oncreate(e) {
            item.ref = e;
          },
          onchange(e) {
            setValue(item.key, e.target.value);
          },
        }],
        ['button', {
          onclick() {
            item.ref.value = '';
            setValue(item.key, '');
          },
        }, '×'],
      ]],
    ]])],
  ]];

  const editor = view($view, $state, $actions);
  const tag = bind(render, listeners());

  const $$ = editor('#input', tag);

  function edit() {
    $$.update(curVars);
  }

  function input(args) {
    const defaults = args.reduce((prev, cur) => {
      prev.push({ key: cur.replace(/\{+|\}+/g, '') });
      return prev;
    }, []);

    return defaults;
  }

  if (Object.keys(vars).length) {
    curVars = input(vars[Object.keys(vars)[0]]);
    edit();
  }

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
    curVars = input(vars[name]);
    lastLink = untoggle(e, lastLink);
    edit();
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

  mount('#list', ['.pad', [
    ['h3', 'Available templates:'],
    ['ul', data.map(x => ['li', [
      ['a', { href: `#${x}`, onclick: e => showMe(e, x) }, titleCase(x)],
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

  window.addEventListener('hashchange', () => {
    if (location.hash) {
      renderDocument();
    } else {
      lastLink = untoggle(null, lastLink);
      mainEl.src = 'about:blank';
    }
  }, false);
}

main();
