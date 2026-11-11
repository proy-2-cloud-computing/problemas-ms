const { QueryCommand } = require('@aws-sdk/lib-dynamodb');
const c = require('./common');

exports.handler = async (event) => {
  try {
    const { tenant } = c.ctx(event);
    if (!tenant) return c.res(403, { error: 'Token sin tenant_id' });
    const q = event.queryStringParameters || {};
    const limit = Math.min(parseInt(q.limit || '20', 10) || 20, 100);

    let start;
    if (q.nextToken) {
      try { start = JSON.parse(Buffer.from(q.nextToken, 'base64').toString()); }
      catch { return c.res(400, { error: 'nextToken invalido' }); }
      if (start.tenant_id !== tenant) return c.res(400, { error: 'nextToken invalido' });
    }

    const params = { TableName: c.TABLE, Limit: limit, ExclusiveStartKey: start };
    if (q.estado) {
      if (!c.ESTADOS.includes(q.estado)) return c.res(400, { error: 'estado invalido' });
      params.IndexName = 'GSI1';
      params.KeyConditionExpression = 'tenant_id = :t AND begins_with(estado_fecha, :e)';
      params.ExpressionAttributeValues = { ':t': tenant, ':e': `${q.estado}#` };
      params.ScanIndexForward = false;
    } else {
      params.KeyConditionExpression = 'tenant_id = :t AND begins_with(sk, :p)';
      params.ExpressionAttributeValues = { ':t': tenant, ':p': 'PRB#' };
    }
    const r = await c.ddb.send(new QueryCommand(params));
    return c.res(200, {
      items: r.Items,
      nextToken: r.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(r.LastEvaluatedKey)).toString('base64') : null,
    });
  } catch (e) {
    console.error(e);
    return c.res(500, { error: 'Error interno' });
  }
};
