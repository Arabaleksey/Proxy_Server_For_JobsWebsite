const express = require("express");
const cors = require("cors");
const proxy = require("express-http-proxy");
const requestIp = require("request-ip");
const { LRUCache } = require("lru-cache");

const app = express();
const port = 3001;

const cookiePerIP = new LRUCache({
  max: 1000,
  ttl: 1000 * 60 * 3,
  updateAgeOnGet: false,
  updateAgeOnHas: false,
});

app.use(
  cors({
    origin: true,
  })
);

app.use(requestIp.mw());

app.use(
  "/",
  proxy("https://api.superjob.ru", {
    https: true,
    userResHeaderDecorator(headers, userReq) {
      const key = userReq.clientIp;

      if (headers["set-cookie"]) {
        const newCookies = headers["set-cookie"].map((c) => {
          const [key, value] = c.split(";")[0].split("=");
          return { key, value };
        });

        const previousCookies = cookiePerIP.get(key) || [];
        const currentCookies = previousCookies.concat(newCookies);

        cookiePerIP.set(key, currentCookies);
      }

      return headers;
    },
    proxyReqOptDecorator: function (proxyReqOpts, srcReq) {
      const key = srcReq.clientIp;

      if (cookiePerIP.has(key)) {
        const cookies = cookiePerIP
          .get(key)
          .map((c) => `${c.key}=${c.value}`)
          .join(";");

        proxyReqOpts.headers["cookie"] = cookies;
      }

      return proxyReqOpts;
    },
  })
);

app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).send("Server error");
});

app.listen(port, () => {
  console.log("Server started");
});
