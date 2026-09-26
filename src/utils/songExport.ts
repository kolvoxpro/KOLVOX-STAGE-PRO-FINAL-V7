import { Song } from '../types/index.ts';

/**
 * Cleans and strips chords from chords/lyrics text if lyrics is not separately provided.
 */
export function extractCleanLyrics(song: Song): string {
  if (song.lyrics && song.lyrics.trim().length > 10) {
    return song.lyrics.trim();
  }

  if (!song.chords) return 'Letra não cadastrada para esta música.';

  // If we only have chords text, filter out lines that look like pure chord lines or intro/refrão tags
  const lines = song.chords.split('\n');
  const lyricsLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      lyricsLines.push('');
      continue;
    }

    // Skip chord-only lines (e.g. "G  D/F#  Em  C  D" or "[Intro]")
    const isTagLine = /^\[.*\]$/.test(trimmed);
    const isChordsOnly = /^[A-G][b#]?(m|maj|min|dim|aug|sus|add|[0-9]|\/|\+|\-|\*|\s)*$/.test(trimmed) && !trimmed.includes(' ') ||
      trimmed.split(/\s+/).every((token) => /^[A-G][b#]?(m|maj|min|dim|aug|sus|add|[0-9]|\/|\+|\-|\*)*$/.test(token));

    if (!isTagLine && !isChordsOnly) {
      // Remove inline chords like [C] or [G]
      const cleanLine = line.replace(/\[[A-G][b#]?[^\]]*\]/g, '');
      lyricsLines.push(cleanLine);
    }
  }

  const result = lyricsLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return result || song.lyrics || song.chords;
}

/**
 * Downloads ONLY the lyrics as a formatted TXT file.
 */
export function downloadLyricsOnly(song: Song): void {
  const lyrics = extractCleanLyrics(song);

  const content = `============================================================
KOLVOX STAGE - LETRA OFICIAL
Música: ${song.title.toUpperCase()}
Artista: ${song.artist}
${song.genre ? `Gênero: ${song.genre}\n` : ''}Data de Exportação: ${new Date().toLocaleDateString('pt-BR')}
============================================================

${lyrics}

============================================================
KOLVOX STAGE - Plataforma para Cantores e Artistas da Noite
============================================================`;

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${song.title.replace(/\s+/g, '_')}_${song.artist.replace(/\s+/g, '_')}_SO_LETRA.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Downloads Chords + Lyrics formatted for bar performers and live gigs.
 */
export function downloadChordsAndLyrics(song: Song): void {
  const content = `============================================================
KOLVOX STAGE - CIFRA & LETRA COMPLETA (SHOW / BARZINHO)
Música: ${song.title.toUpperCase()}
Artista: ${song.artist}
Tom: ${song.key || 'Original'}  |  Capotraste: ${song.capo ? `${song.capo}ª casa` : 'Sem capotraste'}  |  BPM: ${song.bpm || '--'}
${song.genre ? `Gênero: ${song.genre}\n` : ''}Data de Exportação: ${new Date().toLocaleDateString('pt-BR')}
============================================================

${song.chords || song.lyrics || 'Cifra indisponível'}

============================================================
KOLVOX STAGE - Repertório Profissional de Palco & Violão
============================================================`;

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${song.title.replace(/\s+/g, '_')}_${song.artist.replace(/\s+/g, '_')}_CIFRA_E_LETRA.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
