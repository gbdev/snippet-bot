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
config.parse = false;                   // archive chat history on login
config.oneshot = false;                 // quit after archiving chat history
config.port = 8080;                     // the port to server the http frontend on
config.token = "PUT YOUR TOKEN HERE";   // discord login token
```

Run the bot with `npm run bot`.

Run the server with `npm run server`.
