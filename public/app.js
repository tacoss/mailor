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

function getData(args) {
  let obj = null;
  if (args && args.input) {
    args.input.forEach(prop => {
      if (obj === null) obj = {};
      if (prop.repeat) {
        obj[prop.key] = prop.input.map(x => getData({ input: x }));
      } else {
        obj[prop.key] = getData(prop);
      }
    });
  }
  return obj;
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

function Toolbar(el, data, onShow, onDelete) {
  const $view = state => ['.pad.flex.center', null, [
    ['div.menu', null, [
      ['h1', null, [['a.inbox', {
        href: '//0.0.0.0:1080',
        target: '_blank',
        class: state.items.length > 0 ? '' : 'empty',
        'data-count': state.items.length,
      }], ['a', { href: '/' }, 'Mailor']]],
      ['ul', null, state.items.map(item => ['li', null, [
        ['button', { onclick: () => onDelete(item.id) }, '×'],
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
        }, [['small', null, `${moment(new Date(item.time)).fromNow()} → ${item.envelope.to[0].address}`], item.subject]],
      ]])],
    ]],
    ['label', null, [
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

function Edit(el, onValue) {
  const $actions = {
    update: value => () => value,
  };

  const $state = {};

  const $view = state => ['div', null, [
    ['textarea', {
      oninput(e) {
        onValue.call(e.target, e.target.value);
      },
    }, JSON.stringify(state, null, 2)],
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

  function getLocals(source, defaults = {}) {
    if (Array.isArray(source)) return source.map(getLocals);
    if (!source || typeof source !== 'object') return source;

    const copy = {};
    Object.keys(source).forEach(key => {
      copy[key] = source[key] === null ? defaults[key] || `[${key}]` : getLocals(source[key], defaults[key] || {});
    });
    return copy;
  }

  function getQueryParams() {
    return encodeURIComponent(JSON.stringify(getLocals(curVars, defs)));
  }

  function renderDocument() {
    mainEl.onload = () => {
      document.title = `${title} (${titleCase(getId())} - ${mainEl.contentDocument.title || 'Untitled'})`;
    };

    if (data.indexOf(getId()) === -1) {
      location.hash = data[0];
    } else {
      mainEl.src = `/generated_templates/${getId()}.html?${getQueryParams()}`;

      resize();
    }
  }

  let timeout;
  function setValue(value) {
    try {
      const payload = JSON.parse(value);
      curVars = payload;
      clearTimeout(timeout);
      timeout = setTimeout(renderDocument, 120);
      this.classList.remove('invalid');
    } catch (e) {
      this.classList.add('invalid');
    }
  }

  const paramsEl = new Edit('#input', setValue);

  function syncVars(key) {
    paramsEl.update(curVars = getData(vars[key]));
  }

  if (Object.keys(vars).length) {
    const key = location.hash.split('#')[1] || data[0];

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
    getRef('email').disabled = !getRef('email').validity.valid;
  }
  setInterval(sync, 10000);
  sync();

  function sendMail() {
    getRef('email').disabled = true;
    post(`/send_template/${getId()}.html?${target},${getQueryParams()}`)
      .then(debugMessage)
      .then(sync);
  }

  const OptionList = ['ul.pad.flex.center', null, [
    ['li.flex.group', null, [
      ['input', { type: 'email', required: true, oninput: setMail }],
      ['button', { disabled: true, onclick: sendMail, oncreate: setRef('email') }, 'Send'],
      ['span.notify', { oncreate: setRef('info') }],
    ]],
    ['li.flex.group', null, [
      ['a.active', { href: '#', onclick: showPreview, oncreate: pickMe }, 'Preview'],
      ['a', { href: '#', onclick: showData }, 'Input'],
    ]],
    ['li.group', null, [
      ['select', { onchange: setMode, oncreate: setRef('resize') }, modes.map(x => ['option', null, `${x}px`])],
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
