const escapeHtml = (value: string) =>
  value.replace(/[&<>"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  })[character] ?? character);

export function createHtmlStarter(instruction: string): string {
  const normalized = instruction.trim();
  const brief = escapeHtml(normalized || "A focused page for your next campaign");
  const callToAction = normalized ? "Book a demo" : "Start here";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Cookbook campaign starter</title>
  <style>
    :root { color-scheme: light; --ink: #17211b; --muted: #5b6a61; --paper: #f4f7f3; --brand: #226a4a; --line: #d9e2dc; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, sans-serif; color: var(--ink); background: var(--paper); }
    .page { min-height: 100vh; display: grid; place-items: center; padding: 64px 24px; }
    .hero { width: min(1040px, 100%); overflow: hidden; border: 1px solid var(--line); border-radius: 28px; background: #fff; box-shadow: 0 28px 70px rgba(23,33,27,.10); }
    .nav { display: flex; align-items: center; justify-content: space-between; padding: 22px 28px; border-bottom: 1px solid var(--line); }
    .brand { font-weight: 800; letter-spacing: -.02em; }
    .badge { border-radius: 999px; background: #e4f1e9; color: var(--brand); padding: 7px 11px; font-size: 12px; font-weight: 700; }
    .content { display: grid; grid-template-columns: 1.15fr .85fr; gap: 48px; padding: 72px 64px; align-items: center; }
    .eyebrow { color: var(--brand); font-size: 13px; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; }
    h1 { margin: 16px 0 18px; font-size: clamp(42px, 6vw, 72px); line-height: .98; letter-spacing: -.055em; }
    p { margin: 0; color: var(--muted); font-size: 18px; line-height: 1.65; }
    .cta { display: inline-flex; margin-top: 30px; border-radius: 12px; background: var(--brand); color: #fff; padding: 14px 20px; font-weight: 750; text-decoration: none; }
    .visual { min-height: 330px; border-radius: 22px; background: linear-gradient(145deg,#d9eee1,#f0f6f1); padding: 24px; display: grid; align-content: end; }
    .proof { border: 1px solid rgba(34,106,74,.15); border-radius: 16px; background: rgba(255,255,255,.88); padding: 22px; box-shadow: 0 18px 45px rgba(34,106,74,.10); }
    .proof strong { display: block; font-size: 32px; margin-bottom: 8px; }
    @media (max-width: 720px) { .content { grid-template-columns: 1fr; padding: 48px 28px; } .visual { min-height: 220px; } .nav { padding: 18px 22px; } }
  </style>
</head>
<body>
  <main class="page">
    <article class="hero">
      <nav class="nav"><span class="brand">Campaign Studio</span><span class="badge">New release</span></nav>
      <section class="content">
        <div><span class="eyebrow">Built for momentum</span><h1>Make the next step feel obvious.</h1><p>${brief}</p><a class="cta" href="#contact">${callToAction}</a></div>
        <div class="visual"><div class="proof"><strong>Clear. Useful. Ready.</strong><p>A polished starting point you can edit, preview, and version safely.</p></div></div>
      </section>
    </article>
  </main>
</body>
</html>`;
}
