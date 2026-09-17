const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { spawn } = require("node:child_process");
const ffmpegPath = require("ffmpeg-static");
const ytDlpPath = path.resolve(path.dirname(require.resolve("yt-dlp-exec")), "../bin/yt-dlp");

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const formats = {
  mp4: { mime: "video/mp4", args: ["-c:v", "libx264", "-c:a", "aac", "-movflags", "+faststart"] },
  mkv: { mime: "video/x-matroska", args: ["-c:v", "libx264", "-c:a", "aac"] },
  mp3: { mime: "audio/mpeg", args: ["-vn", "-c:a", "libmp3lame", "-b:a", "192k"] },
  wav: { mime: "audio/wav", args: ["-vn", "-c:a", "pcm_s16le"] },
};
const mimeTypes = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd });
    let error = "";
    child.stderr.on("data", (chunk) => { error += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(error.trim().split("\n").slice(-1)[0] || `${command} failed`)));
  });
}

function validRemoteUrl(value) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return false;
    if (["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(url.hostname)) return false;
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(url.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

async function convert(response, payload) {
  const format = formats[payload.format];
  if (!format || !validRemoteUrl(payload.url)) return sendJson(response, 400, { error: "Use a public http(s) video link and a supported format." });
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "reelcut-"));
  const sourcePattern = path.join(workdir, "source.%(ext)s");
  const output = path.join(workdir, `reelcut.${payload.format}`);
  try {
    await run(ytDlpPath, ["--no-playlist", "-f", "bestvideo+bestaudio/best", "--merge-output-format", "mp4", "-o", sourcePattern, payload.url], workdir);
    const source = fs.readdirSync(workdir).find((file) => file.startsWith("source."));
    if (!source) throw new Error("No playable media was found at that link.");
    await run(ffmpegPath, ["-y", "-i", path.join(workdir, source), ...format.args, output], workdir);
    const file = fs.readFileSync(output);
    response.writeHead(200, { "Content-Type": format.mime, "Content-Length": file.length, "Content-Disposition": `attachment; filename="reelcut.${payload.format}"` });
    response.end(file);
  } catch (error) {
    const message = error.code === "ENOENT" ? "The conversion tools are not available yet. Run npm install and restart the server." : error.message;
    sendJson(response, 502, { error: message });
  } finally {
    fs.rmSync(workdir, { recursive: true, force: true });
  }
}

const server = http.createServer((request, response) => {
  if (request.method === "POST" && request.url === "/api/convert") {
    let body = "";
    request.on("data", (chunk) => { body += chunk; if (body.length > 10000) request.destroy(); });
    request.on("end", () => { try { convert(response, JSON.parse(body)); } catch { sendJson(response, 400, { error: "Invalid conversion request." }); } });
    return;
  }
  const requested = request.url === "/" ? "/index.html" : request.url.split("?")[0];
  const filePath = path.resolve(root, `.${requested}`);
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return sendJson(response, 404, { error: "Not found" });
  response.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(response);
});

server.listen(port, () => console.log(`Reelcut running at http://localhost:${port}`));