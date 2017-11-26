// things that'd be nice to clean up:
// 	use regex to find lang strings in code blocks (in function `storeBlocks`)
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

	// assert the snippets and links tables
	// (snippets table for code snippets)
	// (links table for collected pastebin/etc urls)
	assertTable("snippets", [id, timestamp, author, lang, code]);
	assertTable("links", [id, timestamp, author, url]);
};

// close the database if its open
function closeDatabase()
{
	// should we check if its actually open?
	if(database) database.close();
}

// insert a row into a table
// i hope we can rewrite this function better :p
// should we die on failure to insert row or stay alive?
function insertRow(table, values)
{
	// i'm not sure how to do this SQL more generically,
	// to get rid of this case analysis
	// someone help? :P
	if(table === "snippets")
	{
		database.run(`INSERT INTO snippets(id, timestamp, author, lang, code) VALUES(?, ?, ?, ?, ?)`,
			values, e => {
				if(e) console.error(`Error inserting row: ${e}`);
			});
	}
	else if(table === "links")
	{
		database.run(`INSERT INTO links(id, timestamp, author, url) VALUES(?, ?, ?, ?)`,
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

// store away collected code blocks
// message = source discord message object
// blockStrings = array of code block strings
function storeBlocks(message, blockStrings)
{
	// create block objects from the block strings
	// block.code = code string
	// block.lang = language string, if present (otherwise null)
	const blocks = blockStrings.map(string => {
		// check if theres a language string
		// do this in regex instead? instead of uglily hacking up strings manually haha
		// if at least 3 lines (or 2nd line isnt empty), and first line is one word
		// then the lang string is the first line
		if((string.split("\n").length >= 3 ||
		   (string.indexOf("\n") != -1 && string.split("\n")[1] != "")) &&
		   string.split("\n")[0].split(" ").length == 1)
			return { code: string.split("\n").slice(1).join("\n"),
				 lang: string.split("\n")[0] };
		else return { code: string, lang: null };
	});

	// insert code blocks into snippets table
	blocks.forEach(block => insertRow("snippets",
		[message.id, getLatestTimestamp(message), message.author.tag, block.lang, block.code]));
}

// store away pastebin/etc urls
// message = source discord message object
// links = array of links
function storeLinks(message, links)
{
	// insert links into links table
	links.forEach(link => insertRow("links",
		[message.id, getLatestTimestamp(message), message.author.tag, link]));
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
	// how to make it only collect whats in ( and ) ?
	// so we don't have to explicitely chop off the code block delimiters?
	const regex = /\`\`\`([a-z]*[\s\S]*?)\`\`\`/g;
	return (string.match(regex) || []).map(s => s.slice(3, -3));
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
function processMessage(message)
{
	const blocks = getCodeBlocks(message.content);	// get code blocks in message
	const links = getLinks(message.content);	// collect pastebin/etc links
	// store away the collected blocks and links (with person who posted them)
	if(blocks.length) storeBlocks(message, blocks);
	if(links.length) storeLinks(message, links);
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
	logMessage(newMessage, true);	// log the message to console
	processMessage(newMessage);	// and process it normally
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
