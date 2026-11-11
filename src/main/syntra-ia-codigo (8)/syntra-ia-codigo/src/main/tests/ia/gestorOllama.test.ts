import { test, expect } from 'vitest';
import http from 'node:http';
import { EventEmitter } from 'node:events';
import { spawn, type ChildProcess } from 'node:child_process';
import type { AddressInfo } from 'node:net';
import { GestorOllama, normalizarHost, type EventoOllama } from '../../servicios/ia/GestorOllama.js';

// Servidor que imita a Ollama: /api/tags (modelos instalados) y /api/pull (descarga con progreso)
async function servidorFalso(opciones: { instalados?: string[]; lento?: boolean } = {}) {
  const instalados = [...(opciones.instalados ?? [])];
  const srv = http.createServer((req, res) => {
    if (req.url === '/api/tags') {
      res.end(JSON.stringify({ models: instalados.map((name) => ({ name })) }));
    } else if (req.url === '/api/pull') {
      const lineas = [
        { status: 'pulling manifest' },
        { status: 'pulling abc', total: 100, completed: 50 },
        { status: 'pulling abc', total: 100, completed: 50 }, // repetida: no debe avisar dos veces
        { status: 'pulling abc', total: 100, completed: 100 },
        { status: 'success' },
      ];
      let i = 0;
      const siguiente = () => {
        const linea = lineas[i++];
        if (!linea) {
          instalados.push('gemma-falso:latest');
          return res.end();
        }
        res.write(JSON.stringify(linea) + '\n');
        setTimeout(siguiente, opciones.lento ? 200 : 1);
      };
      siguiente();
    } else {
      res.statusCode = 404;
      res.end();
    }
  });
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
  const host = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  const estado = async () => {
    try {
      const j = (await (await fetch(`${host}/api/tags`)).json()) as { models: { name: string }[] };
      return { corriendo: true, modeloInstalado: j.models.some((m) => m.name === 'gemma-falso:latest') };
    } catch {
      return { corriendo: false, modeloInstalado: false };
    }
  };
  return { srv, host, estado, cerrar: () => new Promise<void>((r) => srv.close(() => r())) };
}

test('normalizarHost: acepta el formato de OLLAMA_HOST sin http y 0.0.0.0', () => {
  expect(normalizarHost(undefined)).toBe('http://127.0.0.1:11434');
  expect(normalizarHost('127.0.0.1:11434')).toBe('http://127.0.0.1:11434');
  expect(normalizarHost('0.0.0.0:11434')).toBe('http://127.0.0.1:11434');
  expect(normalizarHost('http://mi-pc:11434/')).toBe('http://mi-pc:11434');
});

test('preparar: si ya corre y el modelo está, avisa "listo" sin lanzar nada', async () => {
  const s = await servidorFalso({ instalados: ['gemma-falso:latest'] });
  const eventos: EventoOllama[] = [];
  let lanzado = false;
  const g = new GestorOllama({ host: s.host, modelo: 'gemma-falso', estado: s.estado, alEvento: (e) => eventos.push(e), lanzar: () => { lanzado = true; throw new Error('no debía lanzar'); } });
  await g.preparar();
  expect(lanzado).toBe(false);
  expect(g.ultimo).toEqual({ tipo: 'listo' });
  await s.cerrar();
});

test('preparar: corre pero falta el modelo → avisa y NO descarga sin permiso', async () => {
  const s = await servidorFalso();
  const g = new GestorOllama({ host: s.host, modelo: 'gemma-falso', estado: s.estado });
  await g.preparar();
  expect(g.ultimo).toEqual({ tipo: 'falta_modelo' });
  expect((await s.estado()).modeloInstalado).toBe(false);
  await s.cerrar();
});

test('preparar con autoDescargar: descarga el modelo y termina en "listo"', async () => {
  const s = await servidorFalso();
  const g = new GestorOllama({ host: s.host, modelo: 'gemma-falso', estado: s.estado, autoDescargar: true });
  await g.preparar();
  expect(g.ultimo).toEqual({ tipo: 'listo' });
  expect((await s.estado()).modeloInstalado).toBe(true);
  await s.cerrar();
});

test('descargarModelo: informa el porcentaje sin repetir avisos', async () => {
  const s = await servidorFalso();
  const eventos: EventoOllama[] = [];
  const g = new GestorOllama({ host: s.host, modelo: 'gemma-falso', estado: s.estado, alEvento: (e) => eventos.push(e) });
  const r = await g.descargarModelo();
  expect(r.ok).toBe(true);
  const pcts = eventos.flatMap((e) => (e.tipo === 'descargando' && e.porcentaje !== null ? [e.porcentaje] : []));
  expect(pcts).toEqual([50, 100]); // el 50 repetido se descartó
  await s.cerrar();
});

test('descargarModelo: se puede cancelar y no deja un error', async () => {
  const s = await servidorFalso({ lento: true });
  const g = new GestorOllama({ host: s.host, modelo: 'gemma-falso', estado: s.estado });
  const p = g.descargarModelo();
  setTimeout(() => g.cancelarDescarga(), 250);
  const r = await p;
  expect(r.ok).toBe(false);
  expect(g.ultimo).toEqual({ tipo: 'falta_modelo' });
  await s.cerrar();
});

test('asegurarCorriendo: si está apagado lo lanza y espera a que responda', async () => {
  const s = await servidorFalso({ instalados: ['gemma-falso:latest'] });
  let encendido = false;
  const estado = async () => (encendido ? s.estado() : { corriendo: false, modeloInstalado: false });
  let muerto = false;
  const falso = Object.assign(new EventEmitter(), { kill: () => { muerto = true; return true; } }) as unknown as ChildProcess;
  const g = new GestorOllama({ host: s.host, modelo: 'gemma-falso', estado, pausaMs: 10, lanzar: () => { setTimeout(() => (encendido = true), 50); return falso; } });
  expect(await g.asegurarCorriendo()).toBe('ok');
  g.detener(); // lo iniciamos nosotros → se apaga
  expect(muerto).toBe(true);
  await s.cerrar();
});

test('asegurarCorriendo: si el comando ollama no existe, devuelve no_instalado (sin romper la app)', async () => {
  const estado = async () => ({ corriendo: false, modeloInstalado: false });
  const g = new GestorOllama({ host: 'http://127.0.0.1:1', modelo: 'x', estado, pausaMs: 10, lanzar: () => spawn('comando-que-no-existe-ollama-xyz', ['serve'], { stdio: 'ignore' }) });
  expect(await g.asegurarCorriendo()).toBe('no_instalado');
});

test('asegurarCorriendo: si no responde a tiempo, devuelve no_arranco y lo apaga', async () => {
  const estado = async () => ({ corriendo: false, modeloInstalado: false });
  let muerto = false;
  const falso = Object.assign(new EventEmitter(), { kill: () => { muerto = true; return true; } }) as unknown as ChildProcess;
  const g = new GestorOllama({ host: 'http://127.0.0.1:1', modelo: 'x', estado, pausaMs: 10, esperaArranqueMs: 100, lanzar: () => falso });
  expect(await g.asegurarCorriendo()).toBe('no_arranco');
  expect(muerto).toBe(true);
});
