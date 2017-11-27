// things that'd be nice to clean up:
//	make the history scanner also scan message revisions
// 	make `insertRow` generic (insert varable num of values into varable table; no case analysis)

// load discord.js and make a new client object
const fs = require("fs");
const sqlite3 = require("sqlite3");
const Discord = require("discord.js");
const client = new Discord.Client();

// load config file
const config = require("./config");

// the sqlite database to be opened
var database;

// open the database and assert the existance of the tables
// exit on failure
function prepareDatabase()
{
	// load the database from file
	database = new sqlite3.Database(config.dbFilename, e => {
		if(e) exit(`Error opening database: ${e}`);
	});

	// make sure a table exists and die on failure to create it
	function assertTable(table, columns)
	{
		database.run(`CREATE TABLE IF NOT EXISTS ${table}(${columns.join(", ")})`, e => {
			if(e) exit(`Error creating table "${table}": ${e}`);
		});
	}

	// assert the tables in the db
	assertTable("messages", ["id", "author"]);
	assertTable("revisions", ["id", "timestamp", "content"]);
};

// close the database if its open
function closeDatabase()
{
	if(database) database.close().catch(console.error);
}

// insert a row into a table
// i hope we can rewrite this function better :p
// should we die on failure to insert row or stay alive?
function insertRow(table, values)
{
	// i'm not sure how to do this SQL more generically,
	// to get rid of this case analysis
	// someone help? :P
	if(table === "messages")
	{
		database.run(`INSERT INTO messages(id, author) VALUES(?, ?)`,
			values, e => {
				if(e) console.error(`Error inserting row: ${e}`);
			});
	}
	else if(table === "revisions")
	{
		database.run(`INSERT INTO revisions(id, timestamp, content) VALUES(?, ?, ?)`,
			values, e => {
				if(e) console.error(`Error inserting row: ${e}`);
			});
	}
}

// get the latest timestamp for a message object
// that is, edited timestamp if its been edited
// else just the created timestamp
function getLatestTimestamp(message)
{
	return message.editedTimestamp || message.createdTimestamp;
}

// create a new entry in the database for this message
function createEntry(message)
{
	insertRow("messages", [message.id, message.author.tag]);
}

// add a revision to a message in the database
function storeRevision(message)
{
	insertRow("revisions", [message.id, getLatestTimestamp(message), message.content]);
}

// tab over newlines
function tabNewlines(string)
{
	return string.split("\n").map((line, i) => {
		return i ? `\t${line}` : line;
	}).join("\n");
}

// pretty print a received discord message to console
function logMessage(message, edit)
{
	// +tab newlines for readability
	const loggedMsg = tabNewlines(message.content);

	// string indicated this was an edit
	const e = edit ? "(edit) " : "";

	// if direct message (no guild)
	if(!message.guild) console.log(`${e}${message.author.tag}> ${loggedMsg}`);
	// if message from guild
	else console.log(`${e}${message.guild.name}> #${message.channel.name}> ${message.author.tag}> ${loggedMsg}`);
}

// return an array of all the code blocks contained in a string
function getCodeBlocks(string)
{
	const regex = /\`\`\`([a-z]*[\s\S]*?)\`\`\`/g;
	const result = [];
	var matches;
	while((matches = regex.exec(string)) !== null) result.push(matches[1]);
	return result;
}

// return an array of links of some domain in a string
function matchUrlWithDomain(string, domain)
{
	// copied this regex from stack overflow
	const regex = new RegExp("(https?:\\/\\/(.+?\\.)?" + domain + "(\\/[A-Za-z0-9\\-\\._~:\\/\\?#\\[\\]@!$&'\(\)\*\+,;\=]*)?)", "g");
	return string.match(regex) || [];
}

// return an array of pastebin/etc links contained in the string
function getLinks(string)
{
	// match urls of all the domains in the `domains` array
	return [].concat.apply([], config.domains.map(domain => matchUrlWithDomain(string, domain)));
}

// does this string contain a code block?
function containsCode(string)
{
	return getCodeBlocks(string).length;
}

// does this string contain a relevant url?
function containsUrl(string)
{
	return getLinks(string).length;
}

// scan chat history and process all past messages
function scanHistory()
{
	// here go through all the messages in the server
	// and pass them to processMessage (the function right below)
	console.log("Preparing to scan chat history...");

	// for every text channel of every guild the bot is in...
	client.guilds.forEach(guild => guild.channels
		.filter(channel => channel.type === "text").forEach(scanChannel));
}

// scan a text channel's history and process all messages
function scanChannel(channel)
{
	// ADD SCANNING FOR MESSAGE UPDATES/EDITS
	// i wonder how we should handle edits?
	// fetch messages recursively and then process them
	const limit = 100;	// how many to fetch at one time
	function fetch(before)
	{
		channel.fetchMessages({ limit: limit, before: before }).then(messages => {
			messages.forEach(processMessage);	// process each message normally
			// if there's still more to go, then fetch more and recurse!
			if(messages.size == limit) fetch(messages.last().id);
			else console.log(`Finished scanning channel #${channel.name}!`);
		}).catch(console.error);
	};
	console.log(`Scanning channel #${channel.name}...`);
	fetch();
}

// process a discord message
function processMessage(message, edit)
{
	// are we interested in this message?
	if(containsCode(message.content) || containsUrl(message.content))
	{
		// if this is a newly created message and needs to be freshly added to the db
		if(!edit) createEntry(message);
		// then store this revision
		storeRevision(message);
	}
}

// when the bot logs in successfully
client.on("ready", () => {
	console.log(`Logged in as ${client.user.tag}!`);
	// if configured to archive chat history on login...
	if(config.history) scanHistory();
});

// when a discord message is received
client.on("message", message => {
	logMessage(message);		// log the message to console
	processMessage(message);	// and process it normally
});

// when a discord message is edited
client.on("messageUpdate", (oldMessage, newMessage) => {
	logMessage(newMessage, true);		// log the message to console
	processMessage(newMessage, true);	// and process it normally
});

// exit with error message
function exit(message)
{
	console.error(message);
	closeDatabase();
	process.exit(1);
}

// start bot with token from config file
function main()
{
	// first open the database
	prepareDatabase();

	// login with supplied token
	client.login(config.token).catch(e => {
		exit(`Error logging in: ${e}\nDid you put your login token in config.js?`);
	});
}

// start
main();
