## Construct StaticS3Website

This construct creates an S3 bucket and uploads the contents of a local folder to it.
It is a composition of the following CDK constructs:
    - [AWS S3 Bucket lib](https://github.com/aws/aws-cdk/tree/main/packages/aws-cdk-lib/aws-s3)
    - [AWS S3 Bucket deployment lib](https://github.com/aws/aws-cdk/tree/main/packages/aws-cdk-lib/aws-s3-deployment)

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
                // Select all the files from dist folder that doesn't have the HTML extension
                sources: [Source.asset('./dist', { exclude: ['*.html'] })],
                // Set the cache-control to the files, so it will add those as response headers when requesting them
                // In this case, we want to cache all the scripts/style files
                cacheControl: [CacheControl.fromString('public,max-age=31536000,immutable')],
            },
            {
                sources: [
                // Select all the files from dist folder that does have the HTML extension
                    Source.asset('./dist', {
                        exclude: ['*', '!*.html'],
                        ignoreMode: IgnoreMode.GLOB,
                    }),
                ],
                // Set the cache-control to the files, so it will add those as response headers when requesting them
                // In this case, we don't want to cache html files, so we make sure that every new version it will take the updated version of the website
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

    // Creates the bucket and deploy the code
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
