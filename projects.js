// 구글 시트 "웹에 게시 → CSV" URL
const PROJECTS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT7Sx0nBAzKC3ZC-pgnkl-miK8UrMs_dre4tCORNurWKgtXcKcB7bttI0Kc18JFKri66EoCVi_vydKw/pub?gid=1246029181&single=true&output=csv';
const ESSAY_URL    = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT7Sx0nBAzKC3ZC-pgnkl-miK8UrMs_dre4tCORNurWKgtXcKcB7bttI0Kc18JFKri66EoCVi_vydKw/pub?gid=908161552&single=true&output=csv';

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

export async function loadProjects() {
  const [pRes, eRes] = await Promise.all([fetch(PROJECTS_URL), fetch(ESSAY_URL)]);
  const [pCSV, eCSV] = await Promise.all([pRes.text(), eRes.text()]);

  const projects  = toObjects(parseCSV(pCSV));
  const essayRows = toObjects(parseCSV(eCSV));

  return projects.map(p => ({
    title:    p.title,
    year:     p.year,
    type:     p.type,
    location: p.location,
    layout: {
      row:      parseInt(p.grid_row)       || 1,
      colStart: parseInt(p.grid_col_start) || 1,
      colEnd:   parseInt(p.grid_col_end)   || 13,
    },
    thumbnail: p.thumbnail,
    essay: essayRows
      .filter(e => e.project_id === p.id)
      .sort((a, b) => parseInt(a.order) - parseInt(b.order))
      .map(e => e.kind === 'img'
        ? { kind: 'img', src: e.image_src, caption: e.image_caption }
        : { kind: e.kind, content: e.content }),
    gallery: p.gallery ? p.gallery.split('|').map(s => s.trim()).filter(Boolean) : [],
  }));
}
