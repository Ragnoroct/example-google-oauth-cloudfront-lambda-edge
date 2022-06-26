import * as cdk from "aws-cdk-lib"
import * as s3 from "aws-cdk-lib/aws-s3"
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment"
import * as cloudfront from "aws-cdk-lib/aws-cloudfront"
import * as origins from "aws-cdk-lib/aws-cloudfront-origins"
import * as lambda from "aws-cdk-lib/aws-lambda"
import { Construct } from "constructs"

export class GoogleAuthenticationExampleStack extends cdk.Stack {
    /**
     * @param {Construct} scope
     * @param {string} id
     * @param {cdk.StackProps} props
     */
    constructor(scope, id, props) {
        super(scope, id, props)

        // s3 bucket
        const bucket = new s3.Bucket(this, "WebBucket", {
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        })

        // deploy static content to s3 bucket
        new s3deploy.BucketDeployment(this, "DeployWebsite", {
            sources: [s3deploy.Source.asset("../website-dist")],
            destinationBucket: bucket,
        })

        // access identity
        const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, "OriginAccessIdentity")
        bucket.grantRead(originAccessIdentity)

        // s3 origin
        const s3Origin = new origins.S3Origin(bucket, {
            originAccessIdentity: originAccessIdentity,
        })

        // lambda@edge
        const lambdaEdge = new cloudfront.experimental.EdgeFunction(this, "LambdaEdgeAuthorizor", {
            runtime: lambda.Runtime.NODEJS_16_X,
            handler: "lambda-edge-handler.main",
            code: lambda.Code.fromAsset("..", { exclude: ["**", "!lambda-edge-handler.mjs"] }),
        })

        // cloudfront distribution
        const distribution = new cloudfront.Distribution(this, "WebDistribution", {
            defaultRootObject: "index.html",
            defaultBehavior: {
                origin: s3Origin,
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            },
            additionalBehaviors: {
                "/private/*": {
                    origin: s3Origin,
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    edgeLambdas: [
                        {
                            functionVersion: lambdaEdge.currentVersion,
                            eventType: cloudfront.LambdaEdgeEventType.VIEWER_REQUEST,
                        },
                    ],
                },
            },
        })
        new cdk.CfnOutput(this, "DistributionId", {
            value: distribution.distributionId,
        })
    }
}
