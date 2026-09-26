import React from 'react';
import { getChordDiagram } from '../utils/guitarChords.ts';
import { X, Volume2, Info } from 'lucide-react';

interface ChordDiagramModalProps {
  chordName: string | null;
  onClose: () => void;
  capo?: number;
}

export const ChordDiagramModal: React.FC<ChordDiagramModalProps> = ({ chordName, onClose, capo = 0 }) => {
  if (!chordName) return null;

  const diagram = getChordDiagram(chordName);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        id="chord-diagram-card"
        className="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-700/80 p-6 shadow-2xl text-zinc-100"
      >
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-extrabold text-amber-400 font-mono">{chordName}</span>
              {capo > 0 && (
                <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                  Capo {capo}ª casa
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-1">Dicionário de Acordes para Violão / Guitarra</p>
          </div>
          <button
            id="btn-close-chord-modal"
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {diagram ? (
          <div className="flex flex-col items-center">
            {/* SVG Fretboard */}
            <div className="w-56 h-64 bg-zinc-950 rounded-xl p-4 border border-zinc-800 flex items-center justify-center">
              <svg viewBox="0 0 160 190" className="w-full h-full">
                {/* Nut or Base fret label */}
                {diagram.baseFret > 1 ? (
                  <text x="12" y="44" fill="#a1a1aa" fontSize="11" fontFamily="monospace" fontWeight="bold">
                    {diagram.baseFret}ª
                  </text>
                ) : (
                  <line x1="25" y1="35" x2="135" y2="35" stroke="#f4f4f5" strokeWidth="4" strokeLinecap="round" />
                )}

                {/* 5 frets horizontal lines */}
                {[0, 1, 2, 3, 4].map((fret) => (
                  <line
                    key={fret}
                    x1="25"
                    y1={35 + fret * 30}
                    x2="135"
                    y2={35 + fret * 30}
                    stroke="#52525b"
                    strokeWidth={fret === 0 && diagram.baseFret === 1 ? '4' : '1.5'}
                  />
                ))}

                {/* 6 strings vertical lines (E, A, D, G, B, e) */}
                {[0, 1, 2, 3, 4, 5].map((str) => (
                  <line
                    key={str}
                    x1={25 + str * 22}
                    y1="35"
                    x2={25 + str * 22}
                    y2="155"
                    stroke="#71717a"
                    strokeWidth={str === 0 ? '2.5' : str === 1 ? '2' : '1.5'}
                  />
                ))}

                {/* String tuning labels at bottom */}
                {['E', 'A', 'D', 'G', 'B', 'e'].map((note, idx) => (
                  <text
                    key={idx}
                    x={25 + idx * 22}
                    y="172"
                    fill="#71717a"
                    fontSize="10"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {note}
                  </text>
                ))}

                {/* Open (O) and Muted (X) indicators above nut */}
                {diagram.frets.map((fret, strIdx) => {
                  const x = 25 + strIdx * 22;
                  if (fret === -1) {
                    return (
                      <text
                        key={`x-${strIdx}`}
                        x={x}
                        y="24"
                        fill="#ef4444"
                        fontSize="13"
                        fontWeight="bold"
                        textAnchor="middle"
                        fontFamily="sans-serif"
                      >
                        ✕
                      </text>
                    );
                  }
                  if (fret === 0) {
                    return (
                      <circle
                        key={`o-${strIdx}`}
                        cx={x}
                        cy="20"
                        r="4.5"
                        fill="none"
                        stroke="#22c55e"
                        strokeWidth="1.8"
                      />
                    );
                  }
                  return null;
                })}

                {/* Finger dots on frets */}
                {diagram.frets.map((fret, strIdx) => {
                  if (fret > 0) {
                    const relativeFret = diagram.baseFret > 1 ? fret - diagram.baseFret + 1 : fret;
                    const x = 25 + strIdx * 22;
                    const y = 35 + relativeFret * 30 - 15;
                    const finger = diagram.fingers[strIdx];

                    return (
                      <g key={`dot-${strIdx}`}>
                        <circle cx={x} cy={y} r="8.5" fill="#f59e0b" />
                        {finger > 0 && (
                          <text
                            x={x}
                            y={y + 3.5}
                            fill="#18181b"
                            fontSize="10"
                            fontWeight="bold"
                            textAnchor="middle"
                            fontFamily="monospace"
                          >
                            {finger}
                          </text>
                        )}
                      </g>
                    );
                  }
                  return null;
                })}
              </svg>
            </div>

            <div className="mt-4 flex items-center justify-between w-full text-xs text-zinc-400 bg-zinc-800/60 p-2.5 rounded-xl">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Corda Solta (O)
              </span>
              <span className="flex items-center gap-1">
                <span className="text-red-400 font-bold">✕</span> Não Tocar (X)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span> Posição
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <Info className="w-10 h-10 text-zinc-500 mx-auto mb-2" />
            <p className="text-zinc-300 font-medium">Acorde personalizado</p>
            <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
              O diagrama simplificado para "{chordName}" foi gerado dinamicamente no seu instrumento.
            </p>
          </div>
        )}

        <div className="mt-5">
          <button
            id="btn-understand-chord"
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-sm transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
