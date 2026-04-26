const SHEET = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT7Sx0nBAzKC3ZC-pgnkl-miK8UrMs_dre4tCORNurWKgtXcKcB7bttI0Kc18JFKri66EoCVi_vydKw/pub';

// projects tab:   id | title | year | type | location
// thumbnails tab: project_id | grid_row | grid_col_start | grid_col_end | image
// essay tab:      project_id | order | kind | content | image_src | image_caption  (kind: text | img | pull)
// gallery tab:    project_id | order | image_src | image_caption
const PROJECTS_URL   = SHEET + '?gid=1246029181&single=true&output=csv';
const THUMBNAILS_URL = SHEET + '?gid=67858807&single=true&output=csv';
const ESSAY_URL      = SHEET + '?gid=908161552&single=true&output=csv';
const GALLERY_URL    = SHEET + '?gid=1090780484&single=true&output=csv';

function uncached(url) {
  return url + '&v=' + Date.now();
}

function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (ch !== '\r') field += ch;
    }
  }
  if (row.length > 0 || field) { row.push(field); rows.push(row); }
  return rows;
}

function toObjects(rows) {
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1)
    .filter(r => r.some(c => c.trim()))
    .map(r => Object.fromEntries(headers.map((h, i) => [h, (r[i] || '').trim()])));
}

export async function loadData() {
  const [pRes, tRes, eRes, gRes] = await Promise.all([
    fetch(uncached(PROJECTS_URL)),
    fetch(uncached(THUMBNAILS_URL)),
    fetch(uncached(ESSAY_URL)),
    fetch(uncached(GALLERY_URL)),
  ]);
  const [pCSV, tCSV, eCSV, gCSV] = await Promise.all([
    pRes.text(), tRes.text(), eRes.text(), gRes.text(),
  ]);

  const projectRows = toObjects(parseCSV(pCSV));
  const thumbRows   = toObjects(parseCSV(tCSV));
  const essayRows   = toObjects(parseCSV(eCSV));
  const galleryRows = toObjects(parseCSV(gCSV));

  const projects = {};
  projectRows.forEach(p => {
    projects[p.id] = {
      id:       p.id,
      title:    p.title,
      year:     p.year,
      type:     p.type,
      location: p.location,
      essay: essayRows
        .filter(e => e.project_id === p.id)
        .sort((a, b) => parseInt(a.order) - parseInt(b.order))
        .map(e => e.kind === 'img'
          ? { kind: 'img', src: e.image_src, caption: e.image_caption }
          : { kind: e.kind, content: e.content }),
      gallery: galleryRows
        .filter(g => g.project_id === p.id)
        .sort((a, b) => parseInt(a.order) - parseInt(b.order))
        .map(g => ({ src: g.image_src, caption: g.image_caption })),
    };
  });

  const thumbnails = thumbRows.map(t => ({
    projectId: t.project_id,
    row:      parseInt(t.grid_row)       || 1,
    colStart: parseInt(t.grid_col_start) || 1,
    colEnd:   parseInt(t.grid_col_end)   || 13,
    image:    t.image,
  }));

  return { projects, thumbnails };
}
