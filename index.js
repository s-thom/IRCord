/* jslint node: true, esversion: 6 */
var Discord = require('discord.js');
var IRC = require('irc');
var config = require('./config.json');

// Possibly change names, to reduce ambiguity with module and variable
var discord = new Discord.Client();
var irc = new IRC.Client(config.irc.server, config.irc.nick, {
  autoConnect: false
});

class Message {
  constructor(value, nick, auth) {
    this.text = value;
    this.user = nick;
    this.auth = new Boolean(auth);
  }

  get text() {
    return this.text;
  }

  get user() {
    return this.user;
  }

  isAuth() {
    return auth;
  }

}

function loginDiscord() {
  return new Promise(function(resolve, reject) {
    function onReady() {
      discord.removeListener('ready', onReady);

      if (config.verbose) {
        console.log('successfully logged into discord');
      }

      resolve();
    }
    discord.on('ready', onReady);
    discord.login(config.discord.email, config.discord.pass);
  });
}

function loginIrc() {
  return new Promise(function(resolve, reject) {
    function tryLogin(nick, to, text, message) {
      try {
        // Log in once NickSev sends the right messages
        if (nick === 'NickServ' && message.args.join(' ').match(/This nickname is registered and protected\./)) {
          irc.say('nickserv', 'identify ' + config.irc.pass);
        } else
        // When logged in, join the channels
        if (nick === 'NickServ' && message.args.join(' ').match(/Password accepted/)) {
          irc.join(config.irc.channel);
          irc.removeListener('notice', tryLogin);
          resolve();
        }
      } catch (err) {
        console.error(err);
      }
    }

    irc.on('notice', tryLogin);
    irc.connect();
  });
}

function formatForDiscord(str) {
  // TODO: Return properly formatted string
}

function formarForIrc(str) {
  // TODO: Return string
}

function sendToDiscord(str) {
  // TODO: Send
}

function sendToIrc(str) {
  // TODO: Send
}

function ircUserRegistered(nick) {
  return new Promise(function(resolve, reject) {
    irc.whois(nick, function(info) {
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
      if (message.author.id !== discord.user.id) {
        if (message.channel instanceof Discord.TextChannel) {
          if (config.verbose) {
            console.log('[D] ' + message.content);
          }

          Promise.resolve(message.content)
            // .then(console.log);
            .then(formarForIrc)
            .then(sendToIrc);
        }
      }
    });
    // Add IRC message listeners
    irc.on('message' + config.irc.channel, function(nick, text, message) {
      if (nick !== irc.nick) {
        if (config.verbose) {
          console.log('[I] ' + text);
        }

        Promise.resolve(text)
          // .then(console.log);
          .then(formatForDiscord)
          .then(sendToDiscord);
      }
    });
  });
