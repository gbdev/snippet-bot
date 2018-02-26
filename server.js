// !! we should probably factor common code out into its own files?

// load express and make a new express app
const sqlite3 = require("sqlite3");
const express = require("express");
const frontend = express();

// load config file
const config = require("./config");

// the sqlite database to be opened
var database;

// open the database and assert the existance of the tables
// exit on failure
function prepareDatabase()
{
    // load the database from file
    database = new sqlite3.Database(config.dbFilename, sqlite3.OPEN_READONLY, e => {
	if(e) exit(`Error opening database: ${e}`);
    });
};

// close the database if its open
function closeDatabase()
{
    if(database) database.close().catch(console.error);
}

// take a timestamp and format it
function formatDate(timestamp)
{
    return new Date(timestamp).toUTCString();
}

// format a massege for code blocks
function formatMessage(string)
{
    const regex = /\`\`\`(([a-z]+)\n)?\n*([\s\S]*?)\n*\`\`\`/g;
    const s = string.replace(regex, (match, p1, p2, p3, offset, string) =>
			     `<div class="code">${p2 ? `<span class="lang">#${p2}</span><br />` : ""}${p3.replace(/\n/g, "<br />")}</div>`);
    // also parse inline `code` and urls
    return s;
}

// make html output for a message
function makeMessagePage(rows)
{
    const body = rows.map(row => `
<a class="perma" href="/code?msgId=${row.msgId}">permalink</a><br />
Author: ${row.author}<br />
Channel: ${row.channel}<br />` + row.revisions.map(revision => `
<span class="timestamp">${formatDate(revision.date)}</span>
<div class="messageBody">${formatMessage(revision.fullMessage)}</div>
	`).join("<br /><br />")).join("<br /><br />");

    return `
<style>
.perma
{
	font-size: small;
}
.wrapper
{
	width: 400px;
}
.field
{
	font-weight: bold;
}
.timestamp
{
	font-size: small;
	font-style: italic;
}
.lang
{
	font-style: italic;
	font-size: small;
	background-color: #999;
	color: #FFF;
}
.messageBody
{
	color: #111;
	background-color: #EEE;
	border: solid 1px #CCC;
	border-radius: 3px;
	padding: 8px;
}
.code
{
	font-family: monospace;
	color: #EEE;
	background-color: #555;
	border: solid 1px #222;
	border-radius: 3px;
	padding: 3px;
}
</style>

<div class="wrapper">
	${body}
</div>
	`;
}

// search page
frontend.get("/", (request, response) => {
    const sql = `SELECT DISTINCT author FROM Message`;
    database.all(sql, [], (e, authors) => {
	if(e) exit(`Error querying database: ${e}`);
	else
	{
	    const sql = `SELECT DISTINCT channel FROM Message`;
	    database.all(sql, [], (e, channels) => {
		if(e) exit(`Error querying database: ${e}`);
		else
		{
		    response.send(`
<form action="/code/">
<label for="author">Author</label>
<select id="author" name="author">
<option value="">*</option>
${authors.map(author => `<option value="${author.author}">${author.author}</option>`).join("")}
</select><br />
<label for="channel">Channel</label>
<select id="channel" name="channel">
<option value="">*</option>
${channels.map(channel => `<option value="${channel.channel}">${channel.channel}</option>`).join("")}
</select><br />
<label for="from">From</label>
<input id="from" name="from" type="date"><br />
<label for="to">To</label>
<input id="to" name="to" type="date"><br />
<label for="as">As</label>
<select id="as" name="as">
<option value="">Webpage</option>
<option value="json">JSON</option>
</select><br />
<input type="submit">
</form>
`);
		}
	    });
	}
    });
});

function strtotime(string)
{
    return new Date(string).getTime();
}

// filter messages query
frontend.get("/code/", (request, response) => {
    var sql = `SELECT * FROM Message`;
    const bindings = [];

    var kw = "WHERE";
    if(request.query.author)
    {
	sql += ` ${kw} author = ?`;
	bindings.push(request.query.author);
	kw = "AND";
    }
    if(request.query.channel)
    {
	sql += ` ${kw} channel = ?`;
	bindings.push(request.query.channel);
	kw = "AND";
    }
    if(request.query.msgId)
    {
	sql += ` ${kw} msgId = ?`;
	bindings.push(request.query.msgId);
	kw = "AND";
    }
    
    database.all(sql, bindings, (e, messageRows) => {
	if(e) exit(`Error querying database: ${e}`);
	else
	{
	    const sql = `SELECT * FROM Content`;
	    database.all(sql, [], (e, contentRows) => {
		if(e) exit(`Error querying database: ${e}`);
		else
		{
		    var rows = messageRows;
		    rows = rows.map(row => {
			row.revisions = contentRows
			    .filter(revision => revision.associatedMsg === row.msgId);
			delete row.revisions.associatedMsg;
			return row;
		    });
		    if(request.query.from)
			rows = rows.filter(row => row.revisions[0].date >= strtotime(request.query.from));
		    if(request.query.to)
			rows = rows.filter(row => row.revisions[0].date < strtotime(request.query.to));
		    if(request.query.as === "json") response.send(rows);
		    else response.send(makeMessagePage(rows));
		};
	    });
	};
    });
});

// exit with error message
function exit(message)
{
    console.error(message);
    closeDatabase();
    process.exit(1);
}

// start the server!
function main()
{
    // open the database
    prepareDatabase();

    // start the server listening
    frontend.listen(config.port, () => console.log(`Server running on port ${config.port}!`));
}

// go!
main();
