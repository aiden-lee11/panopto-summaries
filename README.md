# Panopto Summarizer Extension (Local)

## 1) Clone

```bash
git clone <your-repo-url>
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

1. In `chrome://extensions`, find **Panopto Lecture Summarizer (Local)**.
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
- Click **Fork to ChatGPT** to open ChatGPT and inject context.

## 7) Reload after code changes

1. Go to `chrome://extensions`.
2. Click **Reload** on the extension card.
