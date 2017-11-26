# snippet-bot
A discord bot archiving code blocks and links to pastebin-like snippets

## Deploy

Clone the repository with `git clone https://github.com/dmg01/snippet-bot`.

Install dependencies with `npm install`. You may see `UNMET PEER DEP` errors or warnings, ignore them.

Create the configuration file `config.js` and add your token as follows:
```javascript
const config = {};
module.exports = config;

config.domains = ["pastebin.com"];      // pastebin/etc domans
config.dbFilename = "database.db";      // the database file to store the collection
config.history = false;                 // archive chat history on login
config.token = "MzY2Mjk4NDEyNDQzODkzNzYx.DPzAWQ.-7THWqTuB_UEPaeOanRUtYejhdI";   // discord login token
```

Run the bot with `npm start`.
