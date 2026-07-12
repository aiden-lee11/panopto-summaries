#!/usr/bin/env python3
"""Generate self-contained 1280x800 store screenshot stages for Panopto Summarizer."""
import os

HERE = os.path.dirname(os.path.abspath(__file__))

with open(os.path.join(HERE, ".icon-b64.txt")) as f:
    ICON = f.read().strip()

ARROW = ("url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' "
         "height='12' viewBox='0 0 24 24' fill='none' stroke='%237a8493' stroke-width='2.5' "
         "stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")")

STYLE = """
:root {
  --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }

/* ---- shared design tokens (light) ---- */
.stage {
  --accent: #2b6cf0;
  --accent-hover: #1f5be0;
  --bg: #ffffff;
  --bg-elev: #f4f6f9;
  --text: #1a1c1f;
  --text-muted: #5b6572;
  --border: #e4e7ec;
  --border-strong: #d0d5dd;
  --shadow: 0 1px 2px rgba(16,24,40,0.10);
  --card-shadow: 0 24px 60px -20px rgba(16,32,72,0.35), 0 6px 18px -8px rgba(16,32,72,0.18);
  --bg-page: #eaeef6;
  --page-behind: #f7f9fc;
  --glow: rgba(43,108,240,0.16);
  --grid: rgba(24,48,96,0.055);
}
.stage.dark {
  --accent: #4d86ff;
  --accent-hover: #6a99ff;
  --bg: #1a1d24;
  --bg-elev: #22262f;
  --text: #e8eaed;
  --text-muted: #9aa3b0;
  --border: #2d313b;
  --border-strong: #3c414d;
  --shadow: 0 1px 2px rgba(0,0,0,0.5);
  --card-shadow: 0 30px 70px -20px rgba(0,0,0,0.65), 0 8px 20px -8px rgba(0,0,0,0.5);
  --bg-page: #0f1116;
  --page-behind: #14171d;
  --glow: rgba(77,134,255,0.20);
  --grid: rgba(255,255,255,0.045);
}

/* ---- stage layout ---- */
.stage {
  position: relative;
  width: 1280px;
  height: 800px;
  overflow: hidden;
  display: flex;
  align-items: center;
  font-family: var(--font);
  background:
    radial-gradient(1100px 760px at 82% -12%, var(--glow), transparent 62%),
    var(--bg-page);
}
.stage::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(var(--grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid) 1px, transparent 1px);
  background-size: 40px 40px;
  -webkit-mask-image: radial-gradient(1000px 700px at 60% 40%, #000 55%, transparent 100%);
  mask-image: radial-gradient(1000px 700px at 60% 40%, #000 55%, transparent 100%);
  pointer-events: none;
}
.stage-copy {
  position: relative;
  z-index: 1;
  flex: 0 0 430px;
  padding: 0 32px 0 72px;
}
.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 22px;
  padding: 7px 14px 7px 8px;
  border-radius: 999px;
  background: var(--bg);
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}
.eyebrow img { width: 22px; height: 22px; border-radius: 5px; }
.headline {
  margin: 0 0 20px;
  font-size: 40px;
  line-height: 1.08;
  font-weight: 720;
  letter-spacing: -0.022em;
  color: var(--text);
}
.subhead {
  margin: 0;
  font-size: 19px;
  line-height: 1.5;
  color: var(--text-muted);
  max-width: 32ch;
}
.stage-visual {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 60px 0 0;
}

/* ---- browser window frame ---- */
.browser {
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--bg);
  box-shadow: var(--card-shadow);
}
.browser-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 16px;
  background: var(--bg-elev);
  border-bottom: 1px solid var(--border);
}
.dots { display: flex; gap: 7px; }
.dot { width: 11px; height: 11px; border-radius: 50%; }
.dot.r { background: #ff5f57; }
.dot.y { background: #febc2e; }
.dot.g { background: #28c840; }
.omni {
  flex: 1;
  height: 26px;
  border-radius: 7px;
  background: var(--bg);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  font-size: 12.5px;
  color: var(--text-muted);
}
.omni .lock { width: 11px; height: 11px; border-radius: 2px; border: 1.6px solid var(--text-muted); position: relative; }
.ext-chip {
  width: 26px; height: 26px; border-radius: 7px;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid var(--border);
  background: var(--bg);
}
.ext-chip img { width: 18px; height: 18px; border-radius: 4px; }

/* popup shot: page behind + floating popup */
.canvas {
  position: relative;
  height: 724px;
  background: var(--page-behind);
  overflow: hidden;
}
.mock-page { position: absolute; inset: 0; padding: 26px 28px; }
.mock-video {
  height: 264px; border-radius: 12px;
  background: linear-gradient(135deg, #2a3550, #47597f);
  display: flex; align-items: center; justify-content: center;
}
.stage.dark .mock-video { background: linear-gradient(135deg, #1f2740, #33415f); }
.play { width: 64px; height: 64px; border-radius: 50%; background: rgba(255,255,255,0.16); display:flex; align-items:center; justify-content:center; }
.play::after { content:""; border-style: solid; border-width: 13px 0 13px 22px; border-color: transparent transparent transparent rgba(255,255,255,0.92); margin-left: 5px; }
.mock-title { height: 20px; width: 62%; border-radius: 6px; background: var(--border-strong); margin-top: 22px; opacity: .8; }
.mock-line { height: 12px; border-radius: 6px; background: var(--border); margin-top: 13px; }
.floating { position: absolute; top: 16px; right: 18px; }

/* ---- popup component ---- */
.popup {
  width: 360px;
  background: var(--bg);
  color: var(--text);
  font: 13px/1.45 var(--font);
  border-radius: 14px;
  border: 1px solid var(--border);
  box-shadow: var(--card-shadow);
  overflow: hidden;
}
.popup .wrap { padding: 16px; }
.popup .app-header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
.popup .app-logo { width: 26px; height: 26px; border-radius: 6px; }
.popup h1 { margin: 0; font-size: 15px; font-weight: 650; letter-spacing: -0.01em; }
.popup .field-label { display: block; margin: 0 0 7px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); }
.popup .prompt-row { margin-bottom: 12px; }
.popup .provider-row { display: flex; margin-bottom: 16px; padding: 3px; background: var(--bg-elev); border: 1px solid var(--border); border-radius: 10px; }
.popup .provider-option { flex: 1; display: flex; align-items: center; justify-content: center; padding: 6px 8px; border-radius: 7px; font-weight: 600; color: var(--text-muted); }
.popup .provider-option.checked { background: var(--bg); color: var(--text); box-shadow: var(--shadow); }
.popup select, .popup textarea {
  width: 100%; padding: 8px 10px; border: 1px solid var(--border-strong);
  border-radius: 7px; background: var(--bg); color: var(--text); font: inherit;
}
.popup select {
  appearance: none; -webkit-appearance: none;
  background-image: __ARROW__; background-repeat: no-repeat;
  background-position: right 10px center; padding-right: 30px;
}
.popup textarea { min-height: 46px; resize: none; }
.popup .actions { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
.popup .btn-row { display: flex; gap: 8px; }
.popup .btn-row .secondary { flex: 1; }
.popup button {
  border: 1px solid transparent; background: var(--accent); color: #fff;
  border-radius: 7px; padding: 9px 12px; font: inherit; font-weight: 600; cursor: pointer;
}
.popup #summarizeBtn { width: 100%; }
.popup button.secondary { background: var(--bg); color: var(--text); border-color: var(--border-strong); }
.popup .io { background: var(--bg-elev); border: 1px solid var(--border); border-radius: 10px; padding: 12px; margin-bottom: 12px; }
.popup #status { margin: 0; font-weight: 600; }
.popup #output { margin: 6px 0 0; font-size: 12px; color: var(--text-muted); }
.popup .history { margin-top: 4px; border-top: 1px solid var(--border); padding-top: 12px; }
.popup .history-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.popup .history h2 { margin: 0; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); }
.popup .history-header .secondary { padding: 5px 10px; font-size: 12px; }
.popup #historyList { display: flex; flex-direction: column; gap: 5px; }
.popup .history-item { text-align: left; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 7px; padding: 8px 10px; font-weight: 500; font-size: 12px; line-height: 1.4; }

/* ---- options / summary page component ---- */
.page { color: var(--text); font: 14px/1.5 var(--font); }
.page.opt { padding: 26px 30px; }
.page.opt .lede { margin: 0 0 18px; color: var(--text-muted); font-size: 13.5px; }
.page.opt .app-header { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.page.opt .app-logo { width: 38px; height: 38px; border-radius: 9px; }
.page.opt h1 { margin: 0; font-size: 22px; font-weight: 680; letter-spacing: -0.015em; }
.card {
  background: var(--bg); border: 1px solid var(--border); border-radius: 12px;
  padding: 18px 20px; margin-bottom: 14px; box-shadow: var(--shadow);
}
.card h2 { margin: 0 0 3px; font-size: 15px; font-weight: 650; }
.card .desc { margin: 0 0 14px; color: var(--text-muted); font-size: 13px; }
.card label { display: block; margin: 14px 0 6px; font-size: 13px; font-weight: 600; }
.card .field:first-child label { margin-top: 0; }
.card .control {
  width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-strong);
  background: var(--bg); color: var(--text); font: inherit; display: flex; align-items: center;
}
.card select.control {
  appearance: none; -webkit-appearance: none; display: block;
  background-image: __ARROW__; background-repeat: no-repeat; background-position: right 12px center; padding-right: 34px;
}
.card .control.muted { color: var(--text-muted); }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.grid2 label { margin-top: 0; }
code {
  font-family: var(--mono); font-size: 0.9em; background: var(--bg-elev);
  border: 1px solid var(--border); border-radius: 4px; padding: 1px 5px;
}

/* summary page */
.page.sum { padding: 30px 34px; }
.page.sum h1 { margin: 0 0 6px; font-size: 24px; font-weight: 680; letter-spacing: -0.015em; }
.page.sum h2 { margin: 20px 0 8px; font-size: 17px; font-weight: 650; }
.page.sum .meta { margin: 0 0 18px; padding-bottom: 16px; border-bottom: 1px solid var(--border); color: var(--text-muted); font-size: 13px; }
.page.sum ul { margin: 0; padding-left: 22px; }
.page.sum li { margin-bottom: 7px; line-height: 1.55; }
.page.sum .toolbar {
  display: flex; flex-wrap: wrap; gap: 10px; align-items: center;
  margin: 0 0 22px; padding: 12px; background: var(--bg-elev);
  border: 1px solid var(--border); border-radius: 10px;
}
.page.sum .toolbar button {
  border: 1px solid var(--border-strong); background: var(--bg); color: var(--text);
  border-radius: 8px; padding: 8px 14px; font: inherit; font-weight: 600;
}
.page.sum .toolbar button.primary { background: var(--accent); border-color: transparent; color: #fff; }
.page.sum .toolbar .sep { width: 1px; align-self: stretch; background: var(--border-strong); }
.page.sum .toolbar .note { color: var(--text-muted); font-size: 13px; }
.page.sum .captions { margin-top: 22px; border: 1px solid var(--border); border-radius: 10px; padding: 12px 16px; background: var(--bg-elev); }
.page.sum .captions .summary-row { display: flex; align-items: center; gap: 8px; font-weight: 600; }
.page.sum .captions .caret { color: var(--text-muted); }
""".replace("__ARROW__", ARROW)


