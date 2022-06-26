import https from "https"
import crypto from "crypto"

// Replace with your client id
const googleClientId = "463482814474-bq5nq9n8kpko0tct4hljs6oni562tg4u.apps.googleusercontent.com"

/**
 * Parse cookie string key value object
 * @param {string} cookieString
 * @returns {Record<string,string>}
 */
function parseCookieString(cookieString) {
    if (typeof cookieString !== "string") {
        throw new TypeError("argument must be a string")
    }

    const parsedCookie = {}
    const pairs = cookieString.split(/; */)
    for (const pair of pairs) {
        const equalIndex = pair.indexOf("=")

        if (equalIndex !== -1) {
            const key = pair.substring(0, equalIndex).trim()
            let value = pair.substring(equalIndex + 1).trim()

            // quote values
            if (key.charAt(0) === '"') {
                value = value.slice(1, -1)
            }

            // only assign once
            if (parsedCookie[key] === undefined) {
                try {
                    parsedCookie[key] = decodeURIComponent(value)
                } catch (error) {
                    parsedCookie[key] = value
                }
            }
        }
    }

    return parsedCookie
}

let certsCache = null
let certsCacheExp = 0
/**
 * @returns {Object}
 */
async function fetchOauthCertsJson() {
    const certsString = await new Promise((resolve, reject) => {
        if (certsCacheExp > 0 && certsCacheExp > Date.now() / 1000) {
            resolve(certsCache)
        } else {
            const request = https.get("https://www.googleapis.com/oauth2/v1/certs", (response) => {
                const cacheControl = response.headers["cache-control"]
                const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i)
                if (maxAgeMatch) {
                    certsCacheExp = parseInt(maxAgeMatch[1]) + Date.now() / 1000
                }

                const chunks = []
                response.on("data", (chunk) => {
                    chunks.push(chunk)
                })
                response.on("end", () => {
                    certsCache = Buffer.concat(chunks).toString()
                    resolve(certsCache)
                })
            })

            request.on("error", (error) => {
                reject(error)
            })
        }
    })

    return JSON.parse(certsString)
}

/**
 * @param {string} tokenString
 */
async function authorize(tokenString) {
    if (typeof tokenString !== "string") {
        throw new Error("token must be a string")
    }

    const tokenParts = tokenString.split(".")
    if (tokenParts.length !== 3) {
        throw new Error("invalid token format")
    }

    const tokenHeader = JSON.parse(Buffer.from(tokenParts[0], "base64").toString())
    const tokenBody = JSON.parse(Buffer.from(tokenParts[1], "base64").toString())
    const tokenSignature = Buffer.from(tokenParts[2], "base64")

    if (tokenHeader["alg"] === "none") {
        throw new Error("token alg cannot be none")
    }

    const certsJson = await fetchOauthCertsJson()
    const tokenKid = tokenHeader["kid"]
    const publicKey = certsJson[tokenKid]

    const headerBodyConcat = tokenParts[0] + "." + tokenParts[1]
    const signatureVerified = crypto
        .createVerify("RSA-SHA256")
        .update(headerBodyConcat)
        .verify(publicKey, tokenSignature)
    if (!signatureVerified) {
        throw new Error("invalid signature")
    }

    if (tokenBody["aud"] !== googleClientId) {
        throw new Error("wrong client id")
    }

    if (tokenBody["iss"] !== "accounts.google.com" && tokenBody !== "https://accounts.google.com") {
        throw new Error("not issued by google")
    }

    if (tokenBody["exp"] < Date.now() / 1000) {
        throw new Error("expired")
    }

    // validate domain
    // if (tokenBody["hd"] !== "localhost") {
    //     throw new Error("wrong domain")
    // }

    // validate email allowlist
    // if (!["myemail@localhost"].includes(tokenBody["email"])) {
    //     throw new Error("email not on allow list")
    // }
}

/** @type {AWSLambda.CloudFrontRequestHandler} */
export const main = async (event, context) => {
    try {
        console.log("viewer request:", event, context)
        const request = event.Records[0].cf.request
        const cookies = parseCookieString(request.headers["cookie"]?.[0]?.["value"] ?? "")
        await authorize(cookies["CLOUDFRONT_GOOGLE_TOKEN"])
    } catch (error) {
        console.log("user unauthorized")
        return {
            body: "401 Unauthorized",
            bodyEncoding: "text",
            headers: {
                "content-type": [
                    {
                        key: "Content-Type",
                        value: "text/plain",
                    },
                ],
            },
            status: "401",
            statusDescription: "401 Unauthorized",
        }
    }

    return undefined
}
