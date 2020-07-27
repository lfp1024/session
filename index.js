'use strict';

const debug = require('debug')('koa-session');
const ContextSession = require('./lib/context');
const util = require('./lib/util');
const assert = require('assert');
const uuid = require('uuid/v4');
const is = require('is-type-of');

const CONTEXT_SESSION = Symbol('context#contextSession');
const _CONTEXT_SESSION = Symbol('context#_contextSession');

/**
 * Initialize session middleware with `opts`:
 *
 * - `key` session cookie name ["koa.sess"]
 * - all other options are passed as cookie options
 *
 * @param {Object} [opts]
 * @param {Application} app, koa application instance
 * @api public
 */

module.exports = function (opts, app) {
  // 兼容性处理，参数位置
  // session(app[, opts])
  if (opts && typeof opts.use === 'function') {
    [app, opts] = [opts, app];
  }
  // app required
  if (!app || typeof app.use !== 'function') {
    throw new TypeError('app instance required: `session(opts, app)`');
  }

  opts = formatOpts(opts);
  extendContext(app.context, opts);

  return async function session(ctx, next) {
    debug('return session -----------')
    const sess = ctx[CONTEXT_SESSION];
    if (sess.store) await sess.initFromExternal();
    try {
      await next();
    } catch (err) {
      throw err;
    } finally {
      if (opts.autoCommit) {
        await sess.commit();
      }
    }
  };
};

/**
 * format and check session options
 * @param  {Object} opts session options
 * @return {Object} new session options
 *
 * @api private
 */

function formatOpts(opts) {
  opts = opts || {};
  // key
  opts.key = opts.key || 'koa.sess';

  // 兼容性处理，兼容 maxage 防止写错
  // back-compat maxage
  if (!('maxAge' in opts)) opts.maxAge = opts.maxage;

  // defaults
  if (opts.overwrite == null) opts.overwrite = true;
  if (opts.httpOnly == null) opts.httpOnly = true;
  // delete null sameSite config
  if (opts.sameSite == null) delete opts.sameSite;
  if (opts.signed == null) opts.signed = true;
  if (opts.autoCommit == null) opts.autoCommit = true;

  debug('session options %j', opts);

  // setup encoding/decoding
  if (typeof opts.encode !== 'function') {
    opts.encode = util.encode;
  }
  if (typeof opts.decode !== 'function') {
    opts.decode = util.decode;
  }

  const store = opts.store;
  if (store) {
    assert(is.function(store.get), 'store.get must be function');
    assert(is.function(store.set), 'store.set must be function');
    assert(is.function(store.destroy), 'store.destroy must be function');
  }

  const externalKey = opts.externalKey;
  if (externalKey) {
    assert(is.function(externalKey.get), 'externalKey.get must be function');
    assert(is.function(externalKey.set), 'externalKey.set must be function');
  }

  const ContextStore = opts.ContextStore;
  if (ContextStore) {
    assert(is.class(ContextStore), 'ContextStore must be a class');
    assert(is.function(ContextStore.prototype.get), 'ContextStore.prototype.get must be function');
    assert(is.function(ContextStore.prototype.set), 'ContextStore.prototype.set must be function');
    assert(is.function(ContextStore.prototype.destroy), 'ContextStore.prototype.destroy must be function');
  }

  // 给opts 添加一个生成 id 的方法，调用的时候生成
  if (!opts.genid) {
    if (opts.prefix) opts.genid = () => `${opts.prefix}${uuid()}`;
    else opts.genid = uuid;
  }

  return opts;
}

/**
 * 扩展 app.context 原型，给 ctx 对象添加 session 属性
 * extend context prototype, add session properties
 *
 * @param  {Object} context koa's context prototype
 * @param  {Object} opts session options
 *
 * @api private
 */

function extendContext(context, opts) {
  if (context.hasOwnProperty(CONTEXT_SESSION)) {
    return;
  }
  Object.defineProperties(context, {
    [CONTEXT_SESSION]: {
      get() {
        debug('call ContextSession-------------')
        if (this[_CONTEXT_SESSION]) return this[_CONTEXT_SESSION];
        // 每次请求都会创建一个 ContextSession 对象
        debug('new  ContextSession ----------')
        this[_CONTEXT_SESSION] = new ContextSession(this, opts);
        return this[_CONTEXT_SESSION];
      },
    },
    session: {
      get() {
        // session 是通过 ContextSession 的 get 方法赋值的
        // 因此需要先添加 [CONTEXT_SESSION] 属性，实例化，然后才能通过其get方法获取session
        // 每次请求都会创建一个session对象
        return this[CONTEXT_SESSION].get();
      },
      set(val) {
        this[CONTEXT_SESSION].set(val);
      },
      configurable: true,
    },
    sessionOptions: {
      get() {
        // 当创建非空session时，会访问 sessionOptions
        debug('call sessionOptions---------------')
        return this[CONTEXT_SESSION].opts;
      },
    },
  });
}
