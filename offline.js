import { readFile } from "node:fs/promises"
import http from "node:http"
import path, { resolve } from "node:path"
import { URL } from "node:url"
import { main as handlerMain } from "./handler.js"

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
async function simulateAwsEventLambdaEdgeViewerRequest(req, res) {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`)

    /** @type {AWSLambda.CloudFrontRequestEvent} */
    const event = {}
    /** @type {AWSLambda.Context} */
    const context = {}

    /**
     * @param {http.IncomingMessage} req
     */
    const getCloudfrontHeadersObject = (req) => {
        const cloudfrontHeaders = {}
        for (let i = 0; i + 1 < req.rawHeaders.length; i += 2) {
            const headerName = req.rawHeaders[i]
            const headerValue = req.rawHeaders[i + 1]
            const headerNameLower = headerName.toLowerCase()

            if (!cloudfrontHeaders[headerNameLower]) {
                cloudfrontHeaders[headerNameLower] = []
            }

            cloudfrontHeaders[headerNameLower].push({ key: headerName, value: headerValue })
        }
        return cloudfrontHeaders
    }

    // only fill in what we need
    event.Records = [
        {
            cf: {
                request: {
                    uri: parsedUrl.pathname,
                    querystring: parsedUrl.search, // don't know if query string includes ? or not. URL.search includes it
                    method: req.method,
                    headers: getCloudfrontHeadersObject(req),
                },
            },
        },
    ]

    const result = await handlerMain(event, context)
}

/**
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
async function tryServeFile(req, res) {
    try {
        await simulateAwsEventLambdaEdgeViewerRequest(req, res)
    } catch (error) {
        console.error(error)
    }

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
