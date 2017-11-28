### Database logical design

Message

- `msgId`
- `channel`
- `author`


Content

- `FullMessage`
- `codeSnippet`
- `date`
- `language`
- `associatedMsg`


Each instance of Content represent a revision of the posted message.