// TODO:
// use regex to find lang strings in code blocks (in function `storeBlocks`)

// load discord.js and make a new client object
const fs = require("fs");
const Discord = require("discord.js");
const client = new Discord.Client();

// load config file
const config = require("./config");

// pastebin/etc domains
const domains = ["pastebin.com"];

// filenames
const codeLogFilename = "code.log";	// where to store collected code blocks
const pasteLogFilename = "urls.log";	// where to store pastebin/etc links

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

	// format the log entries
	const data = blocks.map(block => `${getLatestTimestamp(message)}\t${message.id}\t${message.author.tag}\t${block.lang}\t${tabNewlines(block.code)}`).join("\n");
	appendFile(codeLogFilename, data);	// and store them
}

// store away pastebin/etc urls
// message = source discord message object
// links = array of links
function storeLinks(message, links)
{
	// format the log entries
	const data = links.map(link => `${getLatestTimestamp(message)}\t${message.id}\t${message.author.tag}\t${link}`).join("\n");
	appendFile(pasteLogFilename, data);	// and store them
}

// just append data to file called filename
function appendFile(filename, data)
{
	fs.appendFile(filename, `${data}\n`, (e) => { if(e) throw e; });
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
	return [].concat.apply([], domains.map(domain => matchUrlWithDomain(string, domain)));
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
	process.exit(1);
}

// start bot with token from config file
function main()
{
	// login with supplied token
	client.login(config.token).catch(e => {
		console.error(e);
		exit("\nDid you put your login token in config.js?");
	});
}

// start
main();
