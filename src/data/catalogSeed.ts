export interface SongSearchResult {
  id: number | string;
  title: string;
  artist: string;
  album?: string;
  genre?: string;
  key?: string;
  capo?: number;
  bpm?: number;
  hasChords: boolean;
  hasLyrics: boolean;
  hasTabs: boolean;
  hasSheetMusic: boolean;
  sourceProvider: string;
  sourceUrl?: string;
  licenseType: string;
  downloadAllowed: boolean;
  printAllowed: boolean;
  isExternalOnly?: boolean;
}

export interface DetailedSongItem extends SongSearchResult {
  lyrics?: string;
  chords?: string;
  tabs?: string;
  sheetMusic?: string;
  duration?: string;
  officialNotice?: string;
}

export function normalizeSearchText(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const CATALOG_SEED: DetailedSongItem[] = [
      {
        id: 'cat-1',
        title: 'Como Nossos Pais',
        artist: 'Elis Regina / Belchior',
        album: 'Falso Brilhante',
        genre: 'MPB',
        key: 'G',
        capo: 0,
        bpm: 96,
        hasChords: true,
        hasLyrics: true,
        hasTabs: false,
        hasSheetMusic: false,
        sourceProvider: 'vagalume',
        sourceUrl: 'https://www.vagalume.com.br/elis-regina/como-nossos-pais.html',
        licenseType: 'licensed',
        downloadAllowed: true,
        printAllowed: true,
        duration: '4:25',
        chords: `[Intro] G  D/F#  Em  C  D

[Verso 1]
G                 D/F#
 Não quero lhe falar, meu grande amor
Em                C
 Das coisas que aprendi nos discos
G                    D/F#
 Quero lhe contar como eu vivi
Em                  C           D
 E tudo o que aconteceu comigo

[Refrão]
G             D/F#
 Viver é melhor que sonhar
Em           C
 Eu sei que o amor é uma coisa boa
G                D/F#
 Mas também sei que qualquer canto
Em           C       D
 É menor do que a vida de qualquer pessoa

[Verso 2]
G                  D/F#
 Por isso cuidado meu bem, há perigo na esquina
Em                  C
 Eles venceram e o sinal está fechado prá nós
G                     D/F#
 Que somos jovens...
Em                  C               D
 É você que ama o passado e que não vê
            G       D/F#     Em
Que o novo sempre vem...
        C         D             G
E ainda somos os mesmos e vivemos como nossos pais`,
        lyrics: `Não quero lhe falar, meu grande amor
Das coisas que aprendi nos discos
Quero lhe contar como eu vivi
E tudo o que aconteceu comigo

Viver é melhor que sonhar
Eu sei que o amor é uma coisa boa
Mas também sei que qualquer canto
É menor do que a vida de qualquer pessoa

Por isso cuidado meu bem, há perigo na esquina
Eles venceram e o sinal está fechado prá nós que somos jovens
É você que ama o passado e que não vê
Que o novo sempre vem...
E ainda somos os mesmos e vivemos como nossos pais`,
      },
      {
        id: 'cat-2',
        title: 'Evidências',
        artist: 'Chitãozinho & Xororó',
        album: 'Cowboy do Asfalto',
        genre: 'Sertanejo',
        key: 'E',
        capo: 0,
        bpm: 110,
        hasChords: true,
        hasLyrics: true,
        hasTabs: false,
        hasSheetMusic: false,
        sourceProvider: 'cifraclub',
        sourceUrl: 'https://www.cifraclub.com.br/chitaozinho-e-xororo/evidencias/',
        licenseType: 'licensed',
        downloadAllowed: true,
        printAllowed: true,
        duration: '4:38',
        chords: `[Intro] E  G#m  A  B7 (2x)

[Verso 1]
E                     G#m
 Quando eu digo que deixei de te amar
A                    B7
 É porque eu te amo
E                       G#m
 Quando eu digo que não quero mais você
A               B7
 É porque eu te quero

[Pré-Refrão]
C#m                 G#m
 Eu tenho medo de te dar meu coração
A                      E
 E confessar que eu estou em tuas mãos
A             B7
 Mas não posso mais fugir...

[Refrão]
E
 E nessa loucura de dizer que não te quero
G#m
 Vou negando as aparências, disfarçando as evidências
A
 Mas pra que viver fingindo se eu não posso enganar meu coração?
B7
 Eu sei que te amo!
E
 Chega de mentiras, de negar o meu desejo
G#m
 Eu te quero mais que tudo, eu preciso do seu beijo
A
 Eu entrego a minha vida pra você fazer o que quiser de mim
B7               E
 Só pra ouvir você dizer que sim!`,
        lyrics: `Quando eu digo que deixei de te amar
É porque eu te amo
Quando eu digo que não quero mais você
É porque eu te quero

Eu tenho medo de te dar meu coração
E confessar que eu estou em tuas mãos
Mas não posso mais fugir...

E nessa loucura de dizer que não te quero
Vou negando as aparências, disfarçando as evidências
Mas pra que viver fingindo se eu não posso enganar meu coração?
Eu sei que te amo!
Chega de mentiras, de negar o meu desejo
Eu te quero mais que tudo, eu preciso do seu beijo
Eu entrego a minha vida pra você fazer o que quiser de mim
Só pra ouvir você dizer que sim!`,
      },
      {
        id: 'cat-3',
        title: 'Tempo Perdido',
        artist: 'Legião Urbana',
        album: 'Dois',
        genre: 'Rock Nacional',
        key: 'C',
        capo: 0,
        bpm: 124,
        hasChords: true,
        hasLyrics: true,
        hasTabs: true,
        hasSheetMusic: false,
        sourceProvider: 'cifraclub',
        sourceUrl: 'https://www.cifraclub.com.br/legiao-urbana/tempo-perdido/',
        licenseType: 'licensed',
        downloadAllowed: true,
        printAllowed: true,
        duration: '5:02',
        chords: `[Intro] C  Am7  Bm  Em (2x)

[Verso 1]
C              Am7
 Todos os dias quando acordo
             Bm
Não tenho mais o tempo que passou
           Em
Mas tenho muito tempo
C                 Am7
 Temos todo o tempo do mundo
Bm                Em
 Todos os dias antes de dormir
C                 Am7
 Lembro e esqueço como foi o dia
Bm               Em
 "Sempre em frente, não temos tempo a perder"

[Refrão]
C              Am7
 Nosso suor sagrado
             Bm                   Em
É bem mais belo que esse sangue amargo
C          Am7
 E tão sério
       Bm     Em
E selvagem...
C       Am7        Bm         Em
 Veja o sol dessa manhã tão cinza
C             Am7
 A tempestade que chega
        Bm             Em
É da cor dos teus olhos castanhos`,
        lyrics: `Todos os dias quando acordo
Não tenho mais o tempo que passou
Mas tenho muito tempo
Temos todo o tempo do mundo

Todos os dias antes de dormir
Lembro e esqueço como foi o dia
Sempre em frente, não temos tempo a perder

Nosso suor sagrado
É bem mais belo que esse sangue amargo
E tão sério e selvagem...
Veja o sol dessa manhã tão cinza
A tempestade que chega é da cor dos teus olhos castanhos`,
      },
      {
        id: 'cat-4',
        title: 'Anunciação',
        artist: 'Alceu Valença',
        album: 'Anjo Avesso',
        genre: 'MPB',
        key: 'G',
        capo: 0,
        bpm: 128,
        hasChords: true,
        hasLyrics: true,
        hasTabs: true,
        hasSheetMusic: false,
        sourceProvider: 'cifraclub',
        sourceUrl: 'https://www.cifraclub.com.br/alceu-valenca/anunciacao/',
        licenseType: 'licensed',
        downloadAllowed: true,
        printAllowed: true,
        duration: '3:50',
        chords: `[Intro] G  C  G  D (2x)

[Verso 1]
G                 C
Na bruma leve das paixões que vêm de dentro
G                   D
Tu vens chegando pra brincar no meu quintal
G                   C
No teu cavalo, peito nu, cabelo ao vento
G                   D
E o sol quarando nossas roupas no varal

[Refrão]
G               C
Tu virás, tu virás
G                    D
Eu já escuto os teus sinais
G               C
Tu virás, tu virás
G                    D
Eu já escuto os teus sinais`,
        lyrics: `Na bruma leve das paixões que vêm de dentro
Tu vens chegando pra brincar no meu quintal
No teu cavalo, peito nu, cabelo ao vento
E o sol quarando nossas roupas no varal

Tu virás, tu virás
Eu já escuto os teus sinais
Tu virás, tu virás
Eu já escuto os teus sinais`,
      },
      {
        id: 'cat-5',
        title: 'Pais e Filhos',
        artist: 'Legião Urbana',
        album: 'As Quatro Estações',
        genre: 'Rock Nacional',
        key: 'C',
        capo: 0,
        bpm: 118,
        hasChords: true,
        hasLyrics: true,
        hasTabs: true,
        hasSheetMusic: false,
        sourceProvider: 'cifraclub',
        sourceUrl: 'https://www.cifraclub.com.br/legiao-urbana/pais-e-filhos/',
        licenseType: 'licensed',
        downloadAllowed: true,
        printAllowed: true,
        duration: '5:08',
        chords: `[Intro] C  G/B  Am  F (2x)

[Verso 1]
C              G/B
Estátuas e monumentos
           Am           F
Pelo centro da cidade
C             G/B
Das grandes fezes do mundo
    Am               F
Às maiores falsidades

[Refrão]
C            G/B
É preciso amar as pessoas
      Am             F
Como se não houvesse amanhã
C               G/B
Porque se você parar pra pensar
      Am            F
Na verdade não há`,
        lyrics: `Estátuas e monumentos pelo centro da cidade
Das grandes fezes do mundo às maiores falsidades

É preciso amar as pessoas como se não houvesse amanhã
Porque se você parar pra pensar na verdade não há`,
      },
      {
        id: 'cat-6',
        title: 'Será',
        artist: 'Legião Urbana',
        album: 'Legião Urbana',
        genre: 'Rock Nacional',
        key: 'C',
        capo: 0,
        bpm: 140,
        hasChords: true,
        hasLyrics: true,
        hasTabs: true,
        hasSheetMusic: false,
        sourceProvider: 'cifraclub',
        sourceUrl: 'https://www.cifraclub.com.br/legiao-urbana/sera/',
        licenseType: 'licensed',
        downloadAllowed: true,
        printAllowed: true,
        duration: '2:30',
        chords: `[Intro] C  F  G  C (2x)

[Verso 1]
C                  F
Tire suas mãos de mim
     G            C
Eu não pertenço a você
C                 F
Não é me dominando assim
     G             C
Que você vai me entender

[Refrão]
Am                F
Será só imaginação?
Dm                   G
Será que nada vai acontecer?
Am                      F
Será que é tudo isso em vão?
Dm                   G           C
Será que vamos conseguir vencer?`,
        lyrics: `Tire suas mãos de mim, eu não pertenço a você
Não é me dominando assim que você vai me entender

Será só imaginação?
Será que nada vai acontecer?
Será que é tudo isso em vão?
Será que vamos conseguir vencer?`,
      },
      {
        id: 'cat-7',
        title: 'Maluco Beleza',
        artist: 'Raul Seixas',
        album: 'O Dia Em Que a Terra Parou',
        genre: 'Rock Nacional',
        key: 'C',
        capo: 0,
        bpm: 110,
        hasChords: true,
        hasLyrics: true,
        hasTabs: false,
        hasSheetMusic: false,
        sourceProvider: 'cifraclub',
        sourceUrl: 'https://www.cifraclub.com.br/raul-seixas/maluco-beleza/',
        licenseType: 'licensed',
        downloadAllowed: true,
        printAllowed: true,
        duration: '3:20',
        chords: `[Intro] C  G/B  Am  F  G  C

[Verso 1]
C                    G/B
 Enquanto você se preocupa
Am               Em
 Com o que eles vão falar
F                   C
 Eu continuo cantando aqui
Dm                  G
 Nesse mesmo lugar

[Refrão]
C
 Controlando a minha maluquez
F                     C
 Misturada com minha lucidez
G                   F           C
 Esse é o maluco beleza que você vê`,
        lyrics: `Enquanto você se preocupa com o que eles vão falar
Eu continuo cantando aqui nesse mesmo lugar

Controlando a minha maluquez
Misturada com minha lucidez
Esse é o maluco beleza que você vê`,
      },
      {
        id: 'cat-8',
        title: 'Metamorfose Ambulante',
        artist: 'Raul Seixas',
        album: 'Krig-ha, Bandolo!',
        genre: 'Rock Nacional',
        key: 'G',
        capo: 0,
        bpm: 112,
        hasChords: true,
        hasLyrics: true,
        hasTabs: false,
        hasSheetMusic: false,
        sourceProvider: 'cifraclub',
        sourceUrl: 'https://www.cifraclub.com.br/raul-seixas/metamorfose-ambulante/',
        licenseType: 'licensed',
        downloadAllowed: true,
        printAllowed: true,
        duration: '3:50',
        chords: `[Intro] G  C  G  D

[Verso 1]
G                 C
 Eu prefiro ser essa metamorfose ambulante
G                    D
 Eu prefiro ser essa metamorfose ambulante
G            C
 Do que ter aquela velha opinião formada sobre tudo
G            D                                 G
 Do que ter aquela velha opinião formada sobre tudo`,
        lyrics: `Eu prefiro ser essa metamorfose ambulante
Eu prefiro ser essa metamorfose ambulante
Do que ter aquela velha opinião formada sobre tudo
Do que ter aquela velha opinião formada sobre tudo`,
      },
      {
        id: 'cat-9',
        title: 'Exagerado',
        artist: 'Cazuza',
        album: 'Exagerado',
        genre: 'Pop Rock',
        key: 'A',
        capo: 0,
        bpm: 128,
        hasChords: true,
        hasLyrics: true,
        hasTabs: false,
        hasSheetMusic: false,
        sourceProvider: 'vagalume',
        sourceUrl: 'https://www.vagalume.com.br/cazuza/exagerado.html',
        licenseType: 'licensed',
        downloadAllowed: true,
        printAllowed: true,
        duration: '3:45',
        chords: `[Intro] A  D  A  D

[Verso 1]
A                     D
 Amor da minha vida, daqui até a eternidade
A                    D
 Nossos remédios acabaram no domingo
A                      D
 E o nosso quarto de hotel virou um campo minado

[Refrão]
A            D
 Exagerado! Jogado aos teus pés
A                  D
 Eu sou mesmo exagerado!
A                  D
 Adoro um amor inventado!`,
        lyrics: `Amor da minha vida, daqui até a eternidade
Nossos remédios acabaram no domingo
E o nosso quarto de hotel virou um campo minado

Exagerado! Jogado aos teus pés
Eu sou mesmo exagerado!
Adoro um amor inventado!`,
      },
      {
        id: 'cat-10',
        title: 'Garota de Ipanema',
        artist: 'Tom Jobim & Vinicius de Moraes',
        album: 'Bossa Nova Classics',
        genre: 'Bossa Nova / MPB',
        key: 'F',
        capo: 0,
        bpm: 125,
        hasChords: true,
        hasLyrics: true,
        hasTabs: true,
        hasSheetMusic: true,
        sourceProvider: 'cifraclub',
        sourceUrl: 'https://www.cifraclub.com.br/tom-jobim/garota-de-ipanema/',
        licenseType: 'licensed',
        downloadAllowed: true,
        printAllowed: true,
        duration: '3:15',
        chords: `[Intro] F7M  G7  Gm7  Gb7M

[Verso 1]
F7M
 Olha que coisa mais linda
      G7
Mais cheia de graça
    Gm7
É ela, menina
       Gb7M         F7M
Que vem e que passa
      G7              Gm7  C7(9)
Num doce balanço a caminho do mar`,
        lyrics: `Olha que coisa mais linda, mais cheia de graça
É ela, menina, que vem e que passa
Num doce balanço a caminho do mar`,
      },
      {
        id: 'cat-11',
        title: 'Lugar Secreto',
        artist: 'Gabriela Rocha',
        album: 'Céu',
        genre: 'Gospel',
        key: 'E',
        capo: 0,
        bpm: 72,
        hasChords: true,
        hasLyrics: true,
        hasTabs: false,
        hasSheetMusic: false,
        sourceProvider: 'cifraclub',
        sourceUrl: 'https://www.cifraclub.com.br/gabriela-rocha/lugar-secreto/',
        licenseType: 'licensed',
        downloadAllowed: true,
        printAllowed: true,
        duration: '4:50',
        chords: `[Intro] C#m  A  E  B (2x)

[Verso 1]
C#m               A
Tu és tudo o que eu mais quero
E               B
O meu fôlego, tudo em mim
C#m             A
No teu olhar encontro a paz
E                   B
Que o mundo não pode me tirar

[Refrão]
C#m          A
Leva-me à sala do trono
E           B
Mostra-me a tua beleza
C#m       A             E     B
Eu quero te ver, eu quero te ver`,
        lyrics: `Tu és tudo o que eu mais quero
O meu fôlego, tudo em mim
No teu olhar encontro a paz
Que o mundo não pode me tirar

Leva-me à sala do trono
Mostra-me a tua beleza
Eu quero te ver, eu quero te ver`,
      },
      {
        id: 'cat-12',
        title: 'Notificação Preferida',
        artist: 'Zé Neto & Cristiano',
        album: 'Esquece o Mundo Lá Fora',
        genre: 'Sertanejo',
        key: 'G',
        capo: 0,
        bpm: 110,
        hasChords: true,
        hasLyrics: true,
        hasTabs: false,
        hasSheetMusic: false,
        sourceProvider: 'cifraclub',
        sourceUrl: 'https://www.cifraclub.com.br/ze-neto-e-cristiano/notificacao-preferida/',
        licenseType: 'licensed',
        downloadAllowed: true,
        printAllowed: true,
        duration: '3:10',
        chords: `[Intro] G  D  Em  C

[Verso 1]
G
Foi só um beijo na boca
D
Um copo de cerveja e uma noite louca
Em
E agora meu celular não para
C
Você me chama e a saudade dispara

[Refrão]
G
Você virou minha notificação preferida
D
O motivo do sorriso que ilumina a minha vida
Em                                   C
E quando toca eu já sei quem tá chamando
C               D            G
É o meu amor dizendo que tá me amando`,
        lyrics: `Foi só um beijo na boca
Um copo de cerveja e uma noite louca
E agora meu celular não para
Você me chama e a saudade dispara

Você virou minha notificação preferida
O motivo do sorriso que ilumina a minha vida
E quando toca eu já sei quem tá chamando
É o meu amor dizendo que tá me amando`,
      },
      {
        id: 'cat-13',
        title: 'Céu Azul',
        artist: 'Charlie Brown Jr',
        album: 'Música Popular Caiçara',
        genre: 'Rock',
        key: 'G',
        capo: 0,
        bpm: 92,
        hasChords: true,
        hasLyrics: true,
        hasTabs: true,
        hasSheetMusic: false,
        sourceProvider: 'cifraclub',
        sourceUrl: 'https://www.cifraclub.com.br/charlie-brown-jr/ceu-azul/',
        licenseType: 'licensed',
        downloadAllowed: true,
        printAllowed: true,
        duration: '3:20',
        chords: `[Intro] G  D  Em  C (2x)

[Verso 1]
G                 D
Tão natural quanto a luz do dia
Em                     C
Mas que preguiça boa, me deixa aqui à toa
G                 D
Hoje ninguém vai estragar meu dia
Em                     C
Só vou gastar energia pra beijar sua boca

[Refrão]
G                D
Uma fita no cabelo, um sorriso no olhar
Em                C
Um sol de primavera me convidando pra voar
G             D                 Em   C
Alguém me disse que a vida é pra viver`,
        lyrics: `Tão natural quanto a luz do dia
Mas que preguiça boa, me deixa aqui à toa
Hoje ninguém vai estragar meu dia
Só vou gastar energia pra beijar sua boca

Uma fita no cabelo, um sorriso no olhar
Um sol de primavera me convidando pra voar
Alguém me disse que a vida é pra viver`,
      },
      {
        id: 'cat-14',
        title: 'Perfect',
        artist: 'Ed Sheeran',
        album: 'Divide',
        genre: 'Pop',
        key: 'G',
        capo: 1,
        bpm: 95,
        hasChords: true,
        hasLyrics: true,
        hasTabs: true,
        hasSheetMusic: false,
        sourceProvider: 'vagalume',
        sourceUrl: 'https://www.vagalume.com.br/ed-sheeran/perfect.html',
        licenseType: 'licensed',
        downloadAllowed: true,
        printAllowed: true,
        duration: '4:23',
        chords: `[Intro] G  Em  C  D

[Verse 1]
G                     Em
I found a love for me
                  C
Darling, just dive right in
               D
And follow my lead
G                       Em
Well, I found a girl, beautiful and sweet
   C                                          D
I never knew you were the someone waiting for me

[Chorus]
     Em           C              G            D
'Cause we were just kids when we fell in love
               Em             C           G    D
Not knowing what it was, I will not give you up this time
     Em           C                   G
Darling, just kiss me slow, your heart is all I own
     D                  Em        C      D       G
And in your eyes, you're holding mine... Baby, I'm dancing in the dark`,
        lyrics: `I found a love for me
Darling, just dive right in and follow my lead
Well, I found a girl, beautiful and sweet
I never knew you were the someone waiting for me

'Cause we were just kids when we fell in love
Not knowing what it was, I will not give you up this time
Darling, just kiss me slow, your heart is all I own
And in your eyes, you're holding mine... Baby, I'm dancing in the dark`,
      },
      {
        id: 'cat-15',
        title: 'Oceano',
        artist: 'Djavan',
        album: 'Djavan',
        genre: 'MPB',
        key: 'A',
        capo: 0,
        bpm: 88,
        hasChords: true,
        hasLyrics: true,
        hasTabs: false,
        hasSheetMusic: false,
        sourceProvider: 'cifraclub',
        sourceUrl: 'https://www.cifraclub.com.br/djavan/oceano/',
        licenseType: 'licensed',
        downloadAllowed: true,
        printAllowed: true,
        duration: '4:55',
        chords: `[Intro] A7M  F#m7  Bm7  E7(9)

[Verso 1]
A7M               F#m7
Assim que o dia amanheceu
Bm7                E7(9)
Lá no mar alto da paixão
A7M               F#m7
Dava pra ver o tempo ruir
Bm7                E7(9)
Cadê você, cadê você?

[Refrão]
C#m7            F#7
Você deságua em mim
Bm7               E7
E eu, oceano
C#m7            F#7
E me esvazio em tudo
Bm7           E7          A7M
Que vem de você`,
        lyrics: `Assim que o dia amanheceu
Lá no mar alto da paixão
Dava pra ver o tempo ruir
Cadê você, cadê você?

Você deságua em mim
E eu, oceano
E me esvazio em tudo
Que vem de você`,
      },
      {
        id: 'cat-16',
        title: 'Sozinho',
        artist: 'Caetano Veloso / Peninha',
        album: 'Prenda Minha',
        genre: 'MPB',
        key: 'G',
        capo: 0,
        bpm: 84,
        hasChords: true,
        hasLyrics: true,
        hasTabs: false,
        hasSheetMusic: false,
        sourceProvider: 'cifraclub',
        sourceUrl: 'https://www.cifraclub.com.br/caetano-veloso/sozinho/',
        licenseType: 'licensed',
        downloadAllowed: true,
        printAllowed: true,
        duration: '3:10',
        chords: `[Intro] G  D/F#  Em  C  D

[Verso 1]
G                 D/F#
Às vezes no silêncio da noite
Em                C
Eu fico imaginando nós dois
G                D/F#
Eu fico ali sonhando acordado
Em              C          D
Juntando o antes, o agora e o depois

[Refrão]
G             D/F#
Por que você me deixa tão solto?
Em            C
Por que você não cola em mim?
G           D/F#
Tô me sentindo muito sozinho
Em          C          D         G
Quando a noite cai assim`,
        lyrics: `Às vezes no silêncio da noite
Eu fico imaginando nós dois
Eu fico ali sonhando acordado
Juntando o antes, o agora e o depois

Por que você me deixa tão solto?
Por que você não cola em mim?
Tô me sentindo muito sozinho
Quando a noite cai assim`,
      },
      {
        id: 'cat-17',
        title: 'De Quem É A Culpa',
        artist: 'Marília Mendonça',
        album: 'Realidade',
        genre: 'Sertanejo',
        key: 'G',
        capo: 0,
        bpm: 96,
        hasChords: true,
        hasLyrics: true,
        hasTabs: false,
        hasSheetMusic: false,
        sourceProvider: 'cifraclub',
        sourceUrl: 'https://www.cifraclub.com.br/marilia-mendonca/de-quem-e-a-culpa/',
        licenseType: 'licensed',
        downloadAllowed: true,
        printAllowed: true,
        duration: '4:15',
        chords: `[Intro] G  D/F#  Em  C (2x)

[Verso 1]
G                 D/F#
Não sei se eu te odeio ou se eu te amo
Em                C
Não sei se vou ou fico aqui chorando
G                 D/F#
Você me faz perder todo o juízo
Em                C
E o meu silêncio é tudo que preciso

[Refrão]
G                    D/F#
De quem é a culpa se eu me apaixonei?
Em                   C
De quem é a culpa de tudo que entreguei?
G              D/F#
Se for pra chorar, eu choro agora
Em             C              G
Mas não vou ficar sofrendo lá fora`,
        lyrics: `Não sei se eu te odeio ou se eu te amo
Não sei se vou ou fico aqui chorando
Você me faz perder todo o juízo
E o meu silêncio é tudo que preciso

De quem é a culpa se eu me apaixonei?
De quem é a culpa de tudo que entreguei?
Se for pra chorar, eu choro agora
Mas não vou ficar sofrendo lá fora`,
      },
      {
        id: 'cat-18',
        title: 'Porque Ele Vive',
        artist: 'Harpa Cristã / Tradicional',
        album: 'Clássicos Cristãos',
        genre: 'Gospel',
        key: 'G',
        capo: 0,
        bpm: 80,
        hasChords: true,
        hasLyrics: true,
        hasTabs: false,
        hasSheetMusic: false,
        sourceProvider: 'cifraclub',
        sourceUrl: 'https://www.cifraclub.com.br/harpa-crista/porque-ele-vive/',
        licenseType: 'public_domain',
        downloadAllowed: true,
        printAllowed: true,
        duration: '4:00',
        chords: `[Intro] G  C  G  D  G

[Verso 1]
G            C              G
Deus enviou seu Filho amado
Em            Am         D
Pra perdoar, pra me salvar
G            C            G
Na cruz morreu por meus pecados
Em             Am       D           G
Mas ressurgiu e vivo com o Pai está

[Refrão]
G              C             G
Porque Ele vive, eu posso crer no amanhã
Em             Am           D
Porque Ele vive, temor não há
G             C          G       Em
Mas eu bem sei, eu sei, que a minha vida
         Am       D         G
Está nas mãos do meu Jesus, que vivo está`,
        lyrics: `Deus enviou seu Filho amado
Pra perdoar, pra me salvar
Na cruz morreu por meus pecados
Mas ressurgiu e vivo com o Pai está

Porque Ele vive, eu posso crer no amanhã
Porque Ele vive, temor não há
Mas eu bem sei, eu sei, que a minha vida
Está nas mãos do meu Jesus, que vivo está`,
      },
      {
        id: 'cat-19',
        title: 'Raridade',
        artist: 'Anderson Freire',
        album: 'Raridade',
        genre: 'Gospel',
        key: 'D',
        capo: 0,
        bpm: 78,
        hasChords: true,
        hasLyrics: true,
        hasTabs: false,
        hasSheetMusic: false,
        sourceProvider: 'cifraclub',
        sourceUrl: 'https://www.cifraclub.com.br/anderson-freire/raridade/',
        licenseType: 'licensed',
        downloadAllowed: true,
        printAllowed: true,
        duration: '4:40',
        chords: `[Intro] D  A/C#  Bm  G (2x)

[Verso 1]
D              A/C#
Não consigo entender tua grandeza
Bm             G
Diante da minha imperfeição
D              A/C#
Mas sinto tua presença tão perto
Bm             G
Curando as feridas do coração

[Refrão]
D               A/C#
Você é um espelho que reflete a imagem do Senhor
Bm              G
Não chore se o mundo ainda não notou
D               A/C#
Já é o bastante Deus reconhecer o seu valor
Bm             G              D
Você é precioso, mais raro que o ouro puro de Ofir`,
        lyrics: `Não consigo entender tua grandeza
Diante da minha imperfeição
Mas sinto tua presença tão perto
Curando as feridas do coração

Você é um espelho que reflete a imagem do Senhor
Não chore se o mundo ainda não notou
Já é o bastante Deus reconhecer o seu valor
Você é precioso, mais raro que o ouro puro de Ofir`,
      },
      {
        id: 'cat-20',
        title: 'Gostava Tanto de Você',
        artist: 'Tim Maia',
        album: 'Tim Maia 1973',
        genre: 'MPB / Soul',
        key: 'C',
        capo: 0,
        bpm: 90,
        hasChords: true,
        hasLyrics: true,
        hasTabs: false,
        hasSheetMusic: false,
        sourceProvider: 'cifraclub',
        sourceUrl: 'https://www.cifraclub.com.br/tim-maia/gostava-tanto-de-voce/',
        licenseType: 'licensed',
        downloadAllowed: true,
        printAllowed: true,
        duration: '4:15',
        chords: `[Intro] C7M  Am7  Dm7  G7 (2x)

[Verso 1]
C7M              Am7
Não sei por que você se foi
Dm7           G7
Quantas saudades eu senti
C7M              Am7
E de tristeza vou viver
Dm7            G7
Aquele adeus não pude dar

[Refrão]
C7M           Am7
Eu... gostava tanto de você
Dm7           G7
Gostava tanto de você!
C7M           Am7
Eu... gostava tanto de você
Dm7           G7         C7M
Gostava tanto de você!`,
        lyrics: `Não sei por que você se foi
Quantas saudades eu senti
E de tristeza vou viver
Aquele adeus não pude dar

Eu... gostava tanto de você
Gostava tanto de você!
Eu... gostava tanto de você
Gostava tanto de você!`,
      },
      {
        id: 'cat-21',
        title: 'Lugar ao Sol',
        artist: 'Charlie Brown Jr.',
        album: 'Bocas Ordinárias',
        genre: 'Rock',
        key: 'Em',
        capo: 0,
        bpm: 110,
        hasChords: true,
        hasLyrics: true,
        hasTabs: false,
        hasSheetMusic: false,
        sourceProvider: 'cifraclub',
        sourceUrl: 'https://www.cifraclub.com.br/charlie-brown-jr/lugar-ao-sol/',
        licenseType: 'licensed',
        downloadAllowed: true,
        printAllowed: true,
        duration: '03:27',
        chords: `[Intro] Em  C  G  D (2x)

[Verso 1]
Em            C
Que bom viver, como é bom sonhar
G                D
E o que ficou pra trás passou
Em                 C
Não dá pra esquecer, nem pra apagar
G              D
As marcas que a vida deixou

[Refrão]
Em               C
Lugar ao sol é o meu lugar
G              D
Eu sei que um dia vou chegar
Em               C
Lugar ao sol é o meu lugar
G           D              Em
A força que me faz seguir em frente`,
        lyrics: `Que bom viver, como é bom sonhar
E o que ficou pra trás passou
Não dá pra esquecer, nem pra apagar
As marcas que a vida deixou

Lugar ao sol é o meu lugar
Eu sei que um dia vou chegar
Lugar ao sol é o meu lugar
A força que me faz seguir em frente

É o que me faz seguir
É a força que ainda existe em mim
Não há nada no mundo
Que apague a chama no meu coração`,
      },
      {
        id: 'cat-22',
        title: 'Cedo Ou Tarde',
        artist: 'NX Zero',
        album: 'Agora',
        genre: 'Rock',
        key: 'G',
        capo: 0,
        bpm: 120,
        hasChords: true,
        hasLyrics: true,
        hasTabs: false,
        hasSheetMusic: false,
        sourceProvider: 'cifraclub',
        sourceUrl: 'https://www.cifraclub.com.br/nx-zero/cedo-ou-tarde/',
        licenseType: 'licensed',
        downloadAllowed: true,
        printAllowed: true,
        duration: '04:12',
        chords: `[Intro] G  D/F#  Em  C (2x)

[Verso 1]
G                 D/F#
Como um dia que começa sem você
Em                     C
Tento me lembrar de tudo que passou
G                  D/F#
O tempo não para e a vida continua
Em                    C
Mas guardo na memória o seu olhar

[Refrão]
G           D/F#
Cedo ou tarde
Em                 C
A gente vai se encontrar
G             D/F#
Tenho certeza
Em             C            G
Num bem melhor lugar pra ficar`,
        lyrics: `Como um dia que começa sem você
Tento me lembrar de tudo que passou
O tempo não para e a vida continua
Mas guardo na memória o seu olhar

Cedo ou tarde
A gente vai se encontrar
Tenho certeza
Num bem melhor lugar pra ficar

Mesmo sem você aqui
Ainda ouço a sua voz
Cedo ou tarde
O reencontro é só de nós`,
      },
      {
        id: 'cat-23',
        title: 'Outro Lugar',
        artist: 'Detonautas',
        album: 'Detonautas Roque Clube',
        genre: 'Rock',
        key: 'Am',
        capo: 0,
        bpm: 115,
        hasChords: true,
        hasLyrics: true,
        hasTabs: false,
        hasSheetMusic: false,
        sourceProvider: 'vagalume',
        sourceUrl: 'https://www.vagalume.com.br/detonautas/outro-lugar.html',
        licenseType: 'licensed',
        downloadAllowed: true,
        printAllowed: true,
        duration: '02:58',
        chords: `[Intro] Am  F  C  G (2x)

[Verso 1]
Am            F
Estou em outro lugar
C                      G
Onde o tempo não passa devagar
Am                 F
Vejo as coisas com mais clareza
C              G
E a certeza de querer voar

[Refrão]
Am             F
Seja onde for, seja com quem for
C             G
Eu levo no peito esse amor
Am             F
Em outro lugar eu me encontrei
C                G          Am
Tudo aquilo que um dia sonhei`,
        lyrics: `Estou em outro lugar
Onde o tempo não passa devagar
Vejo as coisas com mais clareza
E a certeza de querer voar

Seja onde for, seja com quem for
Eu levo no peito esse amor
Em outro lugar eu me encontrei
Tudo aquilo que um dia sonhei`,
      },
      {
        id: 'cat-24',
        title: 'Sem Radar',
        artist: 'LS Jack',
        album: 'Olho de Vidro',
        genre: 'Pop',
        key: 'D',
        capo: 0,
        bpm: 105,
        hasChords: true,
        hasLyrics: true,
        hasTabs: false,
        hasSheetMusic: false,
        sourceProvider: 'cifraclub',
        sourceUrl: 'https://www.cifraclub.com.br/ls-jack/sem-radar/',
        licenseType: 'licensed',
        downloadAllowed: true,
        printAllowed: true,
        duration: '03:45',
        chords: `[Intro] D  A  Bm  G (2x)

[Verso 1]
D                A
Não sei viver sem você, meu amor
Bm                G
Tudo é tão frio sem o seu calor
D                 A
Perdi o meu rumo, fiquei sem radar
Bm               G
Nas asas do vento querendo te achar

[Refrão]
D           A
Sem radar, no céu sem cor
Bm           G
Procurando pelo teu amor
D             A
Vem me salvar dessa solidão
Bm            G               D
Você é a dona do meu coração`,
        lyrics: `Não sei viver sem você, meu amor
Tudo é tão frio sem o seu calor
Perdi o meu rumo, fiquei sem radar
Nas asas do vento querendo te achar

Sem radar, no céu sem cor
Procurando pelo teu amor
Vem me salvar dessa solidão
Você é a dona do meu coração`,
      },
    ];

export function getCatalogSeed(): DetailedSongItem[] {
  return CATALOG_SEED;
}

export function getCatalogSongById(id: string | number): DetailedSongItem | null {
  if (!id) return null;
  const idStr = String(id).trim();
  const cleanNum = idStr.replace(/^cat-/, '');
  return (
    CATALOG_SEED.find((s) => {
      const sId = String(s.id);
      return (
        sId === idStr ||
        sId === `cat-${idStr}` ||
        sId.replace(/^cat-/, '') === cleanNum ||
        (cleanNum !== '' && sId === cleanNum)
      );
    }) || null
  );
}

export function findCatalogSongByTitleOrId(identifier: string | number, artist?: string): DetailedSongItem | null {
  if (!identifier) return null;
  // First attempt by ID
  const byId = getCatalogSongById(identifier);
  if (byId) return byId;

  // Attempt by normalized Title & Artist
  const normTitle = normalizeSearchText(String(identifier));
  const normArtist = artist ? normalizeSearchText(artist) : '';

  const found = CATALOG_SEED.find((s) => {
    const sTitle = normalizeSearchText(s.title);
    const sArtist = normalizeSearchText(s.artist);
    if (normArtist && sArtist.includes(normArtist) && sTitle.includes(normTitle)) {
      return true;
    }
    return sTitle === normTitle || (normTitle.length > 3 && sTitle.includes(normTitle));
  });

  return found || null;
}

export function searchCatalogSeed(query: string, genre?: string): DetailedSongItem[] {
  const normalizedQuery = normalizeSearchText(query);
  return CATALOG_SEED.filter((song) => {
    if (genre && genre !== 'todos' && song.genre?.toLowerCase() !== genre.toLowerCase()) {
      return false;
    }
    if (!normalizedQuery) return true;
    const matchTitle = normalizeSearchText(song.title).includes(normalizedQuery);
    const matchArtist = normalizeSearchText(song.artist).includes(normalizedQuery);
    return matchTitle || matchArtist;
  });
}
