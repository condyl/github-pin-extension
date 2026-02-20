# GitHub Pin

Chrome extension (Manifest V3) that adds a **Pinned repositories** section above GitHub's **Top repositories**.

## Dev

```bash
npm install
npm test
npm run build
```

## Load In Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder (the folder containing `manifest.json`).
5. Open `https://github.com/`.

After code changes, run `npm run build` and reload the extension.
