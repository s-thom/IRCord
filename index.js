/* jslint node: true, esversion: 6 */
'use strict';
var EventEmitter = require('events');
var Discord = require('discord.js');
var IRC = require('irc');

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
  constructor(text, source) {
    super(text, null, source, false);
  }
}

/**
 * @class
 * A bridge between IRC and Discord
 */
class Bridge extends EventEmitter {
  /**
   * @constructor
   * @param {Object} Configuration for the bridge
   */
  constructor(config) {
    super();
    this.c = config;
    this.discord = new Discord.Client();
    this.irc = new IRC.Client(this.c.irc.server, this.c.irc.nick, {
      autoConnect: false,
      userName: this.c.irc.nick,
      realName: 'IRCord'
    });

    this.ircUsers = {}; // Won't always have a full list, used for auth
    this.discordChannel = {}; // Will hold a reference to the channel for easy reference
  }

  /**
   * Formats text for output to Discord
   * @param {Message} input A message to convert
   * @return {string} String formatted for Discord
   */
  static formatForDiscord(input) {
    if (input instanceof StatusMessage) {
      return '**[' + input.source + ']** *' + input.text + '*';
    } else {
      return '**[' + input.source + ']** <' + input.user + '> ' + input.text;
    }
  }

  /**
   * Formats text for output to IRC
   * @param {Message} input A message to convert
   * @return {string} String formatted for IRC
   */
  static formatForIrc(input) {
    if (input instanceof StatusMessage) {
      return '\x0f\x02[\x0302' + input.source + '\x0f\x02]\x0f \x1d' + input.text;
    } else {
      return '\x0f\x02[\x0302' + input.source + '\x0f\x02]\x0f <' + input.user + '> ' + input.text;
    }
  }

  /**
   * Formats text for output to the console
   * @param {Message} input A message to convert
   * @return {string} String formatted for the console
   */
  static formatForConsole(input) {
    return input.source + ',' + input.user + ': ' + input.text;
  }

  /**
   * Logs into Discord
   * @return {Promise} Resolves when logged in
   */
  loginDiscord() {
    return new Promise((resolve, reject) => {
      // Function that is called when logged in
      var onReady = () => {
        // Remove this listener
        this.discord.removeListener('ready', onReady);
        this.discordChannel = this.discord.channels.get("name", this.c.discord.channel);

        // Debug output
        if (this.c.verbose) {
          console.log('successfully logged into discord');
        }

        resolve();
      };
      this.discord.on('ready', onReady);
      this.discord.login(this.c.discord.email, this.c.discord.pass);
    });
  }

  /**
   * Logs into IRC
   * @return {Promise} Resolves when logged in
   */
  loginIrc() {
    return new Promise((resolve, reject) => {
      // Function that gets called on any Notice
      var tryLogin = (nick, to, text, message) => {
        // Debug output
        if (this.c.verbose) {
          console.log(Bridge.formatForConsole(new Message(text, nick, 'N', false)));
        }
        try {
          // Log in once NickSev sends the right messages
          if (nick === 'NickServ' && message.args.join(' ').match(/This nickname is registered and protected\./)) {
            this.irc.say('nickserv', 'identify ' + this.c.irc.pass);
          } else
          // When logged in, join the channels
          if (nick === 'NickServ' && message.args.join(' ').match(/Password accepted/)) {
            this.irc.join(this.c.irc.channel);
            this.irc.removeListener('notice', tryLogin);
            // Resolve
            resolve();

            if (this.c.verbose) {
              console.log('successfully logged into irc');
            }
          }
        } catch (err) {
          console.error(err);
        }
      };

      this.irc.on('notice', tryLogin);
      this.irc.connect();
    });
  }

  sendAll(input) {
    if (input.source) {
      if (input.source !== 'D') {
        this.sendToDiscord(Bridge.formatForDiscord(input));
      }
      if (input.source !== 'I') {
        this.sendToIrc(Bridge.formatForIrc(input));
      }
    } else {
      this.sendToDiscord(input.text);
      this.sendToIrc(input.text);
    }
  }

