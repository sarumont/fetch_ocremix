#!/usr/bin/env node

const fs = require('fs');
const Parser = require('rss-parser');
const parser = new Parser();
const fetch = require('node-fetch');

const dlRe = /.*href=\"(.*)\".*Download from.*/g;
const dest = '/media/smb-chocobo.local-misc/OCR/'

let lastFile = process.env.HOME + '/.ocr-last'
let last = 0;
try {
  last = new Number(fs.readFileSync(lastFile, 'utf-8'));
} catch (e) {
  // don't care
}
console.log("Last: ", last);

/**
 * Strips a GUID (which is a URL) to the numeric version of the OCR ID
 */
async function getRemixNum(guid) {
  let parts = guid.split('/');
  let last = parts[parts.length - 2];
  return new Number(last.replace(/[a-z]/ig, ''));
}

async function fetchRemix(url) {
  console.log('Downloading %s', url);
  fetch(url)
    .then(function(response) {
      return response.text()
    })
    .then(function(html) {

      let links = [];
      html.split('\n').forEach(line => {
        let match = dlRe.exec(line);
        if (match) {
          links.push(match[1]);
        }
      })

      let link = links[Math.floor(Math.random() * links.length)];
      let parts = link.split('/')
      let fn = dest + parts[parts.length - 1];
      if (fs.accessSync(fn)) {
        console.log('%s exists - skipping', )
        return;
      }
      console.log('Downloading from %s to %s', link, fn);
      fetch(link)
        .then(function(response) {
          var fd = fs.createWriteStream(fn);
          response.body.pipe(fd);
          fd.on('finish', () => {
            fd.close();
          });
        });
    })
    .catch(function(err) {  
      console.log('Failed to fetch page: ', err);  
    });
}
 
(async () => {
 
  let feed = await parser.parseURL('http://ocremix.org/feeds/ten20/');

  feed.items.sort((a, b) => {
    let d1 = new Date(a.isoDate);
    let d2 = new Date(b.isoDate);
    return d1.valueOf() - d2.valueOf();
  })

  let caughtUp = false;
  let num = 0;
  for (let i = 0; i < feed.items.length; i++) {
    let item = feed.items[i];
    num = await getRemixNum(item.guid)
    if (num > last) {
      if (num - 1 != last && ! caughtUp) {
        for (var n = last + 1; n < num; n++) {
          let url = "http://www.ocremix.org/remix/OCR0" + n + "/";
          await fetchRemix(url);
        }
        caughtUp = true;
      }
      await fetchRemix(item.guid);
    } else {
      console.log("Already have " + item.guid);
    }
  }

  console.log('Setting new last to ' + num);
  fs.writeFileSync(lastFile, `${num}`);

})();
