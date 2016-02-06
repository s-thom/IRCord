/* jslint node: true, esversion: 6 */
'use strict';
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
    this.auth = new Boolean(auth);
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

/**
 * @class
 * A bridge between IRC and Discord
 */
class Bridge {
  /**
   * @constructor
   * @param {Object} Configuration for the bridge
   */
  constructor(config) {
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
    return '**[' + input.source + ']** <' + input.user + '> ' + input.text;
  }

  /**
   * Formats text for output to IRC
   * @param {Message} input A message to convert
   * @return {string} String formatted for IRC
   */
  static formatForIrc(input) {
    return '\x0f\x02[\x0302' + input.source + '\x0f\x02]\x0f <' + input.user + '> ' + input.text;
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
          console.log(this.formatForConsole(new Message(text, nick, 'N', false)));
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
      this.irc.whois(nick, function(info) {
        // Check if host is a IP, return opposite (i.e. not an IP)
        resolve(!info.host.match(/\d+\.\d+\.\d+\.\d+/));
      });
    });
  }

  /**
   * Builds a bridge, so your messages can get over it
   */
  bridge() {
    return Promise.all([this.loginDiscord(), this.loginIrc()])
      .catch(function(e) {
        console.error('failed to login ' + e);
        console.error(e.stack);
        throw e;
      })
      .then(() => {
        // Add Discord message listeners
        this.discord.on('message', (message) => {
          // Ignore messages from self
          if (message.author.id !== this.discord.user.id) {
            // Ignore PMs (don't want to be putting those everywhere)
            if (message.channel instanceof Discord.TextChannel) {
              // Create message, format, and send
              var m = new Message(message.content, message.author.username, 'D', true);
              Promise.resolve(m)
                .then(this.formatForIrc)
                .then(this.sendToIrc);

              if (this.c.verbose) {
                console.log(this.formatForConsole(m));
              }
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
                Promise.resolve(m)
                  .then(this.formatForDiscord)
                  .then(this.sendToDiscord);

                if (this.c.verbose) {
                  console.log(this.formatForConsole(m));
                }
              });
          }
        });
      });
  }
}

module.exports = {
  Bridge: Bridge,
  Message: Message
};
