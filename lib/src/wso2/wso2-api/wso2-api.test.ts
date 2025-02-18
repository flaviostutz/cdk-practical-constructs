/* eslint-disable camelcase */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable fp/no-mutating-methods */

import cloneDeep from 'lodash.clonedeep';
import { App, Stack } from 'aws-cdk-lib/core';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { SecurityGroup, Vpc } from 'aws-cdk-lib/aws-ec2';

import { petstoreOpenapi } from './__tests__/petstore';
import { Wso2Api } from './wso2-api';
import { Wso2ApiProps } from './types';
import { Wso2ApiDefinitionV1 } from './v1/types';

describe('wso2-api-construct', () => {
  it('minimal wso2 api', async () => {
    const app = new App();
    const stack = new Stack(app);

    const testProps1 = testProps();
    const wso2Api = new Wso2Api(stack, 'wso2', testProps1);

    expect(wso2Api.customResourceFunction).toBeDefined();
    expect(wso2Api.apiDefinition.enableStore).toBeTruthy();

    const template = Template.fromStack(stack);
    // console.log(JSON.stringify(template.toJSON(), null, 2));

    const templateStr = JSON.stringify(template.toJSON());
    expect(templateStr).toContain('"Action":"secretsmanager:GetSecretValue"');
    expect(templateStr).toContain('"Action":"kms:decrypt"');

    template.hasResourceProperties('Custom::Wso2Api', {
      wso2Config: testProps1.wso2Config,
      apiDefinition: wso2Api.apiDefinition,
      openapiDocument: testProps1.openapiDocument,
    });
  });

  it('openapi lint should fail', async () => {
    const app = new App();
    const stack = new Stack(app);

    const testProps1 = testProps();
    // @ts-ignore
    testProps1.openapiDocument.paths['/pets/{petId}'].get.parameters[0].name = 'SOMETHING';

    const f = (): void => {
      // eslint-disable-next-line no-new
      new Wso2Api(stack, 'wso2', testProps1);
    };
    expect(f).toThrow('Operation must define parameter "{petId}"');
  });

  it('cors config sugar should work', async () => {
    const app = new App();
    const stack = new Stack(app);

    const testProps1 = testProps();
    testProps1.apiDefinition.corsConfiguration = {
      accessControlAllowOrigins: ['testwebsite.com'],
    };
    const wso2Api = new Wso2Api(stack, 'wso2', testProps1);

    expect(wso2Api.apiDefinition.corsConfiguration).toMatchObject({
      accessControlAllowHeaders: [
        'Authorization',
        'Access-Control-Allow-Origin',
        'Content-Type',
        'SOAPAction',
      ],
      corsConfigurationEnabled: true,
      accessControlAllowOrigins: ['testwebsite.com'],
    });
  });
});

it('should automatically add a default securitygroup', async () => {
  const app = new App();
  const stack = new Stack(app);

  const testProps1 = testProps();
  const wso2Api = new Wso2Api(stack, 'wso2', {
    ...testProps1,
    customResourceConfig: {
      network: {
        vpcId: 'vpc',
        availabilityZones: ['a'],
        privateSubnetIds: ['a'],
        privateSubnetRouteTableIds: ['a'],
      },
    },
  });

  expect(wso2Api.customResourceFunction).toBeDefined();

  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::Lambda::Function', {
    VpcConfig: {
      SecurityGroupIds: Match.arrayWith([
        {
          'Fn::GetAtt': [Match.stringLikeRegexp('wso2sg*'), 'GroupId'],
        },
      ]),
    },
  });
});

it('should support custom securitygroup', async () => {
  const app = new App();
  const stack = new Stack(app);

  const vpc = new Vpc(stack, 'vpc');

  const mySecurityGroup = new SecurityGroup(stack, 'sg-test', { vpc });

  const testProps1 = testProps();
  const wso2Api = new Wso2Api(stack, 'wso2', {
    ...testProps1,
    customResourceConfig: {
      securityGroups: [mySecurityGroup],
      network: {
        vpcId: 'vpc',
        availabilityZones: ['a'],
        privateSubnetIds: ['a'],
        privateSubnetRouteTableIds: ['a'],
      },
    },
  });

  expect(wso2Api.customResourceFunction).toBeDefined();

  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::Lambda::Function', {
    VpcConfig: {
      SecurityGroupIds: Match.arrayWith([
        {
          'Fn::GetAtt': [Match.stringLikeRegexp('sgtest*'), 'GroupId'],
        },
      ]),
    },
  });
});

const testWso2ApiDefs = (args: { context: string; backendUrl: string }): Wso2ApiDefinitionV1 => {
  return {
    version: '1.0.0',
    type: 'HTTP',
    endpointConfig: {
      production_endpoints: {
        url: args.backendUrl,
      },
      sandbox_endpoints: {
        url: args.backendUrl,
      },
      endpoint_type: 'http',
    },
    context: args.context,
    name: args.context,
    gatewayEnvironments: ['public'],
  };
};

const testProps = (): Wso2ApiProps => {
  return {
    wso2Config: {
      baseApiUrl: 'http://localhost:8080/wso2',
      credentialsSecretId: 'arn::creds',
      credentialsSecretKMSKeyId: '1234-5678-0000',
    },
    apiDefinition: testWso2ApiDefs({
      context: '/test1',
      backendUrl: 'http://localhost:8080/',
    }),
    openapiDocument: cloneDeep(petstoreOpenapi),
  };
};
