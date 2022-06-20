import { readFile } from "node:fs/promises"
import http from "node:http"
import path from "node:path"
import { URL } from "node:url"

startOfflineServer(8080)

/** @param {number} port */
function startOfflineServer(port) {
    const server = http.createServer(requestListener)
    server.listen(port, "localhost", () => {
        const address = server.address()
        console.log("listening:", `http://localhost:${address.port}`)
    })
}

/**
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
async function requestListener(req, res) {
    try {
        await tryServeFile(req, res)
    } catch (error) {
        console.log("error:", error)
        res.writeHead(500)
        res.end("500 Internal Error")
    }
}

/**
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
async function tryServeFile(req, res) {
    try {
        const parsedUrl = new URL(req.url, `http://${req.headers.host}`)
        let filePathRelative = parsedUrl.pathname

        console.log(`${req.method} ${parsedUrl.pathname}`)

        if (filePathRelative === "/") {
            filePathRelative = "index.html"
        }
        const filePath = path.join("website-dist", filePathRelative)
        const fileContents = await readFile(filePath)
        res.setHeader("Content-Type", filePath.endsWith(".html") ? "text/html" : "text/plain")
        res.writeHead(200)
        res.end(fileContents)
    } catch (error) {
        if (error.errno == -21 || error.errno === -2) {
            // tried to read directory. no such file or directory
            res.setHeader("Content-Type", "text/plain")
            res.writeHead(404)
            res.end("404 Not Found")
        } else {
            throw error // unknown error
        }
    }
}
