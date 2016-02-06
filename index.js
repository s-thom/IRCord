/* jslint node: true, esversion: 6 */
'use strict';
var Discord = require('discord.js');
var IRC = require('irc');
var config = require('./config.json');

// Possibly change names, to reduce ambiguity with module and variable
var discord = new Discord.Client();
var irc = new IRC.Client(config.irc.server, config.irc.nick, {
  autoConnect: false,
  userName: config.irc.nick,
  realName: 'IRCord'
});

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
    });
  }
}

/**
 * Logs into Discord
 * @return {Promise} Resolves when logged in
 */
function loginDiscord() {
  return new Promise(function(resolve, reject) {
    // Function that is called when logged in
    function onReady() {
      // Remove this listener
      discord.removeListener('ready', onReady);

      // Debug output
      if (config.verbose) {
        console.log('successfully logged into discord');
      }

      resolve();
    }
    discord.on('ready', onReady);
    discord.login(config.discord.email, config.discord.pass);
  });
}

/**
 * Logs into IRC
 * @return {Promise} Resolves when logged in
 */
function loginIrc() {
  return new Promise(function(resolve, reject) {
    // Function that gets called on any Notice
    function tryLogin(nick, to, text, message) {
      // Debug output
      if (config.verbose) {
        console.log(formatForConsole(new Message(text, nick, 'N', false)));
      }
      try {
        // Log in once NickSev sends the right messages
        if (nick === 'NickServ' && message.args.join(' ').match(/This nickname is registered and protected\./)) {
          irc.say('nickserv', 'identify ' + config.irc.pass);
        } else
        // When logged in, join the channels
        if (nick === 'NickServ' && message.args.join(' ').match(/Password accepted/)) {
          irc.join(config.irc.channel);
          irc.removeListener('notice', tryLogin);
          // Resolve
          resolve();

          if (config.verbose) {
            console.log('successfully logged into irc');
          }
        }
      } catch (err) {
        console.error(err);
      }
    }

    irc.on('notice', tryLogin);
    irc.connect();
  });
}

/**
 * Formats text for output to Discord
 * @param {Message} input A message to convert
 * @return {string} String formatted for Discord
 */
function formatForDiscord(input) {
  return '**[' + input.source + ']** <' + input.user + '> ' + input.text;
}

/**
 * Formats text for output to IRC
 * @param {Message} input A message to convert
 * @return {string} String formatted for IRC
 */
function formatForIrc(input) {
  return '\x0f\x02[\x0302' + input.source + '\x0f\x02]\x0f <' + input.user + '> ' + input.text;
}

/**
 * Formats text for output to the console
 * @param {Message} input A message to convert
 * @return {string} String formatted for the console
 */
function formatForConsole(input) {
  return input.source + ',' + input.user + ': ' + input.text;
}

/**
 * Outputs to Discord
 * @param {string} str String to output
 */
function sendToDiscord(str) {
  discord.channels.get("name", config.discord.channel).send(str);
}

/**
 * Outputs to IRC
 * @param {string} str String to output
 */
function sendToIrc(str) {
  irc.say(config.irc.channel, str);
}

/**
 * Checks to see if a user is registered in IRC
 * @param {string} nick Nick of user to check
 * @return {Promise} Resolves with Boolean stating whether user is registered
 */
function ircUserRegistered(nick) {
  return new Promise(function(resolve, reject) {
    irc.whois(nick, function(info) {
      // Check if host is a IP, return opposite (i.e. not an IP)
      resolve(!info.host.match(/\d+\.\d+\.\d+\.\d+/));
    });
  });
}

Promise.all([loginDiscord(), loginIrc()])
  .catch(function(e) {
    console.error('failed to login ' + e);
    console.error(e.stack);
    throw e;
  })
  .then(function() {
    // Add Discord message listeners
    discord.on('message', function(message) {
      // Ignore messages from self
      if (message.author.id !== discord.user.id) {
        // Ignore PMs (don't want to be putting those everywhere)
        if (message.channel instanceof Discord.TextChannel) {
          // Create message, format, and send
          var m = new Message(message.content, message.author.username, 'D', true);
          Promise.resolve(m)
            .then(formatForIrc)
            .then(sendToIrc);

          if (config.verbose) {
            console.log(formatForConsole(m));
          }
        }
      }
    });
    // Add IRC message listeners
    irc.on('message' + config.irc.channel, function(nick, text, message) {
      // Ignore message from self
      if (nick !== irc.nick) {
        // Check if user is registered
        ircUserRegistered(nick)
          .then(function(authed) {
            // Create messafe, format, send
            var m = new Message(text, nick, 'I', authed);
            Promise.resolve(m)
              .then(formatForDiscord)
              .then(sendToDiscord);

            if (config.verbose) {
              console.log(formatForConsole(m));
            }
          });
      }
    });
  });
