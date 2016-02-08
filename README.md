# IRCord

### A Discord <-> IRC bridge for Node.js

## Usage

As there is no NPM module yet (and probably won't be), you have to specify the path manually. You will also need to run `npm update` in IRCord's directory.

``` js
// Requre the module and config
const ircord = require('<PATH TO index.js>');
let config = require('<PATH TO config.json>');

// Create new bridge
let bridge = new ircord.Bridge(config);

// Start the bridge
bridge.build();

```

## Config Format

``` json
{
  "irc":{
      "server": "IRC SERVER IP",
      "nick": "NICK",
      "channel": "CHANNEL",
      "pass": "NICKSERV PASSWORD"
    },
  "discord":{
    "email": "EMAIL ADDRESS",
    "pass": "PASSWORD",
    "channel": "CHANNEL"
  }
}
```
