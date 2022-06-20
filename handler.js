/** @type {AWSLambda.CloudFrontRequestHandler} */
export const main = async (event, context) => {
    console.log("simulated event")
    return {
        asdf: "asdf",
    }
}
