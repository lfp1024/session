'use strict';
const debug = require('debug')('koa-session:session');
/**
 * Session model.
 */

class Session {
  /**
   * Session constructor
   * @param {Context} ctx
   * @param {Object} obj
   * @api private
   */

  constructor(sessionContext, obj) {
    this._sessCtx = sessionContext;
    this._ctx = sessionContext.ctx;
    // 空session，具有 isNew 属性，表示没有会话数据，没有登录
    // 登录后session有数据，保存的时候将该属性过滤掉，因此判断 isNew 可以知道是否已经登录
    if (!obj) {
      this.isNew = true;
    } else {
      for (const k in obj) {
        // restore maxAge from store

        // 为什么再次restore?
        // 因为用户可以修改某个session的maxAge，下次保存的时候要使用上次的值。以及maxAge为session，长期有效也要使用上次的值

        // 在初始化session的时候，已经修改了传入的配置中的maxAge项

        // 直接访问 sessionContext.maxAge ?
        // - 这里是通过 sessionContext 获取 app.context ，再通过 context 访问 sessionOptions，再
        //   通过挂载在 context 上的 sessionContext 访问 maxAge
        // - 测试结果为true表面两者是同一个对象，为什么要这么做？
        // debug('--------是否相同------- ?',this._ctx.sessionOptions === this._sessCtx.opts)

        if (k === '_maxAge') this._ctx.sessionOptions.maxAge = obj._maxAge;
        else if (k === '_session') this._ctx.sessionOptions.maxAge = 'session';
        else this[k] = obj[k];
      }
    }
  }

  /**
   * 最后保存的是session的属性，toJSON 之后只有属性，提供的这些方法都是操作属性的
   * JSON representation of the session.
   *
   * @return {Object}
   * @api public
   */

  toJSON() {
    const obj = {};

    Object.keys(this).forEach(key => {
      // 过滤掉 isNew 属性
      if (key === 'isNew') return;
      // 过滤掉 _expire _maxAge 等属性，在save的时候需要重置
      if (key[0] === '_') return;
      obj[key] = this[key];
    });

    return obj;
  }

  /**
   *
   * alias to `toJSON`
   * @api public
   */

  inspect() {
    return this.toJSON();
  }

  /**
   * Return how many values there are in the session object.
   * Used to see if it's "populated".
   *
   * @return {Number}
   * @api public
   */

  get length() {
    return Object.keys(this.toJSON()).length;
  }

  /**
   * populated flag, which is just a boolean alias of .length.
   *
   * @return {Boolean}
   * @api public
   */

  get populated() {
    return !!this.length;
  }

  /**
   * get session maxAge
   *
   * @return {Number}
   * @api public
   */

  get maxAge() {
    return this._ctx.sessionOptions.maxAge;
  }

  /**
   * set session maxAge
   *
   * @param {Number}
   * @api public
   */

  set maxAge(val) {
    this._ctx.sessionOptions.maxAge = val;
    // maxAge changed, must save to cookie and store
    this._requireSave = true;
  }

  /**
   * save this session no matter whether it is populated
   *
   * @api public
   */

  save() {
    this._requireSave = true;
  }

  /**
   * commit this session's headers if autoCommit is set to false
   *
   * @api public
   */

  async manuallyCommit() {
    await this._sessCtx.commit();
  }

}

module.exports = Session;
