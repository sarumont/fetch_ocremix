#!/usr/bin/env node

import {
  readFileSync,
  accessSync,
  createWriteStream,
  writeFileSync
} from 'fs';
import * as path from 'path';
import Parser from 'rss-parser';
import fetch from 'node-fetch';

const parser = new Parser();
const dlRe = /.*href="(.*)".*Download from.*/g;
const dest = '/media/smb-chocobo.local-misc/OCR/';

const lastFile = path.join(process.env.HOME, '.ocr-last');
let last = 0;
try {
  last = Number(readFileSync(lastFile, 'utf-8'));
} catch (e) {
  // don't care
}

// TODO: debug
console.log('Last: %s', last);

/**
 * Strips a GUID (which is a URL) to the numeric version of the OCR ID
 */
function getRemixNum(guid) {
  const parts = guid.split('/');
  const lLast = parts[parts.length - 2];
  return Number(lLast.replace(/[a-z]/ig, ''));
}

async function fetchRemix(url) {
  console.log('Downloading %s', url);
  return fetch(url)
    .then((response) => response.text())
    .then(async (html) => {
      const links = [];
      html.split('\n').forEach((line) => {
        const match = dlRe.exec(line);
        if (match) {
          links.push(match[1]);
        }
      });

      const link = links[Math.floor(Math.random() * links.length)];
      const parts = link.split('/');
      const fn = dest + parts[parts.length - 1];
      try {
        accessSync(fn);
        console.log('%s exists - skipping', fn);
        return;
      } catch (e) {
        // don't care
      }
      console.log('Downloading from %s to %s', link, fn);
      const response = await fetch(link);
      const fd = createWriteStream(fn);
      response.body.pipe(fd);
      fd.on('finish', () => {
        fd.close();
      });
    })
    .catch((err) => {
      console.log('Failed to fetch page: ', err);
    });
}

(async () => {
  const feed = await parser.parseURL('http://ocremix.org/feeds/ten20/');

  feed.items.sort((a, b) => {
    const d1 = new Date(a.isoDate);
    const d2 = new Date(b.isoDate);
    return d1.valueOf() - d2.valueOf();
  });

  let caughtUp = false;
  let num = 0;
  const promises = [];
  for (let i = 0; i < feed.items.length; i++) {
    const item = feed.items[i];
    num = getRemixNum(item.guid);
    if (!last || last === 0) {
      last = num - 1;
    }
    if (num > last) {
      if (num - 1 !== last && !caughtUp) {
        for (let n = last + 1; n < num; n++) {
          const url = `http://www.ocremix.org/remix/OCR0${n}/`;
          promises.push(fetchRemix(url));
        }
        caughtUp = true;
      }
      promises.push(fetchRemix(item.guid));
    } else {
      console.log('Already have %s', item.guid);
    }
  }
  await Promise.all(promises);
  console.log('Setting new last to %s', num);
  writeFileSync(lastFile, `${num}`);
})();
