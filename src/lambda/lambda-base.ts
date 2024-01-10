/* eslint-disable no-new */
/* eslint-disable no-console */
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import { ISecurityGroup, IVpc, Peer, Port, SecurityGroup, SubnetType } from 'aws-cdk-lib/aws-ec2';
import { LambdaDestination } from 'aws-cdk-lib/aws-logs-destinations';
import { Runtime, Function, Alias, IAlias } from 'aws-cdk-lib/aws-lambda';
import { FilterPattern, RetentionDays, SubscriptionFilter } from 'aws-cdk-lib/aws-logs';
import {
  IScalableTarget,
  PredefinedMetric,
  ScalableTarget,
  ServiceNamespace,
} from 'aws-cdk-lib/aws-applicationautoscaling';
import { ServicePrincipal } from 'aws-cdk-lib/aws-iam';

import { vpcFromConfig } from '../utils';

import { EventType, BaseNodeJsProps, LambdaConfig } from './types';

// CDK L2 constructs
// Docs: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_lambda_nodejs.NodejsFunction.html#entry
// Examples: https://github.com/aws-samples/aws-cdk-l2-constructs/blob/main/lib/level2/api/infrastructure.ts

/**
 * This construct is based on AWS NodeJsFunction and adds the following capabilities:
 *   - creates a default security group. See property 'defaultSecurityGroup' of this construct
 *   - creates an alias called "live" pointing to the latest lambda version and replaced versions are deleted automatically. See property 'liveAlias' of this construct
 *   - typed configuration props for common usage scenarios
 *   - autoscaling of provisioned concurrent invocations (so you lower cold starts). You can also use automatic scheduling to tweak min/max depending on a cron expression. See props.provisionedConcurrentExecutions
 *   - explicit private VPC configuration (see props.network)
 *   - source code path standardization to "[basePath]/[lambdaEventType]/[lambdaName]/index.ts" (can be overwritten by explicit props.entry)
 *   - custom CA support for HTTP calls (NodeJS NODE_EXTRA_CA_CERTS). See props.extraCaPubCert
 *   - option to subscribe an Lambda Arn to the log group related to the Lambda function. See props.logGroupSubscriberLambdaArn
 *   - adds environment STAGE to Lambda. See props.stage
 */
export class BaseNodeJsFunction extends Construct {
  public readonly nodeJsFunction: NodejsFunction;

  public readonly defaultSecurityGroup?: ISecurityGroup;

  public readonly liveAlias: IAlias;

  public readonly provisionedConcurrencyScalableTarget?: IScalableTarget;

  constructor(scope: Construct, id: string, props: BaseNodeJsProps) {
    super(scope, id);

    const propsWithDefaults = getPropsWithDefaults(id, props, scope);

    const { environment } = setupEnvironment(propsWithDefaults);

    const { defaultSG, securityGroups } = addSecurityGroups(this, propsWithDefaults);
    this.defaultSecurityGroup = defaultSG;

    const nodeJsFunc = new NodejsFunction(this, `${id}-${propsWithDefaults.stage}`, {
      ...propsWithDefaults,
      environment,
      securityGroups,
    });

    const { liveAlias, scalableTarget } = addAliasAndAutoscaling(
      this,
      nodeJsFunc,
      propsWithDefaults,
    );

    this.liveAlias = liveAlias;
    if (scalableTarget) {
      this.provisionedConcurrencyScalableTarget = scalableTarget;
    }

    addLogSubscriber(this, nodeJsFunc, propsWithDefaults);

    this.nodeJsFunction = nodeJsFunc;
  }
}

// eslint-disable-next-line complexity
export const getPropsWithDefaults = (
  id: string,
  props: BaseNodeJsProps,
  scope: Construct,
): BaseNodeJsProps => {
  let vpc: IVpc | undefined;
  if (props.network) {
    if (props.vpc) {
      throw new Error(`'vpc' is not supported when defining 'network'`);
    }
    vpc = vpcFromConfig(scope, props.network);
  }

  let { entry } = props;
  if (!entry) {
    if (!props.eventType) {
      throw new Error('eventType is required if entry is not defined');
    }
    const eventTypeStr = EventType[props.eventType].toLowerCase();
    entry = `${props.baseCodePath || 'handlers'}/${eventTypeStr}/${id}/index.ts`;
  }

  return {
    ...props,
    vpc,
    runtime: props.runtime ?? Runtime.NODEJS_18_X,
    entry,
    bundling: {
      ...props.bundling,
      commandHooks: {
        beforeBundling: (inputDir: string, outputDir: string): string[] => {
          // create CA certificate inside Lambda container
          if (props.extraCaPubCert) {
            return echoLines(props.extraCaPubCert, `${outputDir}/extra-ca.pub`);
          }
          return [];
        },
        beforeInstall: (): string[] => [],
        afterBundling: (): string[] => [],
      },
    },
    functionName: `${id}-${props.stage}`,
    logRetention: props.logRetention ?? RetentionDays.SIX_MONTHS,
    vpcSubnets:
      props.vpcSubnets ??
      // eslint-disable-next-line no-undefined
      (props.network ? { subnetType: SubnetType.PRIVATE_WITH_EGRESS } : undefined),
  };
};

/**
 * Setup autoscaling
 */
