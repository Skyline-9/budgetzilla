import http from "node:http";
import https from "node:https";
import { SocksProxyAgent } from "socks-proxy-agent";

const agent = new SocksProxyAgent("socks5h://127.0.0.1:9090");

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Expose-Headers", "*");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const hfPath = req.url || "/";
  const hfUrl = new URL(hfPath, "https://huggingface.co");
  console.log(`[proxy] ${req.method} ${hfUrl.href}`);

  const doRequest = (url) => {
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: req.method,
      agent,
      headers: { host: url.hostname, "user-agent": "transformers.js" },
    };
    const proxy = https.request(options, (proxyRes) => {
      if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
        const redirectUrl = new URL(proxyRes.headers.location, url);
        console.log(`[proxy] -> redirect ${redirectUrl.href}`);
        doRequest(redirectUrl);
      } else {
        const headers = { ...proxyRes.headers };
        delete headers["access-control-allow-origin"];
        res.writeHead(proxyRes.statusCode || 200, {
          ...headers,
          "access-control-allow-origin": "*",
        });
        proxyRes.pipe(res);
      }
    });
    proxy.on("error", (e) => {
      console.error(`[proxy] error: ${e.message}`);
      res.writeHead(502);
      res.end(String(e));
    });
    proxy.end();
  };

  doRequest(hfUrl);
});

server.listen(8787, () => console.log("[proxy] HuggingFace SOCKS proxy on http://localhost:8787"));
