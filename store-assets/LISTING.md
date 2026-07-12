# Chrome Web Store listing — Panopto Summarizer

## Short description (max 132 chars)

Turn any Panopto lecture into notes, bullet points, or a quiz using your own OpenAI or Gemini key. Everything stays local.

## Detailed description

Panopto Summarizer reads the captions from the Panopto lecture you're watching and turns
them into a clean, readable summary in one click. You bring your own OpenAI or Gemini API
key, and your key, captions, and summaries never leave your browser except in the single
request to the provider you pick.

What it does:

- Summarize the active Panopto lecture in one click, with the result opened in a new tab.
- Choose how the summary is written: Bullet Points, Summary, Quiz Creator, Study Guide,
  Detailed Notes, or Custom Instruction Only.
- Add your own custom instruction, or blend it with a preset using the Prompt Behavior control.
- Copy the sanitized caption transcript to your clipboard.
- Export any summary as a Markdown file, or send it straight into an Obsidian vault.
- Keep your recent summaries in a local history list and reopen them anytime.

Bring your own key:

The extension does not include an API key and does not run any server of its own. You add
your OpenAI or Gemini key in Settings, and it is stored only in this browser profile via
chrome.storage.local. Captions are read from the active Panopto tab only when you click
Summarize or Copy Captions, and the transcript is sent directly to the provider you select.
Summaries and history stay on your device and can be cleared at any time.

Requires: a Panopto lecture with captions available, and your own OpenAI or Gemini API key.

## Screenshots — upload order and captions

All screenshots are 1280x800 PNG, no alpha.

1. screenshot-1.png — "Summarize any Panopto lecture in one click"
2. screenshot-2.png — "Readable summaries you can study from"
3. screenshot-3.png — "Bring your own key — nothing leaves your browser"
4. screenshot-4.png — "Bullet points, quizzes, or your own prompt"
5. screenshot-5.png — "Export to Markdown or Obsidian"

## Promo images

- tile-440x280.png — 440x280 small promo tile (icon + name + one-liner), no alpha.
- marquee-1400x560.png — 1400x560 marquee promo (icon badge + wordmark + one-liner +
  feature row on the left, popup cropped at the right edge), no alpha.

## Notes for the store dashboard

- Category: Productivity.
- Provide a privacy policy URL (required because the extension handles the user's API key
  and lecture transcript text). State the BYOK flow: keys stored locally, transcript sent
  only to the user-selected provider, no third-party servers.
- In the data-use disclosure, declare that the extension handles "Personal communications"
  or "User activity" only insofar as lecture caption text is sent to the chosen AI provider
  at the user's request, and that authentication information (the API key) is stored locally.
- Permissions justification: activeTab + scripting to read captions from the current Panopto
  tab on demand; storage to save the API key, preferences, and local history; host access to
  panopto.com (read captions), api.openai.com and generativelanguage.googleapis.com (send the
  transcript for summarization).
