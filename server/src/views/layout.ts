export function renderPage(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #0e0e10;
      color: #efeff1;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .card {
      background: #18181b;
      border: 1px solid #2d2d35;
      border-radius: 12px;
      padding: 40px 48px;
      text-align: center;
      max-width: 420px;
      width: 100%;
    }
    .icon { margin-bottom: 16px; }
    h1 { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
    .subtitle {
      font-weight: 600;
      font-size: 16px;
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    p { color: #adadb8; font-size: 14px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">${body}</div>
</body>
</html>`;
}
