/* jslint node: true, esversion: 6 */
var Discord = require('discord.js');
var IRC = require('irc');
var config = require('./config.json');

// Possibly change names, to reduce ambiguity with module and variable
var discord = new Discord.Client();
var irc = new IRC.Client(config.irc.server, config.irc.nick, {
  autoConnect: false
});

function loginDiscord() {
  return new Promise(function(resolve, reject) {
    // TODO: login to discord
  });
}

function loginIrc() {
  return new Promise(function(resolve, reject) {
    // TODO: login to irc
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

Promise.all([loginDiscord(), loginIrc()])
  .catch(function(e) {
    console.error('failed to login');
    throw e;
  })
  .then(function() {
    // Add Discord message listeners
    discord.on('message', function(message) {
      if (message.channel instanceof Discord.TextChannel) {
        if (config.verbose) {
          console.log('[D] ' + message.content);
        }

        new Promise(message.content)
          .then(formarForIrc)
          .then(sendToIrc);
      }
    });
    // Add IRC message listeners
    irc.on('message#' + config.irc.channel, function(nick, to, text, message) {
      if (config.verbose) {
        console.log('[I] ' + text);
      }

      new Promise(text)
        .then(formatForDiscord)
        .then(sendToDiscord);
    });
  });
