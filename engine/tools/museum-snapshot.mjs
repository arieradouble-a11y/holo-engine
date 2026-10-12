// Keep museum assets independent of the site's dictionary.
export function museumSnapshot(file, text) {
  if (file.endsWith('.html')) {
    text=text.replace(/<script id="museum-glossary-bootstrap">[\s\S]*?<\/script>\r?\n?/g,'')
      .replace(/<link\b[^>]*href="[^"]*glossary[^"]*"[^>]*>/g,'')
      .replace(/<script\b[^>]*src="[^"]*glossary[^"]*"[^>]*><\/script>/g,'')
      .replace(/<a class="museum-glossary-link"[\s\S]*?<\/a>/g,'')
      .replace(".concat(window.museumGlossarySearch?.(o)||'')",'')
      .replace('(window.museumGlossaryMatches?.(c.object,q) ?? c.hay.indexOf(q) >= 0)','c.hay.indexOf(q) >= 0')
      .replace('Инфо · словарь','Инфо')
      .replace(/^addEventListener\('museum:glossary-ready'.*\r?\n/gm,'')
      .replace('atlas.js?v=20260916-glossary','atlas.js?v=20261012');
    // The atlas script has a version containing "glossary", but is retained.
    if(file.endsWith('/index.html')&&!text.includes('src="atlas.js'))
      text=text.replace('</head>','<script defer src="atlas.js?v=20261012"></script></head>');
  }
  if(file.endsWith('/atlas.js'))text=text.replace(/   if\(!doc\.getElementById\('museum-glossary-css'\)\)\{[\s\S]*?(?=   if\(!doc\.getElementById\('museum-atlas-controls'\))/, '');
  return text;
}
