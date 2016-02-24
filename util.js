/* jslint node: true, esversion: 6 */
'use strict';
var EventEmitter = require('events');

/**
 * @class
 * Stores information about a message
 */
class Message {
  /**
   * @constructor
   * @param {string} value Text content of the message
   * @param {string} nick Name of the user who sent the message
   * @param {string} source Name of source of message. Should be a single letter
   * @param {boolean} auth Whetehr user is registered (NOT TOTALLY TRUSTWORTHY)
   */
  constructor(value, nick, source, auth) {
    this.value = value;
    this.nick = nick;
    this.src = source;
    this.auth = auth;
  }

  /**
   * @return {string} Text content of message
   */
  get text() {
    return this.value;
  }

  /**
   * @return {string} User that sent message
   */
  get user() {
    return this.nick;
  }

  /**
   * @return {string} Source of message
   */
  get source() {
    return this.src;
  }

  /**
   * @return {boolean} Whether user is registered
   * WARNING: This shouldn't be trusted as it is easy to set
   * Do all proper auth checks yourself
   */
  isAuth() {
    return this.auth;
  }

}

class StatusMessage extends Message {
  constructor(text, source, nick) {
    super(text, nick, source, false);
  }
}

class ErrorMessage extends Message {
  constructor(err) {
    super(err.message, null, 'Error', false);
  }
}

class BridgeComponent extends EventEmitter {
  constructor(conf) {
    this._conf = conf;
    this._name = conf.name;
    this._initial = conf.initial.charAt(0);
    this._colour = conf.colour;
  }

  get name() {
    return this._name;
  }

  get initial() {
    return this._initial;
  }

  get colour() {
    return this._colour;
  }

  send(message) {
    throw new Error('must override send function');
  }

  login() {
    throw new Error('must override login function');
  }

  logout() {
    throw new Error('must override logout function');
  }

  setPlaying(name) {
    // do nothing by default
  }
}

module.exports = {
  Message: Message,
  StatusMessage: StatusMessage,
  ErrorMessage: ErrorMessage
};
