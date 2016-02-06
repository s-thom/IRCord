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
  // TODO: login to discord
}

function loginIrc() {
  // TODO: login to irc
}

Promise.all([loginDiscord(), loginIrc()])
  .catch(function(e) {
    console.error('failed to login');
    throw e;
  })
  .then();
