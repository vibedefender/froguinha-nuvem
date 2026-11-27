// Uma PARTE do vídeo da Central (só a imagem), igual à edição A do montar.mjs: corte seco entre trechos, 1920×1080 30 fps,
// logo da Central sempre e a pílula "Curta e se inscreva" 8 s a cada 10 min (contando o tempo do vídeo INTEIRO: offset da parte).
// Roda na nuvem (GitHub Actions) e, se a nuvem falhar, no PC — o mesmo arquivo nos dois lugares.
// uso: node parte.mjs <plano.json> <n da parte> <saida.mp4> <fonte-0.mp4> [fonte-1.mp4 ...]
// plano.json: { partes: [ { offset: s, trechos: [ { fonte: 0, de: s, dur: s } ] } ] }
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const [planoArq, nTxt, saida, ...fontes] = process.argv.slice(2);
const parte = JSON.parse(readFileSync(planoArq, 'utf8')).partes[Number(nTxt)];
const args = ['-v', 'error', '-stats', '-y'];
// busca precisa na entrada (-ss antes do -i): cada trecho decodifica só o seu pedaço, não o arquivo desde o começo
for (const t of parte.trechos) args.push('-ss', t.de.toFixed(3), '-t', t.dur.toFixed(3), '-i', fontes[t.fonte]);
args.push('-i', join(AQUI, 'modelos', 'marca-pilula.png'), '-i', join(AQUI, 'modelos', 'marca-logo.png'));
const pil = parte.trechos.length, logo = pil + 1, off = parte.offset.toFixed(3);
const v = parte.trechos.map((_, i) => `[${i}:v]setpts=PTS-STARTPTS,fps=30,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1[v${i}];`).join('');
const juntar = parte.trechos.map((_, i) => `[v${i}]`).join('') + `concat=n=${parte.trechos.length}:v=1:a=0[pv];`;
const marca = `[pv][${pil}:v]overlay=enable='lt(mod(t+${off}\\,600)\\,8)'[m1];[m1][${logo}:v]overlay=enable='gte(mod(t+${off}\\,600)\\,8)'[vout]`;
// número EXATO de quadros (teste 22/11: sem isso cada parte sobrava ~0,5 quadro e o vídeo inteiro ficava 5 quadros/0,17 s atrás do som)
const soma = parte.trechos.reduce((s, t) => s + t.dur, 0);
const quadros = Math.round((parte.offset + soma) * 30) - Math.round(parte.offset * 30);
args.push('-filter_complex', v + juntar + marca, '-map', '[vout]', '-an', '-frames:v', String(quadros),
  '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '30', '-video_track_timescale', '15360', saida);
const p = spawn('ffmpeg', args, { stdio: 'inherit', windowsHide: true });
p.on('close', c => process.exit(c ?? 1));
