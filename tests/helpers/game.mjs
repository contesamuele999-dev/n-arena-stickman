import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { EventEmitter } from 'node:events';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]).join('\n');

export function createGame({ saved = '{}', storageFails = false, peerAvailable = true } = {}) {
  const elements = new Map();
  const listeners = new Map();
  const timers = new Map();
  const frames = [];
  const storage = new Map([['n_stickman_campaign', saved]]);
  let timerId = 0;
  const canvasContext = new Proxy({}, {
    get(target, property) {
      return target[property] ?? (() => ({ addColorStop() {} }));
    },
  });
  function element(id) {
    if (!elements.has(id)) {
      const classes = new Set();
      const item = {
        id, style: {}, value: '', innerText: '', innerHTML: '', textContent: '', disabled: false,
        width: 960, height: 528,
        classList: {
          add: (...names) => names.forEach(name => classes.add(name)),
          remove: (...names) => names.forEach(name => classes.delete(name)),
          contains: name => classes.has(name),
          toggle(name, force = !classes.has(name)) {
            force ? classes.add(name) : classes.delete(name);
            return force;
          },
        },
        addEventListener(name, handler) { listeners.set(`${id}:${name}`, handler); },
        getContext: () => canvasContext,
        setAttribute(name, value) { this[name] = value; },
      };
      elements.set(id, item);
    }
    return elements.get(id);
  }
  class FakeConnection extends EventEmitter {
    constructor(peer = 'client') {
      super();
      this.peer = peer;
      this.open = true;
      this.sent = [];
    }
    send(data) { this.sent.push(structuredClone(data)); }
    close() { this.open = false; this.emit('close'); }
  }
  class FakePeer extends EventEmitter {
    constructor(id) {
      super();
      this.id = id || 'client-id';
      this.destroyed = false;
    }
    connect(code) { return new FakeConnection(code); }
    destroy() { this.destroyed = true; this.emit('close'); }
  }
  const window = {
    addEventListener(name, handler) { listeners.set(`window:${name}`, handler); },
    matchMedia: () => ({ matches: false }),
  };
  const document = {
    hidden: false,
    getElementById: element,
    querySelector: element,
    querySelectorAll: selector => selector === '.touch-btn' ? [...elements.values()].filter(el => el.id.startsWith('btnTouch')) : [],
    addEventListener(name, handler) { listeners.set(`document:${name}`, handler); },
    removeEventListener() {},
  };
  const localStorage = {
    getItem(key) {
      if (storageFails) throw new Error('Storage unavailable');
      return storage.get(key) ?? null;
    },
    setItem(key, value) {
      if (storageFails) throw new Error('Storage unavailable');
      storage.set(key, value);
    },
  };
  const navigator = { maxTouchPoints: 0, userAgent: 'node-test', clipboard: { writeText: async () => {} } };
  window.navigator = navigator;
  const context = vm.createContext({
    window, document, navigator, localStorage,
    console: { log() {}, warn() {}, error() {} },
    performance: { now: () => 0 },
    setTimeout(handler) { const id = ++timerId; timers.set(id, handler); return id; },
    clearTimeout: id => timers.delete(id),
    setInterval(handler) { const id = ++timerId; timers.set(id, handler); return id; },
    clearInterval: id => timers.delete(id),
    requestAnimationFrame: handler => frames.push(handler),
    alert() {},
    ...(peerAvailable ? { Peer: FakePeer } : {}),
  });
  vm.runInContext(script, context, { filename: 'index.html' });
  return {
    run: code => vm.runInContext(code, context),
    element, listeners, timers, frames, storage, FakeConnection,
    dispatch(name, properties = {}) {
      listeners.get(name)?.({ code: '', repeat: false, target: { tagName: 'BODY' }, preventDefault() {}, ...properties });
    },
    flushTimers() { for (const handler of [...timers.values()]) handler(); },
  };
}
