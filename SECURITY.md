# Security

## Reporting a vulnerability

Please don't open a public issue for a security problem. Use GitHub's
[private vulnerability reporting](https://github.com/kazarazat/chai-ui/security/advisories/new)
instead. You'll get a reply within a few days, and we'll agree on a
disclosure date once a fix is ready.

## Supported versions

Security fixes go into the latest published version of `@chai-ui/*`.

## Keeping API keys safe

Chai's engines never hold an API key: they call a route on your own server
(`createChaiHandler` from `@chai-ui/core/server`), which adds it. Never
pass a key to an engine or expose it through a `VITE_` or `NEXT_PUBLIC_`
variable. In production, set the handler's `authorize` and
`allowedModels`, or anyone who reaches your site can spend your API credit.