def doc(title, dark, body):
    cls = "stage dark" if dark else "stage"
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>{title}</title>
<style>{STYLE}</style>
</head>
<body>
<div class="{cls}">
{body}
</div>
</body>
</html>
"""


def eyebrow():
    return f'<div class="eyebrow"><img src="{ICON}" alt="" /> Panopto Summarizer</div>'


def copy_col(headline, subhead):
    return f"""  <div class="stage-copy">
    {eyebrow()}
    <h1 class="headline">{headline}</h1>
    <p class="subhead">{subhead}</p>
  </div>"""


def popup_markup(*, preset_selected, behavior_selected, custom_text, status, output, history, show_custom=True):
    def opt(v, label, sel):
        return f'<option{" selected" if v == sel else ""}>{label}</option>'
    presets = [
        ("Custom Instruction Only", "custom_instruction_only"),
        ("Bullet Points", "bullet_points"),
        ("Summary", "summary"),
        ("Quiz Creator", "quiz_creator"),
        ("Study Guide", "study_guide"),
        ("Detailed Notes", "detailed_notes"),
    ]
    behaviors = [
        ("Custom Instruction Only (primary)", "custom_only"),
        ("Preset + custom guidance", "append_guidance"),
        ("No custom prompt (preset only)", "no_custom_prompt"),
    ]
    preset_html = "".join(opt(v, l, preset_selected) for l, v in presets)
    beh_html = "".join(opt(v, l, behavior_selected) for l, v in behaviors)
    custom_block = ""
    if show_custom:
        custom_block = f"""
      <div class="prompt-row">
        <label class="field-label">Custom Instruction (override)</label>
        <textarea>{custom_text}</textarea>
      </div>"""
    hist_items = "".join(f'<button class="history-item">{h}</button>' for h in history)
    return f"""<div class="popup">
    <div class="wrap">
      <div class="app-header"><img class="app-logo" src="{ICON}" alt="" /><h1>Panopto Summarizer</h1></div>
      <div class="provider-row">
        <div class="provider-option checked">OpenAI</div>
        <div class="provider-option">Gemini</div>
      </div>
      <div class="prompt-row">
        <label class="field-label">Prompt Mode</label>
        <select>{preset_html}</select>
      </div>
      <div class="prompt-row">
        <label class="field-label">Prompt Behavior</label>
        <select>{beh_html}</select>
      </div>{custom_block}
      <div class="actions">
        <button id="summarizeBtn">Summarize Current Lecture</button>
        <div class="btn-row">
          <button class="secondary">Copy Captions</button>
          <button class="secondary">Settings</button>
        </div>
      </div>
      <div class="io">
        <div id="status">{status}</div>
        <div id="output">{output}</div>
      </div>
      <div class="history">
        <div class="history-header"><h2>Recent Summaries</h2><button class="secondary">Clear</button></div>
        <div id="historyList">{hist_items}</div>
      </div>
    </div>
  </div>"""


def popup_browser(popup_html):
    return f"""  <div class="stage-visual">
    <div class="browser" style="width:560px;">
      <div class="browser-bar">
        <div class="dots"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span></div>
        <div class="omni"><span class="lock"></span>example.hosted.panopto.com/Panopto/Pages/Viewer.aspx</div>
        <div class="ext-chip"><img src="{ICON}" alt="" /></div>
      </div>
      <div class="canvas">
        <div class="mock-page">
          <div class="mock-video"><div class="play"></div></div>
          <div class="mock-title"></div>
          <div class="mock-line" style="width:88%"></div>
          <div class="mock-line" style="width:74%"></div>
          <div class="mock-line" style="width:81%"></div>
        </div>
        <div class="floating">{popup_html}</div>
      </div>
    </div>
  </div>"""


def page_browser(page_html, width=770, url="chrome-extension://panopto-summarizer/options.html"):
    return f"""  <div class="stage-visual">
    <div class="browser" style="width:{width}px;">
      <div class="browser-bar">
        <div class="dots"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span></div>
        <div class="omni"><span class="lock"></span>{url}</div>
        <div class="ext-chip"><img src="{ICON}" alt="" /></div>
      </div>
      <div style="max-height:640px; overflow:hidden;">{page_html}</div>
    </div>
  </div>"""


HISTORY = [
    "Jul 12 • openai • CPU Scheduling",
    "Jul 10 • gemini • Virtual Memory",
    "Jul 8 • openai • TCP Congestion Control",
]

# ---- Stage 1: popup, light, hero ----
s1_popup = popup_markup(
    preset_selected="bullet_points",
    behavior_selected="custom_only",
    custom_text="Focus on exam-relevant concepts and define key terms.",
    status="Done.",
    output="Summary opened in a new tab.",
    history=HISTORY[:2],
)
stage1 = doc("Stage 1", False, copy_col(
    "Summarize any<br>Panopto lecture<br>in one click",
    "Open a lecture, pick a mode, and get a clean, readable summary in a new tab.",
) + popup_browser(s1_popup))

# ---- Stage 4: popup, dark, prompt modes ----
s4_popup = popup_markup(
    preset_selected="quiz_creator",
    behavior_selected="no_custom_prompt",
    custom_text="",
    status="Ready.",
    output="",
    history=HISTORY[:2],
    show_custom=False,
)
stage4 = doc("Stage 4", True, copy_col(
    "Bullet points,<br>quizzes, or your<br>own prompt",
    "Six built-in modes — bullet points, summary, quiz, study guide, detailed notes — plus custom instructions.",
) + popup_browser(s4_popup))

# ---- Stage 3: options, dark, BYOK ----
opt_page = """<div class="page opt">
    <div class="app-header"><img class="app-logo" src="__ICON__" alt="" /><h1>Panopto Summarizer</h1></div>
    <p class="lede">Bring your own OpenAI or Gemini API key. Keys are stored only in this browser profile via <code>chrome.storage.local</code>.</p>
    <div class="card">
      <h2>Summary defaults</h2>
      <p class="desc">These control what the popup selects by default when you open it.</p>
      <div class="grid2">
        <div class="field"><label>Default Provider</label><select class="control"><option>OpenAI</option></select></div>
        <div class="field"><label>Default Prompt Mode</label><select class="control"><option>Bullet Points</option></select></div>
      </div>
    </div>
    <div class="card">
      <h2>API keys</h2>
      <p class="desc">Stored locally on this device. Add at least one key before running summaries.</p>
      <div class="grid2">
        <div class="field"><label>OpenAI API Key</label><div class="control muted">sk-••••••••••••••••••••••••••••</div></div>
        <div class="field"><label>OpenAI Model</label><div class="control">gpt-5-mini</div></div>
        <div class="field"><label>Gemini API Key</label><div class="control muted">AIza•••••••••••••••••••••••</div></div>
        <div class="field"><label>Gemini Model</label><div class="control">gemini-3-flash-preview</div></div>
      </div>
    </div>
  </div>""".replace("__ICON__", ICON)
stage3 = doc("Stage 3", True, copy_col(
    "Bring your own<br>key — nothing<br>leaves your browser",
    "Use your own OpenAI or Gemini key. Keys and summaries stay on your device, sent only to the provider you choose.",
) + page_browser(opt_page, width=770))

# ---- Stage 2: summary tab, light ----
sum_bullets = [
    "Scheduling decides which ready process the CPU runs next, balancing throughput, latency, and fairness.",
    "Non-preemptive scheduling runs a process until it blocks or exits; preemptive scheduling interrupts it on a timer tick.",
    "First-Come First-Served is simple but suffers the convoy effect when a long job blocks short ones.",
    "Shortest Job First minimizes average wait time but needs an estimate of each burst length.",
    "Round Robin gives each process a fixed quantum; small quanta improve response time but raise context-switch overhead.",
    "Priority scheduling can starve low-priority jobs; aging slowly raises priority to prevent it.",
    "Multilevel feedback queues adjust priority from observed CPU/IO behavior, approximating SJF without prior knowledge.",
]
def sum_page(dark_export=False):
    lis = "".join(f"<li>{b}</li>" for b in sum_bullets)
    return f"""<div class="page sum">
    <h1>CS 350 — CPU Scheduling</h1>
    <div class="meta">Generated: Jul 12, 2026, 2:14 PM &nbsp;|&nbsp; Provider: openai &nbsp;|&nbsp; Model: gpt-5-mini</div>
    <div class="toolbar">
      <button class="primary">Export .md</button>
      <button class="primary">Export to Obsidian</button>
      <div class="sep"></div>
      <button>Connect Obsidian Vault</button>
      <span class="note">Connected to: Coursework / CS 350</span>
    </div>
    <h2>Key Points</h2>
    <ul>{lis}</ul>
    <div class="captions"><div class="summary-row"><span class="caret">▸</span> Captions (sanitized transcript)</div></div>
  </div>"""
stage2 = doc("Stage 2", False, copy_col(
    "Readable<br>summaries you<br>can study from",
    "Formatted output in a clean tab, with the original captions one click away.",
) + page_browser(sum_page(), width=770, url="chrome-extension://panopto-summarizer/summary"))

# ---- Stage 5: summary tab, dark, export ----
stage5 = doc("Stage 5", True, copy_col(
    "Export to<br>Markdown<br>or Obsidian",
    "Send any summary straight to your notes as a Markdown file, or push it into an Obsidian vault.",
) + page_browser(sum_page(), width=770, url="chrome-extension://panopto-summarizer/summary"))

# ---- Marquee 1400x560 ----
marquee_popup = popup_markup(
    preset_selected="bullet_points",
    behavior_selected="custom_only",
    custom_text="Focus on exam-relevant concepts and define key terms.",
    status="Done.",
    output="Summary opened in a new tab.",
    history=HISTORY[:2],
)
marquee = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><title>Marquee</title>
<style>{STYLE}
.marquee {{
  --accent:#2b6cf0; --accent-hover:#1f5be0;
  --bg:#ffffff; --bg-elev:#f4f6f9; --text:#1a1c1f; --text-muted:#5b6572;
  --border:#e4e7ec; --border-strong:#d0d5dd;
  --shadow: 0 1px 2px rgba(16,24,40,0.10);
  --card-shadow: 0 24px 60px -20px rgba(16,32,72,0.35), 0 6px 18px -8px rgba(16,32,72,0.18);
  --bg-page:#eaeef6; --glow:rgba(43,108,240,0.18); --grid:rgba(24,48,96,0.055);
  position: relative; width: 1400px; height: 560px; overflow: hidden;
  font-family: var(--font);
  background: radial-gradient(1200px 700px at 88% -20%, var(--glow), transparent 62%), var(--bg-page);
}}
.marquee::before {{
  content:""; position:absolute; inset:0;
  background-image: linear-gradient(var(--grid) 1px, transparent 1px), linear-gradient(90deg, var(--grid) 1px, transparent 1px);
  background-size: 40px 40px;
  -webkit-mask-image: radial-gradient(1100px 560px at 55% 45%, #000 55%, transparent 100%);
  mask-image: radial-gradient(1100px 560px at 55% 45%, #000 55%, transparent 100%);
}}
.mq-copy {{
  position: absolute; left: 90px; top: 50%; transform: translateY(-50%);
  width: 760px; z-index: 1;
}}
.mq-brand {{ display: flex; align-items: center; gap: 22px; margin-bottom: 30px; }}
.mq-brand img {{
  width: 84px; height: 84px; border-radius: 19px;
  box-shadow: 0 16px 34px -12px rgba(16,32,72,0.45);
}}
.mq-brand h1 {{
  margin: 0; font-size: 55px; font-weight: 730; letter-spacing: -0.025em; color: var(--text);
  white-space: nowrap;
}}
.mq-tag {{
  margin: 0 0 24px; font-size: 27px; line-height: 1.35; color: var(--text-muted); font-weight: 500;
}}
.mq-feats {{
  display: flex; align-items: center; gap: 14px;
  font-family: var(--mono); font-size: 15.5px; color: var(--text-muted); white-space: nowrap;
}}
.mq-feats .dot-sep {{ color: var(--border-strong); }}
.mq-visual {{ position: absolute; right: 100px; top: 44px; z-index: 1; }}
</style></head>
<body>
<div class="marquee">
  <div class="mq-copy">
    <div class="mq-brand"><img src="{ICON}" alt="" /><h1>Panopto Summarizer</h1></div>
    <p class="mq-tag">Summarize lectures with your own AI key.</p>
    <div class="mq-feats">
      <span>one-click summaries</span><span class="dot-sep">•</span>
      <span>BYOK</span><span class="dot-sep">•</span>
      <span>Markdown / Obsidian export</span>
    </div>
  </div>
  <div class="mq-visual">{marquee_popup}</div>
</div>
</body></html>
"""

