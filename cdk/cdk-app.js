import * as cdk from "aws-cdk-lib"
import { GoogleAuthenticationExampleStack } from "./cdk-stack.js"

main()

function main() {
    const app = new cdk.App()
    new GoogleAuthenticationExampleStack(app, "example-google-oauth-cloudfront-lambda-edge", {
        env: {
            region: "us-west-1", // feel free to change this
        },
    })
}
