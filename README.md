<div align="center">

# Chatlogs
A frontend to browse Twitch chat logging services, including your own.

</div>

## About this repo.
This is a project that let's you neatly manage and view the Twitch chatlogs of various channels that you frequent. It takes a lot of inspiration from [Peepochat](https://github.com/rcwowo/peepochat)'s interface to feel familiar while serving a different focus.

The project itself works by querying multiple built-in [rustlog-compatible](https://github.com/boring-nick/rustlog) APIs, while also having the ability to add your own sources in the event that you self-host your own logs, or just want to add a different server.

> [!NOTE]
> This project is purely a frontend with a few pre-defined servers. It does NOT serve as a host for any chatlogs.

## How do I modify this?

Since this project is entirely client-side, you can run it very easily.

```bash
# Clone the repo
git clone https://github.com/rcwowo/chatlogs

# Install dependencies
cd chatlogs && bun install

# Run the test server
bun dev
```
