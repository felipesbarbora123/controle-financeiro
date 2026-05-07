/** Alinha com o backend: segunda a domingo da semana que contém a data de referência (YYYY-MM-DD). */
export function periodoSemanaSegDom(isoRef: string): { data_inicio: string; data_fim: string } {
  const [y, m, d] = isoRef.split('-').map(Number);
  const ref = new Date(y, m - 1, d, 12, 0, 0, 0);
  const dow = ref.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  const seg = new Date(ref);
  seg.setDate(ref.getDate() + diff);
  const dom = new Date(seg);
  dom.setDate(seg.getDate() + 6);
  const pad = (n: number) => String(n).padStart(2, '0');
  const iso = (x: Date) => `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
  return { data_inicio: iso(seg), data_fim: iso(dom) };
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

export function isoHoje(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatarDiaPt(dataIso: string): string {
  const [y, m, d] = dataIso.split('-').map(Number);
  if (!y || !m || !d) return dataIso;
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}
