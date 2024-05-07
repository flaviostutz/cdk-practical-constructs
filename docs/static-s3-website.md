## Construct StaticS3Website

This construct creates an S3 bucket and upload any content into it.
It is a composition of the following CDK constructs:
    - [AWS S3 Bucket lib](https://github.com/aws/aws-cdk/tree/main/packages/aws-cdk-lib/aws-s3)
    - [AWS S3 Bucket deployment lib](https://github.com/aws/aws-cdk/tree/main/packages/aws-cdk-lib/aws-s3-deployment)

Why to use it over the CDK constructs?
    - It has good defaults. e.g., enforcing ssl; restricted access; auto deleting bucket on deleting the stack.
    - easier interfaces. i.e. less configuration
    - Unified construct

### Usage

#### Simple S3 static website

```ts
    // This will create the bucket `my-website-bucket` and upload the files in your local `dist` folder into it
    new StaticS3Website(stack, 'my-website', {
        bucketName: 'my-website-bucket',
        deployments: [{
            sources: ['./dist'],
        }],
    });
```

#### Complex S3 static website

```ts
    const staticWebsiteConfig: StaticS3WebsiteProps = {
        bucketName: 'my-website-bucket',
        removalPolicy: RemovalPolicy.RETAIN,
        blockPublicAccess: new BlockPublicAccess({
            blockPublicAcls: true,
            ignorePublicAcls: true,
        }),
        deployments: [
            {
                sources: [Source.asset('./dist', { exclude: ['*.html'] })],
                cacheControl: [CacheControl.fromString('public,max-age=31536000,immutable')],
            },
            {
                sources: [
                    Source.asset('./dist', {
                        exclude: ['*', '!*.html'],
                        ignoreMode: IgnoreMode.GLOB,
                    }),
                ],
                cacheControl: [CacheControl.fromString('public,max-age=0,must-revalidate')],
            },
            {
                sources: [Source.asset('../assets')],
                destinationKey: 'assets',
                cacheControl: [CacheControl.fromString('public,max-age=31536000,immutable')],
            },
        ],
    };

    const ALLOWED_IP_RANGE = ['10.0.0.0', '172.16.0.0'];

    // creates the bucket and deploy the code
    const staticWebsite = new StaticS3Website(stack, 'my-complex-website', staticWebsiteConfig);

    // Creates an IAM policy
    const ipLimitPolicy = new PolicyStatement({
      actions: ['s3:GetObject', 's3:List*'],
      resources: [staticWebsite.bucket.arnForObjects('*')],
      principals: [new AnyPrincipal()],
    });

    // Adds condition to the policy
    ipLimitPolicy.addCondition('IpAddress', {
      'aws:SourceIp': ALLOWED_IP_RANGE,
    });

    // Attaches the policy to the deployment bucket
    staticWebsite.bucket.addToResourcePolicy(ipLimitPolicy)
```
