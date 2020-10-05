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

  let data;
  try {
    data = await resp.json();
  } catch (e) {
    alert(`Failed to resolve ${url} (${e.message})`);
    data = {};
  }

  return data;
}

async function post(url, data) {
  const resp = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(data),
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return resp.text();
}

async function main() {
  const data = await get('/templates.json');
  const vars = await get('/variables.json');
  const defs = await get('/defaults.json');

  let target;
  let curVars;
  let lastOption;
  let currentMode;

  function resize() {
    mainEl.style.width = `${modes[currentMode || 0]}px`;
  }

  function getId() {
    return location.hash.split('#')[1];
  }

  function getLocals() {
    console.log(defs);
    return curVars.reduce((prev, cur) => {
      prev[cur.key] = cur.value || defs[cur.key] || `[${cur.key.replace(/[a-z](?=[A-Z])/g, '$&_').toUpperCase()}]`;
      return prev;
    }, {});
  }

  function getQueryParams() {
    return encodeURIComponent(JSON.stringify(getLocals()));
  }

  function renderDocument() {
    mainEl.onload = () => {
      document.title = `${title} (${titleCase(getId())} - ${mainEl.contentDocument.title || 'Untitled'})`;
    };

    mainEl.src = `/generated_templates/${getId()}.html?${getQueryParams()}`;

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
    !state.items.length && ['p', 'No variables found'],
    ['ul', state.items.map(item => ['li', [
      ['label', [
        item.key,
        ['span.flex', [
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
        ]]
      ]],
    ]])],
  ]];

  const editor = view($view, $state, $actions);
  const $$ = editor('#input', $);
  const refs = {};

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
    const key = location.hash.split('#')[1] || Object.keys(vars)[0];

    if (!location.hash) {
      location.hash = key;
    }

    curVars = input(vars[key]);
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

  function showMe(e) {
    const name = e.target.options[e.target.options.selectedIndex].value;

    location.hash = name;
    curVars = input(vars[name]);
    edit();
  }

  function showData(e) {
    e.preventDefault();
    getRef('resize').disabled = true;
    lastOption = untoggle(e, lastOption);
    toggleEl.checked = true;
  }

  function showPreview(e) {
    e.preventDefault();
    getRef('resize').disabled = false;
    lastOption = untoggle(e, lastOption);
    toggleEl.checked = false;
  }

  function setMode(e) {
    currentMode = modes.findIndex(x => x === parseInt(e.target.value, 10));
    resize();
  }

  function setRef(name) {
    return e => {
      refs[name] = e;
    };
  }

  function getRef(name) {
    return refs[name];
  }

  function sendMail() {
    post(`/send_template/${getId()}.html?${target},${getQueryParams()}`).then(alert);
  }

  function setMail(e) {
    target = e.target.value;
    getRef('email').disabled = !target;
  }

  mount('#list', ['.pad.flex.center', [
    ['h1', [['a', { href: '/' }, 'Mailor']]],
    ['label', [
      'Available templates:',
      ['select.group', { onchange: showMe }, data.map(x => ['option', { value: x, selected: location.hash === `#${x}` }, [titleCase(x)]])],
    ]],
  ]], $);

  const OptionList = ['ul.pad.flex.center', [
    ['li.flex.group', [
      ['input', { type: 'email', required: true, oninput: setMail }],
      ['button', { disabled: true, onclick: sendMail, oncreate: setRef('email') }, 'Send'],
    ]],
    ['li.flex.group', [
      ['a.active', { href: '#', onclick: showPreview, oncreate: pickMe }, 'Preview'],
      ['a', { href: '#', onclick: showData }, 'Input'],
    ]],
    ['li.group', [
      ['select', { onchange: setMode, oncreate: setRef('resize') }, modes.map(x => ['option', `${x}px`])],
    ]],
  ]];

  mount('#opts', ['form', { onsubmit: e => e.preventDefault() }, [OptionList]], $);

  if (location.hash) {
    renderDocument();
  }

  addEventListener('hashchange', () => {
    if (location.hash) {
      renderDocument();
    } else {
      mainEl.src = 'about:blank';
    }
  }, false);
}

main();
