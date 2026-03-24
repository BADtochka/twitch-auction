const isDev = process.argv[1]?.endsWith('.ts') === true;

// Clean URL → HTML filename mapping
const ROUTES: Record<string, string> = {
  '':        'index.html',
  'index':   'index.html',
  'lot':     'lot.html',
  'price':   'price.html',
  'timer':   'timer.html',
  'bids':    'bids.html',
  'top-bid': 'top-bid.html',
  'winner':  'winner.html',
};

let _serve: (slug: string) => Response | Promise<Response>;

if (isDev) {
  const overlayDir  = new URL('../../overlay/', import.meta.url);
  const transpiler  = new Bun.Transpiler({ loader: 'ts' });

  _serve = async (slug: string): Promise<Response> => {
    const filename = ROUTES[slug] ?? slug;

    // Serve .js by transpiling the corresponding .ts
    if (filename.endsWith('.js')) {
      const tsPath = new URL(filename.replace(/\.js$/, '.ts'), overlayDir);
      const f = Bun.file(tsPath);
      if (!(await f.exists())) return new Response(`Not found: ${filename}`, { status: 404 });
      const js = await transpiler.transform(await f.text());
      return new Response(js, { headers: { 'content-type': 'application/javascript' } });
    }

    const f = Bun.file(new URL(filename, overlayDir));
    if (!(await f.exists())) return new Response(`Not found: ${filename}`, { status: 404 });
    const body = await f.text();
    const ct   = filename.endsWith('.css') ? 'text/css' : 'text/html; charset=utf-8';
    return new Response(body, { headers: { 'content-type': ct } });
  };
} else {
  const { WIDGET_FILES } = await import('./assets-inline');

  _serve = (slug: string): Response => {
    const filename = ROUTES[slug] ?? slug;
    const file     = WIDGET_FILES[filename];
    if (!file) return new Response(`Not found: ${filename}`, { status: 404 });
    return new Response(file.body, { headers: { 'content-type': file.type } });
  };
}

export const serveOverlay = _serve;
