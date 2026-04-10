# Panopto Summarizer

"I will always choose a lazy person to do a difficult job. Because, he will find an easy way to do it." - Bill Gates

## 1) Clone

```bash
git clone git@github.com:aiden-lee11/panopto-summaries.git
cd panopto
```

## 2) Open Chrome Extensions

1. Open Chrome.
2. Go to `chrome://extensions`.
3. Turn on **Developer mode** (top-right).

## 3) Load the extension

1. Click **Load unpacked**.
2. Select the `extension/` folder in this project.

## 4) Set API keys

1. In `chrome://extensions`, find **Panopto Summarizer**.
2. Click **Details**.
3. Click **Extension options**.
4. Paste your key(s):
   - OpenAI key in **OpenAI API Key**
   - Gemini key in **Gemini API Key** (optional)
5. Click **Save Settings**.

## 5) Use it

1. Open a Panopto lecture page.
2. Click the extension icon.
3. Pick provider (OpenAI or Gemini).
4. Click **Summarize Current Lecture**.

## 6) Export / fork

- Click **Export .md** to download a markdown file.
- Click **Export to Obsidian** to send the summary into Obsidian via `obsidian://`.

### Connecting to Obsidian

Obsidian export uses a two-step connection flow:

1. First select the actual vault root folder. This is used to capture the real Obsidian vault name.
2. Then select an optional destination folder inside that vault. This is stored as a vault-relative subfolder path.

Why this is required:

- Obsidian URIs expect `vault` to be the real vault name, not an arbitrary folder inside the vault.
- The destination folder must be passed separately as part of the note path inside the vault.
- If you pick only a subfolder as though it were the vault, Obsidian will usually fail because that folder is not itself a registered vault.

In practice, the export is built like this:

- `vault` = your selected vault root name
- `file` = `optional/subfolder/Lecture Title.md`

## 7) Reload after code changes

1. Go to `chrome://extensions`.
2. Click **Reload** on the extension card.
