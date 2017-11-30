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

// get a row in a table
function selectRow(table, whereColumn, equals, callback)
{
	// is this safe?
	const sql = `SELECT * FROM ${table} WHERE ${whereColumn} = "${equals}"`;
	database.all(sql, [], (e, rows) => {
		if(e) exit(`Error querying database: ${e}`);
		else callback(rows);
	});
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
	return string.replace(regex, (match, p1, p2, p3, offset, string) =>
		`<div class="code">${p2 ? `<span class="lang">#${p2}</span><br />` : ""}${p3}</div>`);
}

// make html output for a message
function makeMessagePage(message, revisions)
{
	// just something for now, i don't know what we actually want to do
	const header = `
<span class="field">Message ID:</span> <span class="value">${message.msgId}</span><br />
<span class="field">Author:</span> <span class="value">${message.author}</span><br />
<span class="field">Channel:</span> <span class="value">${message.channel}</span><br />
	`;
	const body = revisions.map(revision => `
<span class="timestamp">${formatDate(revision.date)}</span>
<div class="messageBody">${formatMessage(revision.fullMessage)}</div>
	`).join("<br /><br />");

	return `
<style>
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
	${header}
	<br />
	${body}
</div>
	`;
}

// request a message by id
frontend.get("/code/:id", (request, response) => {
	// select the message by id
	selectRow("Message", "msgId", request.params.id, rows => {
		if(rows.length)
		{
			// assuming there's only one message per id
			// as there should be
			const message = rows[0];

			// select all the revisions of this message
			selectRow("Content", "associatedMsg", message.msgId, rows => {
				if(rows.length)
				{
					// should we sort in sqlite instead of here?
					// sort the revisions by timestamp
					const sorted = rows.sort((a, b) => a.date - b.date);

					// what should we actually be displaying here?
					// a pretty display for the user?
					// or some raw information?
					// also, should we just show the most recent revision?
					response.send(makeMessagePage(message, rows));
				}
				else response.send("No revisions found!");
			});
		}
		else response.send("Message not found!");
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
