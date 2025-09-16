![Showcase Card](/public/static/twitter-card.webp)

<div align="center">

# Chat Replay Archive
Public repository of chat replays for [vods.ltwilson.tv](https://vods.ltwilson.tv)!

</div>

## About this repo.

This repository is purely to store the chatlogs from my livestreams and make them publicly accessible as an archive. They are also used to display them in real time for VODS on [vod-archive](https://github.com/theltwilson/vod-archive) project.

This repo is just an archive, but the contents within this archive shall not be used to train AI models as defined by the [MIT NON-AI License](LICENSE).

## How does it work?

Each `.json` file contains all the necessary information needed to recreate chat history programatically. Using the [Twitch Downloader](https://github.com/lay295/TwitchDownloader) project, I can download the chatlog and subsequently sort it to be committed to this repo.

The database used by my VOD archive simply needs a URL that points to wherever the `.json` file is hosted. The UI will fetch for this file and then display the chat messages in real time to sync with the VOD.

I am aware that this is not the most efficient way to handle this, but this is cheap (free) and works for me.