  /**
   * Outputs to Discord
   * @param {string} str String to output
   */
  sendToDiscord(str) {
    this.discordChannel.send(str);
  }

  /**
   * Outputs to IRC
   * @param {string} str String to output
   */
  sendToIrc(str) {
    this.irc.say(this.c.irc.channel, str);
  }

  /**
   * Checks to see if a user is registered in IRC
   * @param {string} nick Nick of user to check
   * @return {Promise} Resolves with Boolean stating whether user is registered
   */
  ircUserRegistered(nick) {
    return new Promise((resolve, reject) => {
      if (typeof this.ircUserRegistered[nick] === 'undefined') {
        this.irc.whois(nick, (info) => {
          // Check if host is a IP, return opposite (i.e. not an IP)
          var usingVhost = !info.host.match(/\d+\.\d+\.\d+\.\d+/);
          resolve(usingVhost);
        });
      } else {
        resolve(this.ircUserRegistered[nick]);
      }
    });
  }

  addEvents() {
    // Add Discord message listeners
    this.discord.on('message', (message) => {
      // Ignore messages from self
      if (message.author.id !== this.discord.user.id) {
        // Ignore PMs (don't want to be putting those everywhere)
        if (message.channel instanceof Discord.TextChannel) {
          // Create message, format, and send
          var m = new Message(message.content, message.author.username, 'D', true);
          this.sendAll(m);
          this.emit('message', m);

          if (this.c.verbose) {
            console.log(Bridge.formatForConsole(m));
          }
        }
      }
    }).on('presence', (old, updated) => {
      if (!(old.username === this.discord.user.username || updated.username === this.discord.user.name)) {
        var m;
        if (old.status === 'offline' && updated.status === 'online') {
          m = new StatusMessage(updated.username + ' joined Discord', 'D');
          this.emit('join', m);
          this.sendAll(m);
        } else if (old.status === 'online' && updated.status === 'offline') {
          m = new StatusMessage(updated.username + ' left Discord', 'D');
          this.emit('leave', m);
          this.sendAll(m);
        }
      }
    });
    // Add IRC message listeners
    this.irc.on('message' + this.c.irc.channel, (nick, text, message) => {
      // Ignore message from self
      if (nick !== this.irc.nick) {
        // Check if user is registered
        this.ircUserRegistered(nick)
          .then((authed) => {
            // Create messafe, format, send
            var m = new Message(text, nick, 'I', authed);
            this.sendAll(m);
            this.emit('message', m);

            if (this.c.verbose) {
              console.log(Bridge.formatForConsole(m));
            }
          });
      }
    }).on('join', (channel, nick, message) => { // Check if user is registered
      if (nick !== this.c.irc.nick) {
        // Reset resistered state
        if (typeof this.ircUserRegistered[nick] !== 'undefined') {
          delete this.ircUserRegistered[nick];
        }
        this.ircUserRegistered(nick)
          .then((authed) => {
            // Create messafe, format, send
            var m = new StatusMessage(nick + ' joined IRC', 'I');
            this.sendAll(m);
            this.emit('join', m);
          });
      }
    }).on('part', (channel, nick, message) => {
      if (nick !== this.c.irc.nick) {
        var m = new StatusMessage(nick + ' left IRC', 'I');
        this.emit('leave', m);
        this.sendAll(m);
        if (typeof this.ircUserRegistered[nick] !== 'undefined') {
          delete this.ircUserRegistered[nick];
        }
      }
    });
  }

  /**
   * Builds a bridge, so your messages can get over it
   */
  build() {
    return Promise.all([this.loginDiscord(), this.loginIrc()])
      .catch(function(e) {
        console.error('failed to login ' + e);
        console.error(e.stack);
        throw e;
      })
      .then(() => {
        this.emit('bridged');
        this.addEvents();
      });
  }

  /**
   * Burns the bridge to the ground
   */
  burn() {
    // Disconnect from Discord
    this.discord.logout();
    // Disconnect from IRC
    this.irc.disconnect();
  }
}

module.exports = {
  Bridge: Bridge,
  Message: Message
};