const addAliasAndAutoscaling = (
  scope: Construct,
  nodeJsFunc: NodejsFunction,
  props: LambdaConfig,
): { liveAlias: IAlias; scalableTarget?: IScalableTarget | null } => {
  const version = nodeJsFunc.currentVersion;

  const liveAlias = new Alias(scope, 'LiveAlias', {
    aliasName: 'live',
    version,
    provisionedConcurrentExecutions: props.provisionedConcurrentExecutions?.minCapacity,
  });

  let scalableTarget: ScalableTarget | null = null;

  // add autoscaling to Lambda
  if (
    props.provisionedConcurrentExecutions?.minCapacity &&
    props.provisionedConcurrentExecutions?.maxCapacity
  ) {
    if (
      props.provisionedConcurrentExecutions?.maxCapacity <
      props.provisionedConcurrentExecutions?.minCapacity
    ) {
      throw new Error(
        'provisionedConcurrentExecutions.maxCapacity must be greater than provisionedConcurrentExecutionsMin',
      );
    }

    scalableTarget = new ScalableTarget(scope, 'ScalableTarget', {
      serviceNamespace: ServiceNamespace.LAMBDA,
      maxCapacity: props.provisionedConcurrentExecutions.maxCapacity,
      minCapacity: props.provisionedConcurrentExecutions.minCapacity,
      resourceId: `function:${liveAlias.lambda.functionName}:${liveAlias.aliasName}`,
      scalableDimension: 'lambda:function:ProvisionedConcurrency',
    });

    // alias must be deployed before scalable target
    scalableTarget.node.addDependency(liveAlias);

    scalableTarget.scaleToTrackMetric('PcuTracking', {
      targetValue: props.provisionedConcurrentExecutions.target ?? 0.8,
      predefinedMetric: PredefinedMetric.LAMBDA_PROVISIONED_CONCURRENCY_UTILIZATION,
    });

    // create schedules
    if (props.provisionedConcurrentExecutions.schedules) {
      for (let i = 0; i < props.provisionedConcurrentExecutions.schedules.length; i += 1) {
        const scheduleInfo = props.provisionedConcurrentExecutions.schedules[i];
        scalableTarget.scaleOnSchedule(scheduleInfo.name ?? `schedule-${i}`, {
          schedule: scheduleInfo.schedule,
          minCapacity: scheduleInfo.minCapacity,
          maxCapacity: scheduleInfo.maxCapacity,
        });
      }
    }
  }

  return { liveAlias, scalableTarget };
};

/**
 * Create log subscriber
 */
const addLogSubscriber = (
  scope: Construct,
  nodeJsFunction: NodejsFunction,
  props: LambdaConfig,
): void => {
  if (!props.logGroupSubscriberLambdaArn) {
    return;
  }
  const logGroupFuncSubscriber = Function.fromFunctionAttributes(
    nodeJsFunction,
    'logGroupFuncSubscriber',
    {
      functionArn: props.logGroupSubscriberLambdaArn,
      // https://aleksdaranutsa.medium.com/aws-cdk-cloudwatch-logs-subscription-f4de1f9a52bf
      sameEnvironment: true,
    },
  );
  new SubscriptionFilter(nodeJsFunction, 'Subscription', {
    logGroup: nodeJsFunction.logGroup,
    destination: new LambdaDestination(logGroupFuncSubscriber),
    filterPattern: FilterPattern.allEvents(),
    filterName: 'all',
  });
  logGroupFuncSubscriber.addPermission('allow-log-subscriber', {
    principal: new ServicePrincipal('logs.eu-west-1.amazonaws.com'),
  });
};

/**
 * Create default security group and add to existing SGs from props if it exists
 */
const addSecurityGroups = (
  scope: Construct,
  props: LambdaConfig,
): {
  defaultSG?: ISecurityGroup;
  securityGroups?: ISecurityGroup[];
} => {
  if (!props.vpc) {
    if (props.allowTLSOutboundTo) {
      throw new Error(`'allowTLSOutboundTo' can only be used if vpc or network is defined`);
    }
    return {};
  }

  const securityGroups: ISecurityGroup[] = [];
  if (props.securityGroups) {
    // eslint-disable-next-line fp/no-mutating-methods
    securityGroups.push(...props.securityGroups);
  }

  // Create a default security group and expose via class variable
  const defaultSG = new SecurityGroup(scope, `sg-default-${scope.node.id}`, {
    vpc: props.vpc,
    description: `Default security group for Lambda ${scope.node.id}`,
    allowAllOutbound: false,
  });
  if (props.allowTLSOutboundTo) {
    defaultSG.addEgressRule(
      Peer.ipv4(props.allowTLSOutboundTo),
      Port.tcp(443),
      'Allow connection to TLS services',
    );
  }
  // eslint-disable-next-line fp/no-mutating-methods
  securityGroups.push(defaultSG);

  return { defaultSG, securityGroups };
};

const setupEnvironment = (props: BaseNodeJsProps): { environment: Record<string, string> } => {
  // add stage to environment
  let environment: Record<string, string> = {
    STAGE: props.stage,
  };
  if (props.environment) {
    environment = { ...environment, ...props.environment };
  }

  // add node options if source map is enabled
  if (props.bundling?.sourceMap) {
    console.log(
      '!!!ATENTION: source map is enabled in bundling options. This might have a big impact on Lambda performance. Read more at https://github.com/aws/aws-cdk/issues/19067',
    );
    environment = {
      ...environment,
      ...{ NODE_OPTIONS: '--enable-source-maps' },
    };
  }

  // add cert options if present
  if (props.extraCaPubCert) {
    environment = {
      ...environment,
      ...{ NODE_EXTRA_CA_CERTS: '/var/task/extra-ca.pub' },
    };
  }

  return { environment };
};

const echoLines = (pubCa: string, outputFile: string): string[] => {
  const echoes = [];
  const lines = pubCa.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    // eslint-disable-next-line fp/no-mutating-methods
    echoes.push(`echo "${line}" >> "${outputFile}"`);
  }
  return echoes;
};