# ---- Tile 440x280 ----
tile = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><title>Tile</title>
<style>{STYLE}
.tile {{
  width: 440px; height: 280px; position: relative; overflow: hidden;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  font-family: var(--font); text-align: center;
  --accent:#2b6cf0; --bg-page:#eaeef6; --glow:rgba(43,108,240,0.18); --grid:rgba(24,48,96,0.06);
  --text:#1a1c1f; --text-muted:#5b6572; --bg:#fff; --border:#e4e7ec;
  background: radial-gradient(600px 400px at 80% -20%, var(--glow), transparent 60%), var(--bg-page);
}}
.tile::before {{ content:""; position:absolute; inset:0;
  background-image: linear-gradient(var(--grid) 1px, transparent 1px), linear-gradient(90deg, var(--grid) 1px, transparent 1px);
  background-size: 32px 32px;
  -webkit-mask-image: radial-gradient(400px 260px at 50% 45%, #000 55%, transparent 100%); }}
.tile img {{ width: 76px; height: 76px; border-radius: 17px; box-shadow: 0 14px 30px -10px rgba(16,32,72,0.45); position: relative; z-index:1; }}
.tile h1 {{ position: relative; z-index:1; margin: 18px 0 6px; font-size: 25px; font-weight: 720; letter-spacing: -0.02em; color: var(--text); }}
.tile p {{ position: relative; z-index:1; margin: 0; font-size: 14px; color: var(--text-muted); }}
</style></head>
<body><div class="tile"><img src="{ICON}" alt="" /><h1>Panopto Summarizer</h1><p>Summarize lectures with your own AI key</p></div></body></html>
"""

files = {
    "stage-1.html": stage1,
    "stage-2.html": stage2,
    "stage-3.html": stage3,
    "stage-4.html": stage4,
    "stage-5.html": stage5,
    "stage-tile.html": tile,
    "stage-marquee.html": marquee,
}
for name, content in files.items():
    with open(os.path.join(HERE, name), "w") as f:
        f.write(content)
    print("wrote", name)
