# Solfège Lab

A small, free music-theory practice site. Plain static HTML/CSS/JS, no build step.

**Live:** https://solfegelab.com

## Feature 1: Numbers → Solfège (scale degrees / jianpu)

1. Pick the notes to practice (e.g. 1 2 3 5) and the sequence length range (e.g. 2–3).
2. The site shows a random sequence such as `12`, `35`, `135`.
3. Sing the syllables yourself, then press **Space** to show the answer (do re mi fa sol la si/ti), optionally with the pitches played back. Press **Space** again to hide it.
4. Press **→** for the next sequence and **←** to go back to earlier ones. On a phone, tap the numbers to show the answer and use the arrow buttons to move.

- Choose **si** or **ti** for 7.
- Switch the interface language (English, 简体中文, 繁體中文, 日本語, 한국어, Español, Français, Deutsch, Português, Русский). Link to a language with `?lang=ja` etc.

Settings are saved in your browser.

## Run locally

Open `index.html` in a browser, or run `npx serve .`.

## Deploy

Deployed on Vercel as a static site (no build step). Pushes to `main` deploy to production at https://solfegelab.com.

## Adding a new tool

- Give each tool its own URL (e.g. `/intervals`) so it can be indexed on its own.
- Add the new URL and its `?lang=` variants to `sitemap.xml` (and the `hreflang` links in the page head). Google Search Console already has the sitemap, so nothing needs resubmitting there.

---

简谱数字 ↔ 唱名练习小工具：选择要练的音和长度范围，看数字自己读唱名，按空格核对答案。
