import http from 'http';

const PORT = 3000;
const TARGET = 'http://localhost:8000';

const server = http.createServer((req, res) => {
  const targetUrl = `${TARGET}${req.url || '/'}`;
  res.writeHead(302, {
    Location: targetUrl,
    'Content-Type': 'text/html; charset=utf-8'
  });
  res.end(`<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=${targetUrl}"></head><body>Redirecting to Laravel Backend at <a href="${targetUrl}">${targetUrl}</a>...</body></html>`);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Hostel Attendance System] Port 3000 is now redirecting all traffic to Laravel Backend on ${TARGET}`);
});
