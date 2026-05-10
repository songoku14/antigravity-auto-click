const { findCDPPort, getTargets, filterPageTargets } = require('../src/discovery');

async function check() {
  const port = findCDPPort();
  console.log('Discovered port:', port);
  if (!port) return;
  
  const targets = await getTargets(port);
  const pages = filterPageTargets(targets);
  console.log('Found', pages.length, 'pages:');
  pages.forEach(p => console.log(' -', p.title, p.url));
}

check();
