#!/usr/bin/env bash
# Capture each store stage to a PNG at exactly 1280x800 (tile 440x280),
# then strip the alpha channel so the images meet Chrome Web Store rules.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Locate a Chromium-family browser.
CANDIDATES=(
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  "/Applications/Chromium.app/Contents/MacOS/Chromium"
  "/Applications/Helium.app/Contents/MacOS/Helium"
)
CHROME=""
for c in "${CANDIDATES[@]}"; do
  if [[ -x "$c" ]]; then CHROME="$c"; break; fi
done
if [[ -z "$CHROME" ]]; then
  echo "No Chromium-family browser found." >&2
  exit 1
fi
echo "Using browser: $CHROME"

shoot() {
  local stage="$1" out="$2" w="$3" h="$4"
  rm -f "$DIR/$out"
  "$CHROME" \
    --headless=new \
    --disable-gpu \
    --hide-scrollbars \
    --force-device-scale-factor=1 \
    --default-background-color=00000000 \
    --window-size="${w},${h}" \
    --screenshot="$DIR/$out" \
    "file://$DIR/$stage" >/dev/null 2>&1 || true
  if [[ ! -f "$DIR/$out" ]]; then
    echo "FAILED to capture $stage" >&2
    exit 1
  fi
  echo "captured $out"
}

# 1280x800 screenshots
for n in 1 2 3 4 5; do
  shoot "stage-${n}.html" "screenshot-${n}.png" 1280 800
done
# 440x280 promo tile
shoot "stage-tile.html" "tile-440x280.png" 440 280
# 1400x560 marquee
shoot "stage-marquee.html" "marquee-1400x560.png" 1400 560

# ---- Strip alpha channel (Chrome PNGs are 32-bit RGBA) ----
# Prefer ImageMagick (keeps PNG, flattens on white); fall back to sips->JPEG.
flatten() {
  local f="$1"
  if command -v magick >/dev/null 2>&1; then
    magick "$DIR/$f" -background white -alpha remove -alpha off "$DIR/$f"
  elif command -v convert >/dev/null 2>&1; then
    convert "$DIR/$f" -background white -alpha remove -alpha off "$DIR/$f"
  else
    # sips cannot drop alpha in-place on PNG; re-encode as 24-bit JPEG instead.
    local jpg="${f%.png}.jpg"
    sips -s format jpeg -s formatOptions 92 "$DIR/$f" --out "$DIR/$jpg" >/dev/null
    rm -f "$DIR/$f"
    echo "no ImageMagick: wrote $jpg (JPEG, no alpha)"
  fi
}

for f in screenshot-1.png screenshot-2.png screenshot-3.png screenshot-4.png screenshot-5.png tile-440x280.png marquee-1400x560.png; do
  [[ -f "$DIR/$f" ]] && flatten "$f"
done

echo "---- verifying dimensions ----"
for f in "$DIR"/screenshot-*.png "$DIR"/tile-440x280.png "$DIR"/marquee-1400x560.png "$DIR"/screenshot-*.jpg; do
  [[ -f "$f" ]] || continue
  echo "$(basename "$f"):"
  sips -g pixelWidth -g pixelHeight -g hasAlpha "$f" | tail -3
done
