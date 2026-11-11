const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const { randomUUID } = require('crypto');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});
const sns = new SNSClient({});

const TABLE = process.env.TABLE;
const ESTADOS = ['identificado', 'en_analisis', 'error_conocido', 'resuelto', 'cerrado'];
const PRIORIDADES = ['bajo', 'medio', 'alto', 'critico'];

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
};
const res = (statusCode, body) => ({ statusCode, headers: HEADERS, body: JSON.stringify(body) });

// tenant_id SIEMPRE sale del ID token, nunca del body
function ctx(event) {
  const c = event.requestContext?.authorizer?.claims || {};
  let groups = c['cognito:groups'] || [];
  if (typeof groups === 'string') groups = groups.replace(/[\[\]]/g, '').split(/[ ,]+/).filter(Boolean);
  return { tenant: c['custom:tenant_id'], sub: c.sub, groups };
}

// acepta PRB#000045, PRB%23000045, PRB-000045 o 000045
function normId(raw) {
  let id = decodeURIComponent(raw || '').replace('-', '#');
  if (/^\d+$/.test(id)) id = `PRB#${id.padStart(6, '0')}`;
  return /^PRB#\d{6}$/.test(id) ? id : null;
}

function parseBody(event) {
  try { return JSON.parse(event.body || '{}'); } catch { return null; }
}

async function publish(tipo, tenant, id, estado, actor, datos = {}) {
  const msg = { evento_id: randomUUID(), tipo, tenant_id: tenant, id, estado, actor_id: actor,
                fecha: new Date().toISOString(), datos };
  await sns.send(new PublishCommand({
    TopicArn: process.env.TOPIC_ARN,
    Message: JSON.stringify(msg),
    MessageAttributes: {
      tenant_id: { DataType: 'String', StringValue: tenant },
      tipo: { DataType: 'String', StringValue: tipo },
    },
  }));
}

const histItem = (tenant, id, estado, actor, extra = {}) => ({
  tenant_id: tenant,
  sk: `HIST#${id}#${new Date().toISOString()}`,
  problema_id: id, estado, actor_id: actor, ...extra,
});

module.exports = { ddb, TABLE, ESTADOS, PRIORIDADES, res, ctx, normId, parseBody, publish, histItem };
