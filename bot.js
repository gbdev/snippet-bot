#!/usr/bin/env node

// load discord.js and make a new client object
const fs = require("fs");
const Discord = require("discord.js");
const client = new Discord.Client();

// pastebin/etc domains
const domains = ["pastebin.com"];

// filenames
const codeLogFilename = "code.txt"	// where to store collected code blocks
const pasteLogFilename = "urls.txt"	// where to store pastebin/etc links

// store away collected code blocks
// poster = discord user tag
// blocks = array of code blocks
function storeBlocks(poster, blocks)
{
	// format the log entries
	const data = blocks.map((block) => `${poster}\t${tabNewlines(block)}`).join("\n");
	appendFile(codeLogFilename, data);	// and store them
}

// store away pastebin/etc urls
// poster = discord user tag
// links = array of links
function storeLinks(poster, links)
{
	// format the log entries
	const data = links.map((link) => `${poster}\t${link}`).join("\n");
	appendFile(pasteLogFilename, data);	// and store them
}

// just append data to file called filename
function appendFile(filename, data)
{
	fs.appendFile(filename, `${data}\n`, (e) => { if(e) throw e });
}

// tab over newlines
function tabNewlines(string)
{
	return string.split("\n").map((line, i) => {
		return i ? `\t${line}` : line;
	}).join("\n");
}

// pretty print a received discord message to console
function logMessage(message)
{
	// +tab newlines for readability
	const loggedMsg = tabNewlines(message.content);

	// if direct message (no guild)
	if(!message.guild) console.log(`${message.author.tag}> ${loggedMsg}`);
	// if message from guild
	else console.log(`${message.guild.name}> #${message.channel.name}> ${message.author.tag}> ${loggedMsg}`);
}

// return an array of all the code blocks contained in a string
function getCodeBlocks(string)
{
	// how to make it only collect whats in ( and ) ?
	// so we don't have to explicitely chop off the code block delimiters?
	const regex = /\`\`\`([a-z]*[\s\S]*?)\`\`\`/g;
	return (string.match(regex) || []).map((s) => s.slice(3, -3));
}

// return an array of links of some domain in a string
function matchDomain(string, domain)
{
	// copied this regex from stack overflow
	const regex = new RegExp("(https?:\\/\\/(.+?\\.)?" + domain + "(\\/[A-Za-z0-9\\-\\._~:\\/\\?#\\[\\]@!$&'\(\)\*\+,;\=]*)?)", "g");
	return string.match(regex) || [];
}

// return an array of pastebin/etc links contained in the string
function getLinks(string)
{
	// match urls of all the domains in the `domains` array
	return [].concat.apply([], domains.map((domain) => matchDomain(string, domain)));
}

// when the bot logs in successfully
client.on("ready", () => {
	console.log(`Logged in as ${client.user.tag}!`);
});

// when a discord message is received
client.on("message", message => {
	logMessage(message);				// log the message to console
	const blocks = getCodeBlocks(message.content);	// get code blocks in message
	const links = getLinks(message.content);	// collect pastebin/etc links
	// store away the collected blocks and links (with person who posted them)
	if(blocks.length) storeBlocks(message.author.tag, blocks);
	if(links.length) storeLinks(message.author.tag, links);
});

// start bot with token from command line
function main()
{
	// grab the login token from the command line args
	if(process.argv.length >= 3)
	{
		const token = process.argv[2];
		client.login(token);
	}
	else console.error("Please supply the login token!");
}

// start
main();
