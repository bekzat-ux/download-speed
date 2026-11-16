#!/usr/bin/env node
'use strict';

const { performance } = require('node:perf_hooks');

const REQUESTS_COUNT = 10;
const BYTES_IN_MB = 1_000_000; // 1 МБ = 1 000 000 байт

/**
 * Выполняет один запрос и дожидается полного получения тела ответа.
 * @param {string} url
 * @returns {Promise<{bytes: number, ms: number}>}
 */
async function fetchOnce(url) {
  const start = performance.now();

  const response = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
  }

  return { bytes, ms: performance.now() - start };
}

function parseUrl(arg) {
  if (!arg) {
    console.error('Использование: node index.js <url>');
    process.exit(1);
  }
  try {
    const url = new URL(arg);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('поддерживаются только http и https');
    }
    return url.href;
  } catch (err) {
    console.error(`Некорректный адрес: ${err.message}`);
    process.exit(1);
  }
}

async function main() {
  const url = parseUrl(process.argv[2]);
  console.log(`Адрес: ${url}`);
  console.log(`Запросов: ${REQUESTS_COUNT} (последовательно)\n`);

  const results = [];
  let failed = 0;

  // Запросы идут строго по очереди: следующий начинается после полного ответа на предыдущий
  for (let i = 1; i <= REQUESTS_COUNT; i++) {
    try {
      const result = await fetchOnce(url);
      results.push(result);
      console.log(
        `#${String(i).padStart(2)}: ${(result.bytes / BYTES_IN_MB).toFixed(3)} МБ за ${result.ms.toFixed(0)} мс`
      );
    } catch (err) {
      failed++;
      console.log(`#${String(i).padStart(2)}: ошибка — ${err.message}`);
    }
  }

  if (results.length === 0) {
    console.error('\nНи один запрос не завершился успешно.');
    process.exit(1);
  }

  const totalBytes = results.reduce((sum, r) => sum + r.bytes, 0);
  const totalMs = results.reduce((sum, r) => sum + r.ms, 0);
  const avgMs = totalMs / results.length;
  const seconds = totalMs / 1000;
  const speedMBps = totalBytes / BYTES_IN_MB / seconds;
  const speedMbps = (totalBytes * 8) / 1_000_000 / seconds;

  console.log('\n--- Итоги ---');
  console.log(`Успешных запросов:    ${results.length} из ${REQUESTS_COUNT}` + (failed ? ` (ошибок: ${failed})` : ''));
  console.log(`Среднее время:        ${avgMs.toFixed(0)} мс`);
  console.log(`Скачано всего:        ${(totalBytes / BYTES_IN_MB).toFixed(3)} МБ (${totalBytes} байт)`);
  console.log(`Скорость скачивания:  ${speedMBps.toFixed(2)} МБ/с (${speedMbps.toFixed(2)} Мбит/с)`);
}

main().catch((err) => {
  console.error(`Непредвиденная ошибка: ${err.message}`);
  process.exit(1);
});
