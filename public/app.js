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
    alert(`Failed to resolve ${url} (${e.message})`); // eslint-disable-line
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

  function getLocals(source) {
    return source.reduce((prev, cur) => {
      const fixedKey = cur.key
        .replace(/^[#^]/, '')
        .replace(/[a-z](?=[A-Z])/g, '$&_');

      if (cur.data) {
        prev[fixedKey] = cur.value ? getLocals(cur.data) : null;
      } else if (typeof cur.bool !== 'undefined') {
        prev[fixedKey] = cur.value;
      } else if (cur.value !== false) {
        prev[fixedKey] = cur.value || defs[fixedKey] || `[${fixedKey.toUpperCase()}]`;
      }
      return prev;
    }, {});
  }

  function getQueryParams() {
    return encodeURIComponent(JSON.stringify(getLocals(curVars)));
  }

  function renderDocument() {
    mainEl.onload = () => {
      document.title = `${title} (${titleCase(getId())} - ${mainEl.contentDocument.title || 'Untitled'})`;
    };

    mainEl.src = `/generated_templates/${getId()}.html?${getQueryParams()}`;

    resize();
  }

  function setValue(item, value) {
    item.value = value;
    renderDocument();
  }

  const $actions = {
    update: value => () => ({
      items: value.slice(),
    }),
  };

  const $state = {
    items: [],
  };

  function setItem(item) {
    return e => {
      if (e.target.value === 'off') setValue(item, false);
      if (e.target.value === 'on') setValue(item, true);
    };
  }

  function Radio(item, value, label, checked) {
    return ['label', [
      ['input', { type: 'radio', name: item.key, onchange: setItem(item), value, checked }],
      label || value,
    ]];
  }

  function Value(item, Self) {
    if (item.data) {
      return ['div.nested', [
        ['span.group.clean', [
          Radio(item, 'off', 'OFF', true),
          Radio(item, 'on', 'ON'),
        ]],
        Self(item.data),
      ]];
    }

    if (typeof item.bool !== 'undefined') {
      return ['div.flex', [
        ['input', { type: 'checkbox', name: item.key, id: item.key, onchange(e) {
          setValue(item, e.target.checked);
        } }],
      ]];
    }

    return ['div.flex', [
      ['textarea', {
        name: item.key,
        id: item.key,
        rows: 2,
        oncreate(e) {
          item.ref = e;
        },
        onchange(e) {
          setValue(item, e.target.value);
        },
      }],
      ['a', {
        onclick() {
          item.ref.value = '';
          setValue(item, '');
        },
      }, '×'],
    ]];
  }

  function Data(items) {
    return ['ul', items.map(item => ['li', [
      ['label', { for: item.key }, item.key],
      Value(item, Data),
    ]])];
  }

  const $view = state => ['div', [
    !state.items.length && ['p', 'No variables found'],
    Data(state.items),
  ]];

  const editor = view($view, $state, $actions);
  const $$ = editor('#input', $);
  const refs = {};

  function edit() {
    $$.update(curVars);
  }

  function input(args) {
    const defaults = args.input.reduce((prev, cur) => {
      if (!cur.input.length) {
        prev.push({ key: cur.key, bool: cur.falsy });
      } else {
        prev.push({ key: cur.key, data: cur.input });
      }
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

  function setRef(name) {
    return e => {
      refs[name] = e;
    };
  }

  function getRef(name) {
    return refs[name];
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

  function sendMail() {
    post(`/send_template/${getId()}.html?${target},${getQueryParams()}`).then(alert);
  }

  function setMail(e) {
    target = e.target.value;
    getRef('email').disabled = !e.target.validity.valid;
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
