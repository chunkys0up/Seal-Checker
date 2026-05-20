**Seal Checker** is a moderation tool that automatically enforces source requirements on posts.Seal Checker is a moderation tool that automatically enforces source requirements on posts. If a post is missing a URL, the bot prompts OP to provide one within a set time limit or the post will be locked, deleted, or reported based on your configuration.

When a post is submitted without a URL, Seal Checker drops a bot comment notifying OP and starting a countdown. If OP replies with a URL in time, the bot comment updates to reflect the provided sources, with unverified domains flagged to mods automatically. If no URL is provided before the timer expires, the configured action is taken.

Seal Checker comes with a prebuilt list of trusted domains covering major news outlets and research journals. You can add your own on top of the default list, or replace it entirely via app settings.

# **Settings**, accessible via the Developer Platform app portal:

- Flairs that require a URL source
- Time limit for OP to provide a URL (in minutes)
- Action on expiry: lock, delete, or report
- Custom trusted domains, with the option to overwrite the default list

# Default List
- reuters.com
- apnews.com
- bbc.com
- nytimes.com
- theguardian.com
- npr.org
- cnn.com
- axios.com
- bloomberg.com
- forbes.com
- ft.com
- scientificamerican.com
- nature.com
- who.int
- cdc.gov
- nih.gov
- pewresearch.org
- brookings.edu
- arxiv.org

## Github Repo
https://github.com/chunkys0up/Seal-Checker

## Changelog
### v0.0.5 – May 2026
- Switched from flair names to flair id in settings to better represent individual flairs