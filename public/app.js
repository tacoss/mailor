/* global somedom, moment */
const {
  bind, view, mount, render, listeners, attributes, classes,
} = somedom;

const $ = bind(render,
  attributes({
    class: classes,
  }),
  listeners());

const refs = {};
const modes = [600, 480, 320];
const title = document.title;
const mainEl = document.querySelector('#preview');
const toggleEl = document.querySelector('#toggle');

function setRef(name) {
  return e => {
    refs[name] = e;
  };
}

function getRef(name) {
  return refs[name];
}

function getInput(args) {
  let defaults = [];

  if (args && args.input) {
    defaults = args.input.reduce((prev, cur) => {
      if (!cur.input.length) {
        prev.push({ key: cur.key, bool: cur.falsy });
      } else {
        prev.push({ key: cur.key, data: cur.input, list: cur.repeat });
      }
      return prev;
    }, []);
  }

  return defaults;
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

function titleCase(text) {
  return text[0].toUpperCase() + text.substr(1).replace(/-([a-z])/g, (_, k) => ` ${k.toUpperCase()}`);
}

function clone(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(x => clone(x));
  return Object.keys(obj).reduce((memo, key) => Object.assign(memo, { [key]: clone(obj[key]) }), {});
}

function Toolbar(el, data, onShow, onDelete) {
  const $view = state => ['.pad.flex.center', [
    ['div.menu', [
      ['h1', [['a.inbox', {
        href: '//0.0.0.0:1080',
        target: '_blank',
        class: state.items.length > 0 ? '' : 'empty',
        'data-count': state.items.length,
      }], ['a', { href: '/' }, 'Mailor']]],
      ['ul', state.items.map(item => ['li', [
        ['button', { onclick: e => e.target.blur() || onDelete(item.id) }, '×'],
        ['a', {
          href: `//0.0.0.0:1080/#/email/${item.id}`,
          target: '_blank',
          title: moment(new Date(item.time)).fromNow(),
          onclick(e) {
            e.preventDefault();

            const opts = 'toolbar=no,location=no,directories=no,status=no,menubar=no,scrollbars=yes,resizable=yes,width=600,height=800';
            const win = window.open('', item.subject, `${opts},top=${(screen.height - 800) / 2},left=${(screen.width - 600) / 2}`);

            win.document.body.innerHTML = item.html;
          },
        }, [['small', `${moment(new Date(item.time)).fromNow()} → ${item.envelope.to[0].address}`], item.subject]],
      ]])],
    ]],
    ['label', [
      'Available templates:',
      ['select.group', { onchange: onShow }, data.map(x => ['option', { value: x, selected: location.hash === `#${x}` }, [titleCase(x)]])],
    ]],
  ]];

  const $state = {
    items: [],
  };

  const $actions = {
    update: value => () => ({
      items: value,
    }),
  };

  return view($view, $state, $actions)(el, $);
}

function Value(item, Self, callback) {
  if (item.data) {
    return ['div.nested', [
      ['label', [
        'Enabled',
        ['input', { type: 'checkbox', onchange: e => callback(item, e.target.checked) }],
      ]],
      Self(item.data, item.list),
    ]];
  }

  if (typeof item.bool !== 'undefined') {
    return ['div.flex', [
      ['input', {
        type: 'checkbox',
        onchange(e) {
          callback(item, e.target.checked);
        },
      }],
    ]];
  }

  return ['div.flex', [
    ['textarea', {
      rows: 1,
      oncreate(e) {
        item.ref = e;
      },
      onchange(e) {
        callback(item, e.target.value);
      },
    }],
    ['button', {
      onclick() {
        item.ref.value = '';
        callback(item, '');
      },
    }, '×'],
  ]];
}

function List(el, Self, result, callback) {
  function getValue(offset) {
    return {
      list: true,
      key: offset,
      data: clone(result)[0],
    };
  }

  function rmValue(e, item, actions) {
    e.target.blur();
    actions.remove(item.key);
  }

  const $actions = {
    update: value => () => ({
      items: value,
    }),
    append: value => ({ items }) => ({
      items: items.concat(value),
    }),
    remove: value => ({ items }) => ({
      items: items.filter(x => x.key !== value),
    }),
  };

  const $state = {
    items: [getValue(0)],
  };

  const $view = ({ items }, actions) => ['div', [
    ['ul', items.map(item => ['li', [
      Self(item.data),
      item.key > 0 && ['button', { onclick: e => rmValue(e, item, actions) }, 'Remove'],
    ]])],
    ['button', { onclick: () => actions.append(getValue(items.length)) }, 'Append'],
  ]];

  const View = view($view, $state, $actions);
  const $$ = View(el, $);

  $$.subscribe(callback);

  return $$;
}

function Params(el, onValue, onUpdate) {
  const $actions = {
    update: value => () => ({
      items: value,
    }),
  };

  const $state = {
    items: [],
  };

  function Data(items, repeated) {
    if (repeated) {
      return ['fieldset', {
        oncreate: _el => new List(_el, Data, items, result => {
          result.items.forEach(item => { items[item.key] = item.data; });
          items.length = result.items.length;
          onUpdate();
        }),
      }];
    }

    return ['ul', items.map(item => ['li', [
      ['details', [
        ['summary', item.key],
        Value(item, Data, onValue),
      ]],
    ]])];
  }

  const $view = state => ['div', [
    !state.items.length && ['p', 'No variables found'],
    Data(state.items),
  ]];

  return view($view, $state, $actions)(el, $);
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

async function post(url, data, method) {
  const resp = await fetch(url, {
    method: method || 'POST',
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
  let allRecipients = [];

  async function getMails() {
    allRecipients = await get('/recipients.json');
  }

  function resize() {
    mainEl.style.width = `${modes[currentMode || 0]}px`;
  }

  function getId() {
    return location.hash.split('#')[1];
  }

  function getLocals(source, _target) {
    if (Array.isArray(source[0])) {
      return source.map(x => getLocals(x));
    }

    return source.reduce((prev, cur) => {
      if (cur.list || cur.data) {
        if (cur.value) prev[cur.key] = getLocals(cur.data);
      } else if (typeof cur.bool !== 'undefined') {
        prev[cur.key] = cur.value;
      } else if (cur.value !== false) {
        prev[cur.key] = cur.value || defs[cur.key] || `[${cur.key.toUpperCase()}]`;
      }
      return prev;
    }, _target || {});
  }

  function getQueryParams() {
    return encodeURIComponent(JSON.stringify(getLocals(curVars)));
  }

  function renderDocument() {
    mainEl.onload = () => {
      document.title = `${title} (${titleCase(getId())} - ${mainEl.contentDocument.title || 'Untitled'})`;
    };

    if (data.indexOf(getId()) === -1) {
      location.hash = Object.keys(vars)[0];
    } else {
      mainEl.src = `/generated_templates/${getId()}.html?${getQueryParams()}`;

      resize();
    }
  }

  function setValue(item, value) {
    item.value = value;
    renderDocument();
  }

  const paramsEl = new Params('#input', setValue, renderDocument);

  function syncVars(key) {
    paramsEl.update(curVars = getInput(vars[key]));
  }

  if (Object.keys(vars).length) {
    const key = location.hash.split('#')[1] || Object.keys(vars)[0];

    if (!location.hash) {
      location.hash = key;
    }
    syncVars(key);
  }

  function pickMe(node) {
    lastOption = node;
  }

  function showMe(e) {
    const name = e.target.options[e.target.options.selectedIndex].value;

    location.hash = name;
    syncVars(name);
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

  function setMail(e) {
    target = e.target.value;
    getRef('email').disabled = !e.target.validity.valid;
  }

  function debugMessage(text) {
    getRef('info').textContent = text;
    getRef('info').classList.add('display');
    setTimeout(() => {
      getRef('info').classList.remove('display');
    }, 1200);
  }

  function deleteEmail(id) {
    post(`/recipients.json?${id}`, null, 'DELETE').then(debugMessage).then(sync); // eslint-disable-line
  }

  const counter = new Toolbar('#list', data, showMe, deleteEmail);

  async function sync() {
    await getMails();
    counter.update(allRecipients);
    getRef('email').disabled = false;
    getRef('email').classList.remove('pending');
  }
  setInterval(sync, 60000);
  sync();

  function sendMail() {
    getRef('email').disabled = true;
    getRef('email').classList.add('pending');
    post(`/send_template/${getId()}.html?${target},${getQueryParams()}`)
      .then(debugMessage)
      .then(sync);
  }

  const OptionList = ['ul.pad.flex.center', [
    ['li.flex.group', [
      ['input', { type: 'email', required: true, oninput: setMail }],
      ['button', { disabled: true, onclick: sendMail, oncreate: setRef('email') }, 'Send'],
      ['span.notify', { oncreate: setRef('info') }],
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
