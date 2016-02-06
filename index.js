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

class Message {
  constructor(value, nick, source, auth) {
    this.value = value;
    this.nick = nick;
    this.src = source;
    this.auth = new Boolean(auth);
  }

  get text() {
    return this.value;
  }

  get user() {
    return this.nick;
  }

  get source() {
    return this.src;
  }

  isAuth() {
    return this.auth;
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

function formatForDiscord(input) {
  return '**[' + input.source + ']** <' + input.user + '> ' + input.text;
}

function formatForIrc(input) {
  return '\x0f\x02[\x0302' + input.source + '\x0f\x02]\x0f <' + input.user + '> ' + input.text;
}

function formatForConsole(input) {
  return input.source + ',' + input.user + ': ' + input.text;
}

function sendToDiscord(str) {
  discord.channels.get("name", config.discord.channel).send(str);
}

function sendToIrc(str) {
  irc.say(config.irc.channel, str);
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
      if (nick !== irc.nick) {

        ircUserRegistered(nick)
          .then(function(authed) {
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
