const cdk = require("@aws-cdk/core");
const s3 = require("@aws-cdk/aws-s3")
const cloudfront = require("@aws-cdk/aws-cloudfront")
const origins = require("@aws-cdk/aws-cloudfront-origins")

function init() {
    const app = new cdk.App({
        context: {
            "@aws-cdk/aws-apigateway:usagePlanKeyOrderInsensitiveId": true,
            "@aws-cdk/core:stackRelativeExports": true,
            "@aws-cdk/aws-rds:lowercaseDbIdentifier": true,
            "@aws-cdk/aws-lambda:recognizeVersionProps": true,
            "@aws-cdk/aws-cloudfront:defaultSecurityPolicyTLSv1.2_2021": true,
        }
    });
    new PrivateCloudfrontExampleStack(app, 'PrivateCloudfrontExampleStack', {
        env: { region: 'us-east-1' },
    });
}


class PrivateCloudfrontExampleStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);

        // s3 bucket
        const bucket = new s3.Bucket(this, 'WebBucket', {
            comment: "Example google oauth web bucket",
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        });

        // s3 origin
        const s3Origin = new origins.S3Origin(bucket)

        // cloudfront distribution
        new cloudfront.Distribution(this, 'WebDistribution', {
            comment: "Example google oauth frontend", 
            defaultBehavior: {
                origin: s3Origin,
            },
            additionalBehaviors: {
                "/private/*": {
                    origin: s3Origin,
                }
            }
        });
    }
}

init()
